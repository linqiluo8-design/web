import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWrite } from "@/lib/permissions"
import { z } from "zod"

/**
 * PATCH /api/backendmanager/security-alerts/batch
 * 批量更新安全警报状态
 */
export async function PATCH(req: Request) {
  try {
    // 验证安全警报的写权限
    const user = await requireWrite('SECURITY_ALERTS')

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
        resolvedBy: user.id,
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
      { error: error.message || "批量更新失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/backendmanager/security-alerts/batch
 * 批量删除安全警报
 */
export async function DELETE(req: Request) {
  try {
    // 验证安全警报的写权限（删除操作需要写权限）
    const user = await requireWrite('SECURITY_ALERTS')

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
        userId: user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        description: `批量删除了 ${result.count} 条警报`,
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
      { error: error.message || "批量删除失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
