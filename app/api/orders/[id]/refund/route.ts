import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * 退款处理接口
 * POST /api/orders/[id]/refund
 *
 * 功能：
 * 1. 将订单状态改为 refunded
 * 2. 如果有分销订单，取消佣金结算
 * 3. 从分销商的 pendingCommission 或 availableBalance 中扣除佣金
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    // 验证权限：只有管理员可以退款
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限操作" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { refundReason } = body

    // 查找订单
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        distributionOrder: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 })
    }

    // 只能退款已支付的订单
    if (order.status !== "paid") {
      return NextResponse.json(
        {
          error: "只能退款已支付的订单",
          message: `当前订单状态为：${order.status}`
        },
        { status: 400 }
      )
    }

    // 使用事务处理退款
    await prisma.$transaction(async (tx) => {
      // 1. 更新订单状态为已退款
      await tx.order.update({
        where: { id },
        data: {
          status: "refunded",
          updatedAt: new Date()
        }
      })

      // 2. 处理分销佣金取消
      if (order.distributionOrder) {
        const distributionOrder = order.distributionOrder

        // 根据分销订单的状态，决定如何处理佣金
        if (distributionOrder.status === "confirmed") {
          // 佣金还在冷静期，尚未结算到 availableBalance
          // 从 pendingCommission 中扣除

          await tx.distributionOrder.update({
            where: { id: distributionOrder.id },
            data: {
              status: "cancelled",
              cancelledAt: new Date(),
              cancelReason: refundReason || "订单退款"
            }
          })

          await tx.distributor.update({
            where: { id: distributionOrder.distributorId },
            data: {
              totalEarnings: { decrement: distributionOrder.commissionAmount },
              pendingCommission: { decrement: distributionOrder.commissionAmount }
            }
          })

          console.log(`✅ 取消待结算佣金: ¥${distributionOrder.commissionAmount}`)

        } else if (distributionOrder.status === "settled") {
          // 佣金已结算到 availableBalance，需要从余额中扣除
          // 这种情况比较复杂，需要检查余额是否足够

          const distributor = await tx.distributor.findUnique({
            where: { id: distributionOrder.distributorId }
          })

          if (!distributor) {
            throw new Error("分销商不存在")
          }

          // 检查余额是否足够扣除
          if (distributor.availableBalance >= distributionOrder.commissionAmount) {
            // 余额足够，直接扣除
            await tx.distributionOrder.update({
              where: { id: distributionOrder.id },
              data: {
                status: "cancelled",
                cancelledAt: new Date(),
                cancelReason: refundReason || "订单退款"
              }
            })

            await tx.distributor.update({
              where: { id: distributionOrder.distributorId },
              data: {
                totalEarnings: { decrement: distributionOrder.commissionAmount },
                availableBalance: { decrement: distributionOrder.commissionAmount }
              }
            })

            console.log(`✅ 从可提现余额扣除佣金: ¥${distributionOrder.commissionAmount}`)
          } else {
            // 余额不足，可能已经提现
            // 方案1：标记为负债，从未来佣金中扣除
            // 方案2：记录警报，需要人工处理
            // 这里采用方案2，记录警报

            await tx.distributionOrder.update({
              where: { id: distributionOrder.id },
              data: {
                status: "cancelled",
                cancelledAt: new Date(),
                cancelReason: refundReason || "订单退款（余额不足，需人工处理）"
              }
            })

            // 创建安全警报
            await tx.securityAlert.create({
              data: {
                type: "REFUND_COMMISSION_SHORTAGE",
                severity: "high",
                userId: distributor.userId,
                description: `订单退款但分销商余额不足以扣除佣金。订单号: ${order.orderNumber}, 佣金: ¥${distributionOrder.commissionAmount}, 当前余额: ¥${distributor.availableBalance}`,
                metadata: JSON.stringify({
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  distributorId: distributor.id,
                  commissionAmount: distributionOrder.commissionAmount,
                  currentBalance: distributor.availableBalance,
                  shortage: distributionOrder.commissionAmount - distributor.availableBalance
                }),
                status: "pending"
              }
            })

            console.warn(`⚠️ 分销商余额不足，无法扣除佣金，已创建警报`)
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "订单退款成功",
      orderNumber: order.orderNumber
    })

  } catch (error: any) {
    console.error("订单退款失败:", error)
    return NextResponse.json(
      {
        success: false,
        error: "订单退款失败",
        message: error.message
      },
      { status: 500 }
    )
  }
}
