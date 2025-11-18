import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 取消单个订单
 * POST /api/orders/[id]/cancel
 *
 * 功能：
 * - 将指定订单的状态更新为cancelled
 * - 仅允许取消状态为pending的订单
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 查找订单
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: "订单不存在" },
        { status: 404 }
      )
    }

    // 只能取消待支付的订单
    if (order.status !== "pending") {
      return NextResponse.json(
        {
          error: "只能取消待支付的订单",
          message: `当前订单状态为：${order.status}`
        },
        { status: 400 }
      )
    }

    // 更新订单状态为已取消
    await prisma.order.update({
      where: { id },
      data: {
        status: "cancelled",
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: "订单已取消",
      orderNumber: order.orderNumber
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
