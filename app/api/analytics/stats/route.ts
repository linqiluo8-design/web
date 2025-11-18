import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRead } from "@/lib/permissions"

// 获取统计数据（需要浏览量统计读权限）
export async function GET(req: Request) {
  try {
    // 验证浏览量统计读权限
    await requireRead("ANALYTICS")

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const granularity = searchParams.get("granularity") || "day" // hour, day, week, month

    // 构建时间范围查询条件
    const where: any = {}
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } else if (startDate) {
      where.timestamp = {
        gte: new Date(startDate)
      }
    } else if (endDate) {
      where.timestamp = {
        lte: new Date(endDate)
      }
    }

    // 1. 总PV（总访问量）
    const totalPV = await prisma.pageView.count({ where })

    // 2. 总UV（独立访客数）
    const uniqueVisitors = await prisma.pageView.groupBy({
      by: ['visitorId'],
      where,
      _count: true
    })
    const totalUV = uniqueVisitors.length

    // 3. 按时间维度聚合数据
    const pageViews = await prisma.pageView.findMany({
      where,
      select: {
        timestamp: true,
        visitorId: true,
      },
      orderBy: {
        timestamp: 'asc'
      }
    })

    // 按时间粒度聚合
    const timeSeriesData = aggregateByGranularity(pageViews, granularity)

    // 4. 访问来源IP统计（Top 10）
    const ipStats = await prisma.pageView.groupBy({
      by: ['ipAddress'],
      where,
      _count: true,
      orderBy: {
        _count: {
          ipAddress: 'desc'
        }
      },
      take: 10
    })

    // 5. 访问路径统计（Top 10）
    const pathStats = await prisma.pageView.groupBy({
      by: ['path'],
      where,
      _count: true,
      orderBy: {
        _count: {
          path: 'desc'
        }
      },
      take: 10
    })

    // 6. 地区统计
    const countryStats = await prisma.pageView.groupBy({
      by: ['country'],
      where,
      _count: true,
      orderBy: {
        _count: {
          country: 'desc'
        }
      },
      take: 10
    })

    return NextResponse.json({
      overview: {
        totalPV,
        totalUV,
        avgPVPerVisitor: totalUV > 0 ? (totalPV / totalUV).toFixed(2) : 0
      },
      timeSeries: timeSeriesData,
      topIPs: ipStats.map(item => ({
        ip: item.ipAddress,
        count: item._count
      })),
      topPaths: pathStats.map(item => ({
        path: item.path,
        count: item._count
      })),
      topCountries: countryStats.map(item => ({
        country: item.country || 'Unknown',
        count: item._count
      }))
    })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("获取统计数据失败:", error)
    return NextResponse.json(
      { error: "获取统计数据失败" },
      { status: 500 }
    )
  }
}

// 按时间粒度聚合数据
function aggregateByGranularity(
  pageViews: Array<{ timestamp: Date; visitorId: string }>,
  granularity: string
): Array<{ time: string; pv: number; uv: number }> {
  const dataMap = new Map<string, { pv: number; visitors: Set<string> }>()

  pageViews.forEach(view => {
    const timeKey = formatTimeKey(view.timestamp, granularity)

    if (!dataMap.has(timeKey)) {
      dataMap.set(timeKey, { pv: 0, visitors: new Set() })
    }

    const data = dataMap.get(timeKey)!
    data.pv++
    data.visitors.add(view.visitorId)
  })

  // 转换为数组并排序
  return Array.from(dataMap.entries())
    .map(([time, data]) => ({
      time,
      pv: data.pv,
      uv: data.visitors.size
    }))
    .sort((a, b) => a.time.localeCompare(b.time))
}

// 格式化时间键
function formatTimeKey(date: Date, granularity: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')

  switch (granularity) {
    case 'hour':
      return `${year}-${month}-${day} ${hour}:00`
    case 'day':
      return `${year}-${month}-${day}`
    case 'week':
      // 获取当周周一的日期
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay() + 1)
      const weekYear = weekStart.getFullYear()
      const weekMonth = String(weekStart.getMonth() + 1).padStart(2, '0')
      const weekDay = String(weekStart.getDate()).padStart(2, '0')
      return `${weekYear}-${weekMonth}-${weekDay} 周`
    case 'month':
      return `${year}-${month}`
    default:
      return `${year}-${month}-${day}`
  }
}
