import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"
import { createAlipayOrder } from "@/lib/payment/alipay"
import { createWechatOrder } from "@/lib/payment/wechat"
import { createPayPalOrder } from "@/lib/payment/paypal"

const createPaymentSchema = z.object({
  orderId: z.string(),
  paymentMethod: z.enum(["alipay", "wechat", "paypal"]),
})

/**
 * 创建支付订单
 */
export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { orderId, paymentMethod } = createPaymentSchema.parse(body)

    // 获取订单信息
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "订单不存在" },
        { status: 404 }
      )
    }

    // 验证订单归属
    if (order.userId !== user.id) {
      return NextResponse.json(
        { error: "无权操作此订单" },
        { status: 403 }
      )
    }

    // 检查订单状态
    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "订单状态不正确" },
        { status: 400 }
      )
    }

    // 准备支付参数
    const subject = order.orderItems.map(item => item.product.title).join(", ")
    const description = `订单号: ${order.orderNumber}`

    let paymentResult: any

    // 根据支付方式创建支付订单
    switch (paymentMethod) {
      case "alipay":
        paymentResult = await createAlipayOrder({
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          subject,
          body: description,
        })
        break

      case "wechat":
        paymentResult = await createWechatOrder({
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          description: subject,
        })
        break

      case "paypal":
        // PayPal使用美元，这里简单除以汇率（实际应该用实时汇率）
        const usdAmount = order.totalAmount / 6.5
        paymentResult = await createPayPalOrder({
          orderNumber: order.orderNumber,
          totalAmount: usdAmount,
          description: subject,
          currency: "USD",
        })
        break

      default:
        return NextResponse.json(
          { error: "不支持的支付方式" },
          { status: 400 }
        )
    }

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || "创建支付订单失败" },
        { status: 500 }
      )
    }

    // 创建支付记录
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod,
        amount: order.totalAmount,
        currency: paymentMethod === "paypal" ? "USD" : "CNY",
        status: "pending",
        transactionId: paymentResult.orderId || null,
        paymentData: JSON.stringify(paymentResult.data || {}),
      },
    })

    // 更新订单支付方式
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod },
    })

    return NextResponse.json({
      payment,
      paymentUrl: paymentResult.paymentUrl,
      message: "支付订单创建成功",
    })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("创建支付订单失败:", error)
    return NextResponse.json(
      { error: "创建支付订单失败" },
      { status: 500 }
    )
  }
}
