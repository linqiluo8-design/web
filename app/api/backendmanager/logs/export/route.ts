import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRead } from "@/lib/permissions"
import { logger, extractRequestInfo } from "@/lib/logger"

/**
 * 将日志数据转换为CSV格式
 */
function convertToCSV(logs: any[]): string {
  if (logs.length === 0) {
    return ""
  }

  // CSV表头
  const headers = [
    "时间",
    "级别",
    "分类",
    "操作",
    "消息",
    "用户ID",
    "IP地址",
    "路径",
    "HTTP方法",
    "状态码",
    "耗时(ms)",
    "错误信息"
  ]

  // CSV数据行
  const rows = logs.map(log => {
    return [
      new Date(log.createdAt).toLocaleString("zh-CN", {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      }),
      log.level,
      log.category,
      log.action,
      `"${log.message.replace(/"/g, '""')}"`, // 转义引号
      log.userId || "",
      log.ipAddress || "",
      log.path || "",
      log.method || "",
      log.statusCode || "",
      log.duration || "",
      log.error ? `"${log.error.replace(/"/g, '""')}"` : ""
    ]
  })

  // 组合CSV内容
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n")

  // 添加BOM以支持Excel正确显示中文
  return "\uFEFF" + csvContent
}

/**
 * 导出系统日志
 * GET /api/backendmanager/logs/export
 */
export async function GET(req: Request) {
  const startTime = Date.now()
  const requestInfo = extractRequestInfo(req)

  try {
    // 验证系统日志的读权限
    const session = await requireRead('SYSTEM_LOGS')

    const { searchParams } = new URL(req.url)

    // 导出参数
    const format = searchParams.get("format") || "csv" // csv 或 json
    const level = searchParams.get("level") || undefined
    const category = searchParams.get("category") || undefined
    const action = searchParams.get("action") || undefined
    const keyword = searchParams.get("keyword") || undefined
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined

    // 构建查询条件（同查询API）
    const where: any = {}

    if (level && level !== 'all') {
      where.level = level
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (action) {
      where.action = {
        contains: action,
        mode: 'insensitive'
      }
    }

    if (keyword) {
      where.OR = [
        { message: { contains: keyword, mode: 'insensitive' } },
        { action: { contains: keyword, mode: 'insensitive' } },
        { path: { contains: keyword, mode: 'insensitive' } }
      ]
    }

    // 日期范围查询（精确到秒级别）
    if (startDate || endDate) {
      where.createdAt = {}

      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }

      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // 查询所有符合条件的日志（用于导出）
    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    const duration = Date.now() - startTime

    // 记录导出操作
    await logger.info({
      category: 'api',
      action: 'logs_exported',
      message: `导出系统日志 (${logs.length} 条, ${format} 格式)`,
      userId: session.user?.id,
      ...requestInfo,
      statusCode: 200,
      duration,
      metadata: {
        format,
        level,
        category,
        keyword,
        count: logs.length
      }
    })

    // 根据格式返回数据
    if (format === "json") {
      // JSON格式
      const jsonData = JSON.stringify(logs, null, 2)

      return new NextResponse(jsonData, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename=system_logs_${Date.now()}.json`
        }
      })
    } else {
      // CSV格式（默认）
      const csvData = convertToCSV(logs)

      return new NextResponse(csvData, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=system_logs_${Date.now()}.csv`
        }
      })
    }
  } catch (error: any) {
    const duration = Date.now() - startTime

    // 记录错误
    await logger.error({
      category: 'api',
      action: 'logs_export_failed',
      message: '导出系统日志失败',
      ...requestInfo,
      statusCode: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500,
      duration,
      error
    })

    return NextResponse.json(
      { error: error.message || "导出日志失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
