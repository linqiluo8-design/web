import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { withRateLimit, RateLimitPresets } from "@/lib/rate-limit"

const paymentSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["alipay", "wechat", "paypal"])
})

// 获取系统配置
async function getSystemConfig(key: string, defaultValue: string = ""): Promise<string> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key }
    })
    return config?.value || defaultValue
  } catch (error) {
    console.error(`获取配置 ${key} 失败:`, error)
    return defaultValue
  }
}

export async function POST(request: Request) {
  // 应用速率限制：每分钟最多 10 次支付请求
  return withRateLimit(request, RateLimitPresets.ORDER, async () => {
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

      // 安全检查：验证金额是否与订单匹配（允许0.01的浮点误差）
      const amountDiff = Math.abs(order.totalAmount - data.amount)
      if (amountDiff > 0.01) {
        console.error('[SECURITY] 支付金额不匹配:', {
          orderId: order.id,
          orderAmount: order.totalAmount,
          requestAmount: data.amount,
          diff: amountDiff
        })
        return NextResponse.json({ error: "支付金额与订单不匹配" }, { status: 400 })
      }

    // 获取支付模式配置
    const paymentMode = await getSystemConfig("payment_mode", "mock")

    // 检查支付方式是否启用
    const providerEnabled = await getSystemConfig(`payment_${data.paymentMethod}_enabled`, "true")
    if (providerEnabled !== "true") {
      return NextResponse.json(
        { error: "该支付方式暂未开放" },
        { status: 400 }
      )
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

    // 根据支付模式返回不同的支付链接
    if (paymentMode === "mock") {
      // 模拟支付模式
      if (data.paymentMethod === "alipay") {
        return NextResponse.json({
          paymentId: payment.id,
          payUrl: `/api/payment/mock?paymentId=${payment.id}&orderNumber=${order.orderNumber}&method=alipay&amount=${data.amount}`,
          mode: "mock"
        })
      } else if (data.paymentMethod === "wechat") {
        return NextResponse.json({
          paymentId: payment.id,
          payUrl: `/api/payment/mock?paymentId=${payment.id}&orderNumber=${order.orderNumber}&method=wechat&amount=${data.amount}`,
          mode: "mock"
        })
      } else if (data.paymentMethod === "paypal") {
        return NextResponse.json({
          paymentId: payment.id,
          approvalUrl: `/api/payment/mock?paymentId=${payment.id}&orderNumber=${order.orderNumber}&method=paypal&amount=${data.amount}`,
          mode: "mock"
        })
      }
    } else {
      // 真实支付模式
      // TODO: 这里需要集成真实的支付接口
      // 目前先返回错误提示
      return NextResponse.json({
        error: "真实支付功能暂未实现，请先配置支付商户信息",
        message: "请在后台管理中配置支付宝、微信、PayPal的商户信息后再使用真实支付模式"
      }, { status: 501 })

      // 未来的实现示例：
      // if (data.paymentMethod === "alipay") {
      //   const alipayResult = await createAlipayOrder({...})
      //   return NextResponse.json({
      //     paymentId: payment.id,
      //     payUrl: alipayResult.paymentUrl,
      //     mode: "real"
      //   })
      // }
    }

    return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 })

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "请求数据格式错误", details: error.errors }, { status: 400 })
    }
    console.error("创建支付失败:", error)
    return NextResponse.json({ error: "创建支付失败" }, { status: 500 })
  }
  })
}
