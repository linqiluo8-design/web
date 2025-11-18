import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 自动取消过期的未支付订单
 * GET /api/orders/cancel-expired
 *
 * 功能：
 * - 查找所有状态为pending且过期时间早于当前时间的订单
 * - 将这些订单的状态更新为cancelled
 * - 返回取消的订单数量
 *
 * 此接口可以被前端定期调用，或通过定时任务调用
 */
export async function GET() {
  try {
    const now = new Date()

    // 查找所有已过期的未支付订单
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "pending",
        expiresAt: {
          lte: now // 过期时间小于等于当前时间
        }
      },
      select: {
        id: true,
        orderNumber: true,
        expiresAt: true
      }
    })

    // 批量更新为已取消状态
    const result = await prisma.order.updateMany({
      where: {
        id: {
          in: expiredOrders.map(order => order.id)
        }
      },
      data: {
        status: "cancelled",
        updatedAt: now
      }
    })

    return NextResponse.json({
      success: true,
      message: `成功取消 ${result.count} 个过期订单`,
      cancelledCount: result.count,
      cancelledOrders: expiredOrders.map(order => ({
        orderNumber: order.orderNumber,
        expiredAt: order.expiresAt
      }))
    })

  } catch (error: any) {
    console.error("取消过期订单失败:", error)
    return NextResponse.json(
      {
        success: false,
        error: "取消过期订单失败",
        message: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * 手动取消指定订单（支持批量）
 * POST /api/orders/cancel-expired
 *
 * 请求体：
 * {
 *   orderIds?: string[]  // 可选，指定订单ID列表
 *   orderNumbers?: string[]  // 可选，指定订单号列表
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { orderIds, orderNumbers } = body

    if (!orderIds && !orderNumbers) {
      return NextResponse.json(
        { error: "请提供 orderIds 或 orderNumbers" },
        { status: 400 }
      )
    }

    const where: any = {
      status: "pending"
    }

    if (orderIds && orderIds.length > 0) {
      where.id = { in: orderIds }
    } else if (orderNumbers && orderNumbers.length > 0) {
      where.orderNumber = { in: orderNumbers }
    }

    // 查找订单
    const ordersToCancel = await prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true
      }
    })

    if (ordersToCancel.length === 0) {
      return NextResponse.json({
        success: true,
        message: "没有找到符合条件的待支付订单",
        cancelledCount: 0
      })
    }

    // 批量取消
    const result = await prisma.order.updateMany({
      where: {
        id: {
          in: ordersToCancel.map(order => order.id)
        }
      },
      data: {
        status: "cancelled",
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: `成功取消 ${result.count} 个订单`,
      cancelledCount: result.count,
      cancelledOrders: ordersToCancel.map(order => order.orderNumber)
    })

  } catch (error: any) {
    console.error("取消订单失败:", error)
    return NextResponse.json(
      {
        success: false,
        error: "取消订单失败",
        message: error.message
      },
      { status: 500 }
    )
  }
}
