import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkWithdrawalRisk, validateWithdrawalBasics, createSecurityAlert } from "@/lib/withdrawal-risk-check"

// 获取提现记录列表
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { distributor: true }
    })

    if (!user || !user.distributor) {
      return NextResponse.json({ error: "您还不是分销商" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")
    const skip = (page - 1) * pageSize

    const [withdrawals, total] = await Promise.all([
      prisma.commissionWithdrawal.findMany({
        where: { distributorId: user.distributor.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.commissionWithdrawal.count({
        where: { distributorId: user.distributor.id }
      })
    ])

    return NextResponse.json({
      withdrawals: withdrawals.map(w => ({
        id: w.id,
        amount: w.amount,
        fee: w.fee,
        actualAmount: w.actualAmount,
        status: w.status,
        bankName: w.bankName,
        bankAccount: w.bankAccount.substring(w.bankAccount.length - 4), // 只显示后4位
        bankAccountName: w.bankAccountName,
        rejectedReason: w.rejectedReason,
        createdAt: w.createdAt,
        processedAt: w.processedAt,
        completedAt: w.completedAt
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error("获取提现记录失败:", error)
    return NextResponse.json(
      { error: "获取记录失败，请稍后重试" },
      { status: 500 }
    )
  }
}

// 申请提现
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body = await req.json()
    const { amount, bankName, bankAccount, bankAccountName } = body

    // 验证金额
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "请输入有效的提现金额" }, { status: 400 })
    }

    // 验证银行信息
    if (!bankName || !bankAccount || !bankAccountName) {
      return NextResponse.json({ error: "请填写完整的银行信息" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { distributor: true }
    })

    if (!user || !user.distributor) {
      return NextResponse.json({ error: "您还不是分销商" }, { status: 404 })
    }

    if (user.distributor.status !== "active") {
      return NextResponse.json({ error: "分销商账户未激活" }, { status: 403 })
    }

    // 检查余额是否足够
    if (user.distributor.availableBalance < amount) {
      return NextResponse.json({
        error: `可提现余额不足，当前余额：¥${user.distributor.availableBalance.toFixed(2)}`
      }, { status: 400 })
    }

    // ===== 新增：基础验证（使用风控工具） =====
    const basicValidation = await validateWithdrawalBasics(amount, user.distributor.id)
    if (!basicValidation.valid) {
      return NextResponse.json({ error: basicValidation.error }, { status: 400 })
    }

    // ===== 新增：风险检查 =====
    const riskResult = await checkWithdrawalRisk(amount, user.distributor)

    // 获取手续费率配置
    const feeRateConfig = await prisma.systemConfig.findUnique({
      where: { key: 'withdrawal_fee_rate' }
    })
    const feeRate = feeRateConfig ? parseFloat(feeRateConfig.value) : 0.02
    const fee = amount * feeRate
    const actualAmount = amount - fee

    // 决定初始状态：如果可以自动审核，直接设为 processing；否则为 pending
    const initialStatus = riskResult.canAutoApprove ? "processing" : "pending"
    const now = new Date()

    // 创建提现申请
    const withdrawal = await prisma.$transaction(async (tx) => {
      // 扣除余额
      await tx.distributor.update({
        where: { id: user.distributor.id },
        data: {
          availableBalance: { decrement: amount },
          // 如果是首次提现，记录时间
          ...(user.distributor.firstWithdrawalAt ? {} : { firstWithdrawalAt: now })
        }
      })

      // 创建提现记录
      return tx.commissionWithdrawal.create({
        data: {
          distributorId: user.distributor.id,
          amount,
          fee,
          actualAmount,
          bankName,
          bankAccount,
          bankAccountName,
          status: initialStatus,
          // 自动审核相关字段
          isAutoApproved: riskResult.canAutoApprove,
          autoApprovedAt: riskResult.canAutoApprove ? now : null,
          riskCheckResult: JSON.stringify({
            riskScore: riskResult.riskScore,
            riskLevel: riskResult.riskLevel,
            risks: riskResult.risks,
            reasons: riskResult.reasons
          }),
          riskScore: riskResult.riskScore,
          // 如果是自动审核，记录处理信息
          processedAt: riskResult.canAutoApprove ? now : null
        }
      })
    })

    // 如果需要记录安全警报
    if (riskResult.shouldAlert) {
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      const userAgent = req.headers.get('user-agent')
      await createSecurityAlert(
        user.distributor.id,
        user.id,
        amount,
        riskResult,
        ipAddress || undefined,
        userAgent || undefined
      )
    }

    // 返回结果
    const message = riskResult.canAutoApprove
      ? "提现申请已自动审核通过，等待打款"
      : "提现申请已提交，等待人工审核"

    return NextResponse.json({
      success: true,
      message,
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        fee: withdrawal.fee,
        actualAmount: withdrawal.actualAmount,
        status: withdrawal.status,
        isAutoApproved: withdrawal.isAutoApproved,
        riskScore: withdrawal.riskScore,
        createdAt: withdrawal.createdAt
      },
      // 额外信息：风险检查结果（仅用于调试，生产环境可移除）
      riskInfo: {
        canAutoApprove: riskResult.canAutoApprove,
        riskLevel: riskResult.riskLevel,
        riskScore: riskResult.riskScore,
        risks: riskResult.risks
      }
    })
  } catch (error) {
    console.error("申请提现失败:", error)
    return NextResponse.json(
      { error: "申请失败，请稍后重试" },
      { status: 500 }
    )
  }
}
