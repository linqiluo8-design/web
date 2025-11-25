import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 拒绝分销商申请
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
    const { reason } = body

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: "请填写拒绝原因" }, { status: 400 })
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

    // 更新状态为拒绝
    const updated = await prisma.distributor.update({
      where: { id },
      data: {
        status: "rejected",
        rejectedReason: reason
      }
    })

    return NextResponse.json({
      success: true,
      message: "已拒绝申请",
      distributor: {
        id: updated.id,
        code: updated.code,
        status: updated.status,
        rejectedReason: updated.rejectedReason
      }
    })
  } catch (error) {
    console.error("拒绝申请失败:", error)
    return NextResponse.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 }
    )
  }
}
