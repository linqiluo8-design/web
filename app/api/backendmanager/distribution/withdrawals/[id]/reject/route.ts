import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 拒绝提现申请
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
    const { reason } = body

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "请提供拒绝原因" }, { status: 400 })
    }

    // 查询提现记录
    const withdrawal = await prisma.commissionWithdrawal.findUnique({
      where: { id }
    })

    if (!withdrawal) {
      return NextResponse.json({ error: "提现记录不存在" }, { status: 404 })
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json(
        { error: `当前状态不能拒绝：${withdrawal.status}` },
        { status: 400 }
      )
    }

    // 使用事务处理：更新状态 + 退还余额
    const updated = await prisma.$transaction(async (tx) => {
      // 退还余额给分销商
      await tx.distributor.update({
        where: { id: withdrawal.distributorId },
        data: {
          availableBalance: { increment: withdrawal.amount }
        }
      })

      // 更新提现记录状态
      return tx.commissionWithdrawal.update({
        where: { id },
        data: {
          status: "rejected",
          rejectedReason: reason,
          processedBy: user.id,
          processedAt: new Date()
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: "已拒绝提现申请，余额已退还",
      withdrawal: updated
    })
  } catch (error) {
    console.error("拒绝提现失败:", error)
    return NextResponse.json(
      { error: "拒绝失败，请稍后重试" },
      { status: 500 }
    )
  }
}
