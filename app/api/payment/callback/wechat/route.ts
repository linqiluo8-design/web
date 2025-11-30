import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyWechatCallback } from "@/lib/payment/wechat"

/**
 * 微信支付回调处理
 */
export async function POST(req: Request) {
  try {
    const body = await req.text()
    const headers = req.headers

    const timestamp = headers.get("wechatpay-timestamp") || ""
    const nonce = headers.get("wechatpay-nonce") || ""
    const signature = headers.get("wechatpay-signature") || ""
    const serial = headers.get("wechatpay-serial") || ""

    console.log("微信支付回调")

    // 验证签名
    const isValid = verifyWechatCallback(timestamp, nonce, body, signature, serial)
    if (!isValid) {
      console.error("微信支付签名验证失败")
      return NextResponse.json(
        { code: "FAIL", message: "签名验证失败" },
        { status: 400 }
      )
    }

    const data = JSON.parse(body)
    const { resource } = data

    // 解密资源数据（需要实现解密逻辑）
    // 这里简化处理，实际应该解密resource.ciphertext
    const {
      out_trade_no: orderNumber,
      transaction_id: transactionId,
      trade_state: tradeState,
      amount,
    } = resource

    // 查找订单
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { payment: true },
    })

    if (!order) {
      console.error("订单不存在:", orderNumber)
      return NextResponse.json(
        { code: "FAIL", message: "订单不存在" },
        { status: 404 }
      )
    }

    // 支付成功
    if (tradeState === "SUCCESS") {
      // 更新支付记录
      if (order.payment) {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            status: "completed",
            transactionId,
            paymentData: JSON.stringify(resource),
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

      console.log("微信支付成功:", orderNumber)
      return NextResponse.json({ code: "SUCCESS", message: "成功" })
    }

    // 其他状态
    return NextResponse.json({ code: "SUCCESS", message: "成功" })

  } catch (error) {
    console.error("处理微信支付回调失败:", error)
    return NextResponse.json(
      { code: "FAIL", message: "处理失败" },
      { status: 500 }
    )
  }
}
