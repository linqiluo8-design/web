import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, extractRequestInfo } from "@/lib/logger"

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

      // 记录会员购买成功日志
      const requestInfo = extractRequestInfo(request)
      await logger.info({
        category: 'payment',
        action: 'membership_purchased',
        message: `会员购买成功 - ${membershipCode}`,
        userId: membership.userId || undefined,
        ...requestInfo,
        statusCode: 200,
        metadata: {
          membershipId: membership.id,
          membershipCode: membershipCode,
          orderNumber: orderNumber,
          planId: membership.planId,
          purchasePrice: membership.purchasePrice,
          discount: membership.discount,
          duration: membership.duration
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

      // 记录会员购买失败日志
      const requestInfo = extractRequestInfo(request)
      await logger.warn({
        category: 'payment',
        action: 'membership_payment_failed',
        message: `会员支付失败 - ${membershipCode}`,
        userId: membership.userId || undefined,
        ...requestInfo,
        statusCode: 200,
        metadata: {
          membershipId: membership.id,
          membershipCode: membershipCode,
          planId: membership.planId,
          purchasePrice: membership.purchasePrice
        }
      })

      return NextResponse.json({
        success: false,
        message: "支付失败"
      })
    }

  } catch (error: any) {
    // 记录错误日志
    const requestInfo = extractRequestInfo(request)
    await logger.error({
      category: 'payment',
      action: 'membership_callback_error',
      message: `会员支付回调处理失败: ${error.message}`,
      ...requestInfo,
      statusCode: 500,
      error: error,
      metadata: {
        membershipId: body?.membershipId,
        membershipCode: body?.membershipCode,
        status: body?.status
      }
    })

    console.error("会员支付回调处理失败:", error)
    return NextResponse.json(
      { error: "支付回调处理失败" },
      { status: 500 }
    )
  }
}
