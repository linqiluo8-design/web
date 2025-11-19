import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRead } from "@/lib/permissions"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || "product" // product | membership
    const dimension = searchParams.get("dimension") || "day" // hour | day | month | year
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // 验证权限：需要订单或会员模块的读权限
    if (type === "product") {
      await requireRead("ORDERS")
    } else if (type === "membership") {
      await requireRead("MEMBERSHIPS")
    } else {
      return NextResponse.json(
        { error: "无效的订单类型" },
        { status: 400 }
      )
    }

    // 验证参数
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "请提供开始日期和结束日期" },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "无效的日期格式" },
        { status: 400 }
      )
    }

    // 根据订单类型获取统计数据
    let data
    if (type === "product") {
      data = await getProductOrderStatistics(start, end, dimension)
    } else {
      data = await getMembershipOrderStatistics(start, end, dimension)
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("获取订单统计失败:", error)
    return NextResponse.json(
      { error: error.message || "获取订单统计失败" },
      { status: error.message === "未登录" ? 401 : 403 }
    )
  }
}

// 获取商品订单统计
async function getProductOrderStatistics(
  startDate: Date,
  endDate: Date,
  dimension: string
) {
  // 获取所有订单
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      createdAt: true,
      totalAmount: true,
      status: true,
    },
  })

  return aggregateOrderData(orders, dimension)
}

// 获取会员订单统计
async function getMembershipOrderStatistics(
  startDate: Date,
  endDate: Date,
  dimension: string
) {
  // 获取所有会员订单
  const memberships = await prisma.membership.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      createdAt: true,
      purchasePrice: true,
      paymentStatus: true,
    },
  })

  // 转换为统一格式
  const orders = memberships.map((m) => ({
    createdAt: m.createdAt,
    totalAmount: m.purchasePrice,
    status: m.paymentStatus === "completed" ? "paid" : m.paymentStatus,
  }))

  return aggregateOrderData(orders, dimension)
}

// 聚合订单数据
function aggregateOrderData(
  orders: Array<{
    createdAt: Date
    totalAmount: number
    status: string
  }>,
  dimension: string
) {
  const groupedData = new Map<
    string,
    {
      count: number
      amount: number
      paidCount: number
      paidAmount: number
    }
  >()

  orders.forEach((order) => {
    const period = getPeriodKey(order.createdAt, dimension)
    const existing = groupedData.get(period) || {
      count: 0,
      amount: 0,
      paidCount: 0,
      paidAmount: 0,
    }

    existing.count++
    existing.amount += order.totalAmount

    if (order.status === "paid" || order.status === "completed") {
      existing.paidCount++
      existing.paidAmount += order.totalAmount
    }

    groupedData.set(period, existing)
  })

  // 转换为数组并排序
  const result = Array.from(groupedData.entries())
    .map(([period, stats]) => ({
      period,
      ...stats,
    }))
    .sort((a, b) => a.period.localeCompare(b.period))

  return result
}

// 根据维度获取时间周期键
function getPeriodKey(date: Date, dimension: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")

  switch (dimension) {
    case "hour":
      return `${year}-${month}-${day} ${hour}:00`
    case "day":
      return `${year}-${month}-${day}`
    case "month":
      return `${year}-${month}`
    case "year":
      return `${year}`
    default:
      return `${year}-${month}-${day}`
  }
}
