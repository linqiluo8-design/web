import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 完成提现
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    // 检查用户权限
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { permissions: true }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 检查是否是管理员或有分销管理权限
    const distributionPermission = user.permissions.find(
      p => p.module === "DISTRIBUTION"
    )

    if (user.role !== "ADMIN" && distributionPermission?.level !== "WRITE") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    const { id } = params
    const body = await req.json()
    const { transactionId } = body

    if (!transactionId || !transactionId.trim()) {
      return NextResponse.json({ error: "请提供交易凭证号" }, { status: 400 })
    }

    // 查询提现记录
    const withdrawal = await prisma.commissionWithdrawal.findUnique({
      where: { id }
    })

    if (!withdrawal) {
      return NextResponse.json({ error: "提现记录不存在" }, { status: 404 })
    }

    if (withdrawal.status !== "processing") {
      return NextResponse.json(
        { error: `当前状态不能完成：${withdrawal.status}` },
        { status: 400 }
      )
    }

    // 使用事务处理：更新状态 + 更新分销商已提现金额
    const updated = await prisma.$transaction(async (tx) => {
      // 更新分销商已提现金额
      await tx.distributor.update({
        where: { id: withdrawal.distributorId },
        data: {
          withdrawnAmount: { increment: withdrawal.amount }
        }
      })

      // 更新提现记录状态
      return tx.commissionWithdrawal.update({
        where: { id },
        data: {
          status: "completed",
          transactionId: transactionId.trim(),
          completedAt: new Date()
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: "提现已完成",
      withdrawal: updated
    })
  } catch (error) {
    console.error("完成提现失败:", error)
    return NextResponse.json(
      { error: "完成失败，请稍后重试" },
      { status: 500 }
    )
  }
}
