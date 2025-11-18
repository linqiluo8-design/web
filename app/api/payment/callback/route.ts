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

      await prisma.$transaction([
        // 更新支付记录
        prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: "completed",
            transactionId
          }
        }),
        // 更新订单状态
        prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: "paid",
            paymentMethod: payment.paymentMethod,
            expiresAt: null // 支付成功后清除过期时间
          }
        })
      ])

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
