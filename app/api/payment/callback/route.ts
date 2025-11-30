import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { paymentId, orderNumber, status } = body

    if (!paymentId || !orderNumber || !status) {
      return NextResponse.json(
        { error: "参数缺失" },
        { status: 400 }
      )
    }

    // 查找支付记录
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true }
    })

    if (!payment) {
      return NextResponse.json(
        { error: "支付记录不存在" },
        { status: 404 }
      )
    }

    // 验证订单号匹配
    if (payment.order.orderNumber !== orderNumber) {
      return NextResponse.json(
        { error: "订单号不匹配" },
        { status: 400 }
      )
    }

    // 更新支付状态
    if (status === "success") {
      const transactionId = `MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 更新支付记录
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "completed",
          transactionId
        }
      })

      // 更新订单状态
      const order = await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: "paid",
          paymentMethod: payment.paymentMethod,
          expiresAt: null // 支付成功后清除过期时间
        }
      })

      // 处理分销佣金（进入冷静期，暂不结算）
      if (order.distributorId) {
        try {
          // 查找分销订单记录
          const distributionOrder = await prisma.distributionOrder.findUnique({
            where: { orderId: order.id }
          })

          if (distributionOrder && distributionOrder.status === "pending") {
            // 更新分销订单状态为已确认（confirmed），但不结算（settled）
            // 需要等待冷静期（默认15天）后才会自动结算
            await prisma.distributionOrder.update({
              where: { id: distributionOrder.id },
              data: {
                status: "confirmed",
                confirmedAt: new Date()
                // 注意：不设置 settledAt，等待冷静期后才结算
              }
            })

            // 更新分销商统计：增加总收益和待结算佣金（pendingCommission）
            // 不增加 availableBalance（可提现余额），防止立即提现后用户退款的风险
            await prisma.distributor.update({
              where: { id: order.distributorId },
              data: {
                totalEarnings: { increment: distributionOrder.commissionAmount },
                pendingCommission: { increment: distributionOrder.commissionAmount }
              }
            })

            console.log("分销佣金已确认，进入结算冷静期:", {
              orderId: order.id,
              distributorId: order.distributorId,
              commissionAmount: distributionOrder.commissionAmount,
              status: "confirmed"
            })
          }
        } catch (error) {
          console.error("处理分销佣金确认失败:", error)
          // 不影响支付回调的成功响应
        }
      }

      return NextResponse.json({
        success: true,
        message: "支付成功"
      })
    } else {
      // 支付失败
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: "failed" }
      })

      return NextResponse.json({
        success: false,
        message: "支付失败"
      })
    }

  } catch (error: any) {
    console.error("支付回调处理失败:", error)
    return NextResponse.json(
      { error: "支付回调处理失败" },
      { status: 500 }
    )
  }
}
