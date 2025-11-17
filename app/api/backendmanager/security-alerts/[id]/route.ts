import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateAlertSchema = z.object({
  status: z.enum(["unresolved", "investigating", "resolved", "false_positive"]).optional(),
  notes: z.string().optional()
})

/**
 * PATCH /api/backendmanager/security-alerts/[id]
 * 更新安全警报状态
 * 仅限管理员访问
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户登录
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "未授权，请先登录" },
        { status: 401 }
      )
    }

    // 验证管理员权限
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "无权限访问，仅管理员可访问" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const data = updateAlertSchema.parse(body)

    // 检查警报是否存在
    const alert = await prisma.securityAlert.findUnique({
      where: { id: params.id }
    })

    if (!alert) {
      return NextResponse.json(
        { error: "警报不存在" },
        { status: 404 }
      )
    }

    // 更新警报
    const updateData: any = {}

    if (data.status) {
      updateData.status = data.status
      // 如果状态改为已处理或误报，记录处理信息
      if (data.status === "resolved" || data.status === "false_positive") {
        updateData.resolvedBy = session.user.id
        updateData.resolvedAt = new Date()
      }
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes
    }

    const updatedAlert = await prisma.securityAlert.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      alert: updatedAlert,
      message: "警报更新成功"
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("更新安全警报失败:", error)
    return NextResponse.json(
      { error: "更新安全警报失败" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/backendmanager/security-alerts/[id]
 * 删除安全警报
 * 仅限管理员访问
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户登录
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "未授权，请先登录" },
        { status: 401 }
      )
    }

    // 验证管理员权限
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "无权限访问，仅管理员可访问" },
        { status: 403 }
      )
    }

    // 检查警报是否存在
    const alert = await prisma.securityAlert.findUnique({
      where: { id: params.id }
    })

    if (!alert) {
      return NextResponse.json(
        { error: "警报不存在" },
        { status: 404 }
      )
    }

    // 删除警报
    await prisma.securityAlert.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      message: "警报删除成功"
    })
  } catch (error) {
    console.error("删除安全警报失败:", error)
    return NextResponse.json(
      { error: "删除安全警报失败" },
      { status: 500 }
    )
  }
}
