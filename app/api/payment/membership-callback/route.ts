import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST /api/payment/membership-callback - 会员支付回调
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { membershipId, membershipCode, status } = body

    if (!membershipId || !membershipCode || !status) {
      return NextResponse.json(
        { error: "参数缺失" },
        { status: 400 }
      )
    }

    // 查找会员记录
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId }
    })

    if (!membership) {
      return NextResponse.json(
        { error: "会员记录不存在" },
        { status: 404 }
      )
    }

    // 验证会员码匹配
    if (membership.membershipCode !== membershipCode) {
      return NextResponse.json(
        { error: "会员码不匹配" },
        { status: 400 }
      )
    }

    // 更新支付状态
    if (status === "success") {
      // 生成订单号
      const orderNumber = `MEM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

      await prisma.membership.update({
        where: { id: membershipId },
        data: {
          paymentStatus: "completed",
          orderNumber: orderNumber
        }
      })

      return NextResponse.json({
        success: true,
        message: "支付成功",
        orderNumber: orderNumber
      })
    } else {
      // 支付失败
      await prisma.membership.update({
        where: { id: membershipId },
        data: {
          paymentStatus: "failed"
        }
      })

      return NextResponse.json({
        success: false,
        message: "支付失败"
      })
    }

  } catch (error: any) {
    console.error("会员支付回调处理失败:", error)
    return NextResponse.json(
      { error: "支付回调处理失败" },
      { status: 500 }
    )
  }
}
