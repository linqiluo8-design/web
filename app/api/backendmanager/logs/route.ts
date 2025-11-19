import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRead } from "@/lib/permissions"
import { logger, extractRequestInfo } from "@/lib/logger"

/**
 * 查询系统日志
 * GET /api/backendmanager/logs
 */
export async function GET(req: Request) {
  const startTime = Date.now()
  const requestInfo = extractRequestInfo(req)

  try {
    // 验证系统日志的读权限
    const session = await requireRead('SYSTEM_LOGS')

    const { searchParams } = new URL(req.url)

    // 查询参数
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const level = searchParams.get("level") || undefined
    const category = searchParams.get("category") || undefined
    const action = searchParams.get("action") || undefined
    const keyword = searchParams.get("keyword") || undefined
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined

    // 构建查询条件
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

    // 计算分页
    const skip = (page - 1) * limit

    // 查询日志
    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.systemLog.count({ where })
    ])

    const duration = Date.now() - startTime

    // 记录查询日志的操作
    await logger.info({
      category: 'api',
      action: 'logs_queried',
      message: `查询系统日志 (${total} 条)`,
      userId: session.user?.id,
      ...requestInfo,
      statusCode: 200,
      duration,
      metadata: {
        page,
        limit,
        level,
        category,
        keyword,
        total
      }
    })

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    // 记录错误
    await logger.error({
      category: 'api',
      action: 'logs_query_failed',
      message: '查询系统日志失败',
      ...requestInfo,
      statusCode: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500,
      duration,
      error
    })

    return NextResponse.json(
      { error: error.message || "查询日志失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
