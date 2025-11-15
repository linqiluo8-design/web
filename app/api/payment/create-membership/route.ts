import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST /api/payment/create-membership - 创建会员支付订单
export async function POST(request: Request) {
  try {
    const { membershipId, amount, paymentMethod } = await request.json()

    if (!membershipId || !amount || !paymentMethod) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 })
    }

    // 验证会员订单是否存在
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId }
    })

    if (!membership) {
      return NextResponse.json({ error: "会员订单不存在" }, { status: 404 })
    }

    // 模拟支付处理
    // 实际项目中，这里应该调用支付宝、微信、PayPal等第三方支付API

    if (paymentMethod === "alipay") {
      // 支付宝支付（演示）
      return NextResponse.json({
        success: true,
        payUrl: `https://mock-alipay.com/pay?amount=${amount}&membershipId=${membershipId}`
      })
    } else if (paymentMethod === "wechat") {
      // 微信支付（演示）
      return NextResponse.json({
        success: true,
        qrCode: `https://mock-wechat-qr.com/${membershipId}`
      })
    } else if (paymentMethod === "paypal") {
      // PayPal支付（演示）
      return NextResponse.json({
        success: true,
        approvalUrl: `https://mock-paypal.com/checkout?membershipId=${membershipId}&amount=${amount}`
      })
    }

    return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 })
  } catch (error) {
    console.error("创建会员支付失败:", error)
    return NextResponse.json({ error: "创建支付失败" }, { status: 500 })
  }
}
