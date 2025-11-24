import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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

    // 检查最低提现金额（可配置）
    const minWithdrawal = 100
    if (amount < minWithdrawal) {
      return NextResponse.json({
        error: `最低提现金额为 ¥${minWithdrawal}`
      }, { status: 400 })
    }

    // 检查是否有待处理的提现申请
    const pendingWithdrawals = await prisma.commissionWithdrawal.count({
      where: {
        distributorId: user.distributor.id,
        status: { in: ["pending", "processing"] }
      }
    })

    if (pendingWithdrawals > 0) {
      return NextResponse.json({
        error: "您有待处理的提现申请，请等待处理完成后再申请"
      }, { status: 400 })
    }

    // 计算手续费（例如：2%，可配置）
    const feeRate = 0.02
    const fee = amount * feeRate
    const actualAmount = amount - fee

    // 创建提现申请
    const withdrawal = await prisma.$transaction(async (tx) => {
      // 扣除余额
      await tx.distributor.update({
        where: { id: user.distributor.id },
        data: {
          availableBalance: { decrement: amount }
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
          status: "pending"
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: "提现申请已提交，等待审核",
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        fee: withdrawal.fee,
        actualAmount: withdrawal.actualAmount,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt
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
