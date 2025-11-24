import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// 审核通过分销商申请
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    // 检查权限
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { permissions: true }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const hasPermission = user.role === "ADMIN" ||
      user.permissions.some(p => p.module === "DISTRIBUTION" && p.level === "WRITE")

    if (!hasPermission) {
      return NextResponse.json({ error: "无权限操作" }, { status: 403 })
    }

    const { id } = params
    const body = await req.json()
    const { commissionRate } = body

    // 验证佣金比例
    if (commissionRate !== undefined && (commissionRate < 0 || commissionRate > 1)) {
      return NextResponse.json({ error: "佣金比例必须在 0-1 之间" }, { status: 400 })
    }

    // 查找分销商
    const distributor = await prisma.distributor.findUnique({
      where: { id }
    })

    if (!distributor) {
      return NextResponse.json({ error: "分销商不存在" }, { status: 404 })
    }

    if (distributor.status !== "pending") {
      return NextResponse.json({ error: "该申请已处理" }, { status: 400 })
    }

    // 更新状态为激活
    const updated = await prisma.distributor.update({
      where: { id },
      data: {
        status: "active",
        approvedAt: new Date(),
        approvedBy: user.id,
        commissionRate: commissionRate !== undefined ? commissionRate : distributor.commissionRate
      }
    })

    return NextResponse.json({
      success: true,
      message: "审核通过",
      distributor: {
        id: updated.id,
        code: updated.code,
        status: updated.status,
        commissionRate: updated.commissionRate,
        approvedAt: updated.approvedAt
      }
    })
  } catch (error) {
    console.error("审核失败:", error)
    return NextResponse.json(
      { error: "审核失败，请稍后重试" },
      { status: 500 }
    )
  }
}
