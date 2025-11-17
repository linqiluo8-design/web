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

    const order = await prisma.order.findUnique({
      where: { id: data.orderId }
    })

    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 })
    }

    if (order.status !== "pending") {
      return NextResponse.json({ error: "订单状态不正确" }, { status: 400 })
    }

    // 检查是否已有支付记录
    let payment = await prisma.payment.findUnique({
      where: { orderId: order.id }
    })

    // 如果已有支付记录，更新支付方式；否则创建新记录
    if (payment) {
      // 更新现有支付记录
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          paymentMethod: data.paymentMethod,
          amount: data.amount,
          status: "pending"
        }
      })
    } else {
      // 创建新支付记录
      payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          paymentMethod: data.paymentMethod,
          amount: data.amount,
          currency: "CNY",
          status: "pending"
        }
      })
    }

    if (data.paymentMethod === "alipay") {
      return NextResponse.json({
        paymentId: payment.id,
        payUrl: `/api/payment/mock?paymentId=${payment.id}&orderNumber=${order.orderNumber}&method=alipay&amount=${data.amount}`
      })
    } else if (data.paymentMethod === "wechat") {
      return NextResponse.json({
        paymentId: payment.id,
        payUrl: `/api/payment/mock?paymentId=${payment.id}&orderNumber=${order.orderNumber}&method=wechat&amount=${data.amount}`
      })
    } else if (data.paymentMethod === "paypal") {
      return NextResponse.json({
        paymentId: payment.id,
        approvalUrl: `/api/payment/mock?paymentId=${payment.id}&orderNumber=${order.orderNumber}&method=paypal&amount=${data.amount}`
      })
    }

    return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 })

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "请求数据格式错误", details: error.errors }, { status: 400 })
    }
    console.error("创建支付失败:", error)
    return NextResponse.json({ error: "创建支付失败" }, { status: 500 })
  }
}
