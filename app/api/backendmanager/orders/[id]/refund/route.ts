import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/permissions"

// POST /api/backendmanager/orders/[id]/refund - 退款订单（仅管理员）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证管理员权限
    await requireAdmin()

    // Next.js 15+ requires awaiting params
    const { id } = await params
    const orderId = id

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: "订单不存在" },
        { status: 404 }
      )
    }

    // 检查订单状态
    if (order.status === "refunded") {
      return NextResponse.json(
        { error: "该订单已退款" },
        { status: 400 }
      )
    }

    if (order.status === "cancelled") {
      return NextResponse.json(
        { error: "已取消的订单无法退款" },
        { status: 400 }
      )
    }

    if (order.status === "pending") {
      return NextResponse.json(
        { error: "未支付的订单无法退款，请直接取消订单" },
        { status: 400 }
      )
    }

    // 在事务中更新订单和支付状态
    const result = await prisma.$transaction(async (tx) => {
      // 更新订单状态为已退款
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: "refunded" }
      })

      // 如果有支付记录，也更新支付状态
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: "refunded" }
        })
      }

      return updatedOrder
    })

    return NextResponse.json({
      success: true,
      message: "退款成功",
      order: result
    })

  } catch (error: any) {
    console.error("退款失败:", error)
    return NextResponse.json(
      { error: error.message || "退款失败" },
      {
        status: error.message === '未登录' ? 401 :
                error.message?.includes('管理员') ? 403 :
                500
      }
    )
  }
}
