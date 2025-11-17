import { NextResponse } from "next/server"
import { requireRead } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/backendmanager/security-alerts
 * 获取安全警报列表（支持筛选和分页）
 * 需要安全警报的读权限
 */
export async function GET(req: Request) {
  try {
    // 需要安全警报的读权限
    await requireRead('SECURITY_ALERTS')

    const { searchParams } = new URL(req.url)

    // 分页参数
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    // 筛选参数
    const type = searchParams.get("type")
    const severity = searchParams.get("severity")
    const status = searchParams.get("status")

    // 构建查询条件
    const where: any = {}

    if (type) {
      where.type = type
    }

    if (severity) {
      where.severity = severity
    }

    if (status) {
      where.status = status
    }

    // 查询警报和总数
    const [alerts, total, unresolvedCount] = await Promise.all([
      prisma.securityAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prisma.securityAlert.count({ where }),
      prisma.securityAlert.count({
        where: { status: "unresolved" }
      })
    ])

    // 解析 metadata
    const alertsWithParsedMetadata = alerts.map(alert => ({
      ...alert,
      metadata: alert.metadata ? JSON.parse(alert.metadata) : null
    }))

    return NextResponse.json({
      alerts: alertsWithParsedMetadata,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      unresolvedCount
    })
  } catch (error) {
    console.error("获取安全警报失败:", error)
    return NextResponse.json(
      { error: "获取安全警报失败" },
      { status: 500 }
    )
  }
}
