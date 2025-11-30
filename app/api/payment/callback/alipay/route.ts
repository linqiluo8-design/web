import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAlipayCallback } from "@/lib/payment/alipay"

/**
 * 支付宝支付回调处理
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const params: any = {}
    
    formData.forEach((value, key) => {
      params[key] = value
    })

    console.log("支付宝回调参数:", params)

    // 验证签名
    const isValid = verifyAlipayCallback(params)
    if (!isValid) {
      console.error("支付宝签名验证失败")
      return new Response("fail", { status: 400 })
    }

    const {
      out_trade_no: orderNumber,
      trade_no: transactionId,
      trade_status: tradeStatus,
      total_amount: totalAmount,
    } = params

    // 查找订单
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { payment: true },
    })

    if (!order) {
      console.error("订单不存在:", orderNumber)
      return new Response("fail", { status: 404 })
    }

    // 支付成功
    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
      // 更新支付记录
      if (order.payment) {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            status: "completed",
            transactionId,
            paymentData: JSON.stringify(params),
          },
        })
      }

      // 更新订单状态
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "paid" },
      })

      // 处理分销佣金结算
      if (order.distributorId) {
        try {
          // 查找分销订单记录
          const distributionOrder = await prisma.distributionOrder.findUnique({
            where: { orderId: order.id }
          })

          if (distributionOrder && distributionOrder.status === "pending") {
            // 更新分销订单状态为已确认，并立即结算
            await prisma.distributionOrder.update({
              where: { id: distributionOrder.id },
              data: {
                status: "settled",
                confirmedAt: new Date(),
                settledAt: new Date()
              }
            })

            // 更新分销商余额和收益统计
            await prisma.distributor.update({
              where: { id: order.distributorId },
              data: {
                totalEarnings: { increment: distributionOrder.commissionAmount },
                availableBalance: { increment: distributionOrder.commissionAmount }
              }
            })

            console.log("分销佣金已结算:", {
              orderId: order.id,
              distributorId: order.distributorId,
              commissionAmount: distributionOrder.commissionAmount
            })
          }
        } catch (error) {
          console.error("处理分销佣金结算失败:", error)
          // 不影响支付回调的成功响应
        }
      }

      console.log("支付宝支付成功:", orderNumber)
      return new Response("success", { status: 200 })
    }

    // 支付失败或其他状态
    if (tradeStatus === "TRADE_CLOSED") {
      if (order.payment) {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            status: "failed",
            paymentData: JSON.stringify(params),
          },
        })
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { status: "cancelled" },
      })
    }

    return new Response("success", { status: 200 })

  } catch (error) {
    console.error("处理支付宝回调失败:", error)
    return new Response("fail", { status: 500 })
  }
}

// 支持GET请求（页面跳转回调）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const params: any = {}
    
    searchParams.forEach((value, key) => {
      params[key] = value
    })

    // 验证签名
    const isValid = verifyAlipayCallback(params)
    if (!isValid) {
      return NextResponse.redirect(new URL("/payment/failed", req.url))
    }

    const orderNumber = params.out_trade_no
    
    // 重定向到支付成功页面
    return NextResponse.redirect(
      new URL(`/payment/success?orderNumber=${orderNumber}`, req.url)
    )

  } catch (error) {
    console.error("处理支付宝页面回调失败:", error)
    return NextResponse.redirect(new URL("/payment/failed", req.url))
  }
}
