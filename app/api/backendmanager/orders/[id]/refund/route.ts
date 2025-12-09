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

    // 查询是否存在分销订单
    const distributionOrder = await prisma.distributionOrder.findUnique({
      where: { orderId: orderId },
      include: {
        distributor: true
      }
    })

    // 在事务中更新订单、支付和分销状态
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新订单状态为已退款
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: "refunded" }
      })

      // 2. 如果有支付记录，也更新支付状态
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: "refunded" }
        })
      }

      // 3. 如果是推广订单，更新分销订单状态
      if (distributionOrder) {
        const now = new Date()

        // 更新分销订单状态为已取消
        await tx.distributionOrder.update({
          where: { id: distributionOrder.id },
          data: {
            status: "cancelled",
            cancelledAt: now,
            cancelReason: "订单已退款"
          }
        })

        // 4. 如果佣金已结算，需要从分销商余额中扣除
        if (distributionOrder.status === "settled") {
          const distributor = distributionOrder.distributor

          // 从可提现余额中扣除佣金
          await tx.distributor.update({
            where: { id: distributor.id },
            data: {
              availableBalance: {
                decrement: distributionOrder.commissionAmount
              },
              totalEarnings: {
                decrement: distributionOrder.commissionAmount
              },
              totalOrders: {
                decrement: 1
              }
            }
          })
        } else if (distributionOrder.status === "confirmed") {
          // 如果还在冷静期（confirmed 状态），从待结算佣金中扣除
          await tx.distributor.update({
            where: { id: distributionOrder.distributor.id },
            data: {
              pendingCommission: {
                decrement: distributionOrder.commissionAmount
              },
              totalOrders: {
                decrement: 1
              }
            }
          })
        }
      }

      return updatedOrder
    })

    // 构建退款成功消息
    let message = "退款成功"
    if (distributionOrder) {
      if (distributionOrder.status === "settled") {
        message += `，已从分销商余额扣除佣金 ¥${distributionOrder.commissionAmount.toFixed(2)}`
      } else if (distributionOrder.status === "confirmed") {
        message += `，已从分销商待结算佣金扣除 ¥${distributionOrder.commissionAmount.toFixed(2)}`
      }
    }

    return NextResponse.json({
      success: true,
      message: message,
      order: result,
      distributionHandled: !!distributionOrder
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
