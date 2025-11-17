import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

    // 更新会员记录的支付方式
    await prisma.membership.update({
      where: { id: membershipId },
      data: {
        paymentMethod: paymentMethod
      }
    })

    // 获取支付模式配置
    const paymentMode = await getSystemConfig("payment_mode", "mock")

    // 检查支付方式是否启用
    const providerEnabled = await getSystemConfig(`payment_${paymentMethod}_enabled`, "true")
    if (providerEnabled !== "true") {
      return NextResponse.json(
        { error: "该支付方式暂未开放" },
        { status: 400 }
      )
    }

    // 根据支付模式返回不同的支付链接
    if (paymentMode === "mock") {
      // 模拟支付模式
      if (paymentMethod === "alipay" || paymentMethod === "wechat" || paymentMethod === "paypal") {
        return NextResponse.json({
          success: true,
          payUrl: `/api/payment/mock-membership?membershipId=${membershipId}&method=${paymentMethod}&amount=${amount}`,
          mode: "mock"
        })
      }
    } else {
      // 真实支付模式
      return NextResponse.json({
        error: "真实支付功能暂未实现，请先配置支付商户信息",
        message: "请在后台管理中配置支付宝、微信、PayPal的商户信息后再使用真实支付模式"
      }, { status: 501 })
    }

    return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 })
  } catch (error) {
    console.error("创建会员支付失败:", error)
    return NextResponse.json({ error: "创建支付失败" }, { status: 500 })
  }
}
