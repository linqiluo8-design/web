import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { capturePayPalOrder, queryPayPalOrder } from "@/lib/payment/paypal"

/**
 * PayPal支付回调处理（页面跳转回调）
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token") // PayPal订单ID
    const payerId = searchParams.get("PayerID")
    const success = searchParams.get("success")

    if (success === "false") {
      return NextResponse.redirect(new URL("/payment/failed", req.url))
    }

    if (!token) {
      return NextResponse.redirect(new URL("/payment/failed", req.url))
    }

    // 查询PayPal订单信息
    const queryResult = await queryPayPalOrder(token)
    if (!queryResult.success || !queryResult.data) {
      return NextResponse.redirect(new URL("/payment/failed", req.url))
    }

    const orderNumber = queryResult.data.purchase_units?.[0]?.reference_id

    if (!orderNumber) {
      return NextResponse.redirect(new URL("/payment/failed", req.url))
    }

    // 捕获支付
    const captureResult = await capturePayPalOrder(token)
    if (!captureResult.success) {
      console.error("捕获PayPal支付失败")
      return NextResponse.redirect(new URL("/payment/failed", req.url))
    }

    // 查找订单
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { payment: true },
    })

    if (!order) {
      return NextResponse.redirect(new URL("/payment/failed", req.url))
    }

    // 更新支付记录
    if (order.payment) {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          status: "completed",
          transactionId: token,
          paymentData: JSON.stringify(captureResult.data),
        },
      })
    }

    // 更新订单状态
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "paid" },
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

    console.log("PayPal支付成功:", orderNumber)

    // 重定向到支付成功页面
    return NextResponse.redirect(
      new URL(`/payment/success?orderNumber=${orderNumber}`, req.url)
    )

  } catch (error) {
    console.error("处理PayPal回调失败:", error)
    return NextResponse.redirect(new URL("/payment/failed", req.url))
  }
}
