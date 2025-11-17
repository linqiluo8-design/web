import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

/**
 * PATCH /api/backendmanager/security-alerts/batch
 * 批量更新安全警报状态
 * 仅限管理员访问
 */
export async function PATCH(req: Request) {
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

    // 验证请求数据
    const batchUpdateSchema = z.object({
      ids: z.array(z.string()).min(1, "请至少选择一条警报").max(100, "批量操作最多支持100条"),
      status: z.enum(["unresolved", "investigating", "resolved", "false_positive"]),
      notes: z.string().optional()
    })

    const data = batchUpdateSchema.parse(body)

    // 批量更新警报状态
    const result = await prisma.securityAlert.updateMany({
      where: {
        id: { in: data.ids }
      },
      data: {
        status: data.status,
        resolvedBy: session.user.id,
        resolvedAt: new Date(),
        notes: data.notes,
        updatedAt: new Date()
      }
    })

    // 记录审计日志
    await prisma.securityAlert.create({
      data: {
        type: "BATCH_ALERT_UPDATE",
        severity: "info",
        userId: session.user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        description: `管理员批量更新了 ${result.count} 条警报状态为：${data.status}`,
        metadata: JSON.stringify({
          alertIds: data.ids,
          newStatus: data.status,
          notes: data.notes,
          affectedCount: result.count
        })
      }
    })

    return NextResponse.json({
      message: `成功更新 ${result.count} 条警报`,
      count: result.count
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("批量更新警报失败:", error)
    return NextResponse.json(
      { error: "批量更新失败" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/backendmanager/security-alerts/batch
 * 批量删除安全警报
 * 仅限管理员访问
 */
export async function DELETE(req: Request) {
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

    // 验证请求数据
    const batchDeleteSchema = z.object({
      ids: z.array(z.string()).min(1, "请至少选择一条警报").max(100, "批量操作最多支持100条")
    })

    const data = batchDeleteSchema.parse(body)

    // 先获取要删除的警报信息（用于审计日志）
    const alertsToDelete = await prisma.securityAlert.findMany({
      where: {
        id: { in: data.ids }
      },
      select: {
        id: true,
        type: true,
        severity: true,
        description: true
      }
    })

    // 批量删除警报
    const result = await prisma.securityAlert.deleteMany({
      where: {
        id: { in: data.ids }
      }
    })

    // 记录审计日志
    await prisma.securityAlert.create({
      data: {
        type: "BATCH_ALERT_DELETE",
        severity: "info",
        userId: session.user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        description: `管理员批量删除了 ${result.count} 条警报`,
        metadata: JSON.stringify({
          deletedAlerts: alertsToDelete,
          deletedCount: result.count
        })
      }
    })

    return NextResponse.json({
      message: `成功删除 ${result.count} 条警报`,
      count: result.count
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("批量删除警报失败:", error)
    return NextResponse.json(
      { error: "批量删除失败" },
      { status: 500 }
    )
  }
}
