import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const paymentSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["alipay", "wechat", "paypal"])
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = paymentSchema.parse(body)

    // 验证订单是否存在且待支付
    const order = await prisma.order.findUnique({
      where: { id: data.orderId }
    })

    if (!order) {
      return NextResponse.json(
        { error: "订单不存在" },
        { status: 404 }
      )
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "订单状态不正确" },
        { status: 400 }
      )
    }

    // 创建支付记录
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: data.paymentMethod,
        amount: data.amount,
        currency: "CNY",
        status: "pending"
      }
    })

    // 根据不同支付方式返回不同数据
    if (data.paymentMethod === "alipay") {
      // 支付宝支付 - 生产环境需要调用支付宝SDK
      return NextResponse.json({
        paymentId: payment.id,
        payUrl: `/api/payment/mock?paymentId=${payment.id}&orderNumber=${order.orderNumber}&method=alipay&amount=${data.amount}`
      })
    } else if (data.paymentMethod === "wechat") {
      // 微信支付 - 生产环境需要调用微信SDK
      return NextResponse.json({
        paymentId: payment.id,
        qrCode: `weixin://pay/${payment.id}`
      })
    } else if (data.paymentMethod === "paypal") {
      // PayPal支付 - 生产环境需要调用PayPal SDK
      return NextResponse.json({
        paymentId: payment.id,
        approvalUrl: `/api/payment/mock?paymentId=${payment.id}&orderNumber=${order.orderNumber}&method=paypal&amount=${data.amount}`
      })
    }

    return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 })

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "请求数据格式错误", details: error.errors },
        { status: 400 }
      )
    }

    console.error("创建支付失败:", error)
    return NextResponse.json(
      { error: "创建支付失败" },
      { status: 500 }
    )
  }
}
