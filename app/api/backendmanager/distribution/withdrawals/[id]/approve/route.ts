import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 批准提现申请
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

    // 查询提现记录
    const withdrawal = await prisma.commissionWithdrawal.findUnique({
      where: { id }
    })

    if (!withdrawal) {
      return NextResponse.json({ error: "提现记录不存在" }, { status: 404 })
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json(
        { error: `当前状态不能批准：${withdrawal.status}` },
        { status: 400 }
      )
    }

    // 更新状态为处理中
    const updated = await prisma.commissionWithdrawal.update({
      where: { id },
      data: {
        status: "processing",
        processedBy: user.id,
        processedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: "已批准，状态更新为处理中",
      withdrawal: updated
    })
  } catch (error) {
    console.error("批准提现失败:", error)
    return NextResponse.json(
      { error: "批准失败，请稍后重试" },
      { status: 500 }
    )
  }
}
