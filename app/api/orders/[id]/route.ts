import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 简单的内存速率限制
const requestLog = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 1000 // 1秒
const MAX_REQUESTS_PER_WINDOW = 3 // 每秒最多3次请求

function checkRateLimit(orderId: string): boolean {
  const now = Date.now()
  const requests = requestLog.get(orderId) || []

  // 清理过期的请求记录
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW)

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    console.warn(`[RATE LIMIT] 订单 ${orderId} 请求过于频繁`)
    return false
  }

  // 记录本次请求
  recentRequests.push(now)
  requestLog.set(orderId, recentRequests)

  // 定期清理旧数据
  if (requestLog.size > 1000) {
    const oldestAllowed = now - RATE_LIMIT_WINDOW * 2
    for (const [id, times] of requestLog.entries()) {
      if (times.every(t => t < oldestAllowed)) {
        requestLog.delete(id)
      }
    }
  }

  return true
}

// 根据订单ID获取订单详情
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    // 速率限制检查
    if (!checkRateLimit(params.id)) {
      console.error(`[ORDER API] 请求被限流: ${params.id}`)
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      )
    }

    // 调试日志 - 记录请求来源
    const referer = request.headers.get('referer') || 'unknown'
    const timestamp = new Date().toISOString()
    console.log(`[ORDER API] ${timestamp} - GET /api/orders/${params.id}`)
    console.log(`  Referer: ${referer}`)

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                coverImage: true,
              }
            }
          }
        },
        payment: true,
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: "订单不存在" },
        { status: 404 }
      )
    }

    return NextResponse.json({ order })
  } catch (error: any) {
    console.error("查询订单失败:", error)
    return NextResponse.json(
      { error: "查询订单失败" },
      { status: 500 }
    )
  }
}
