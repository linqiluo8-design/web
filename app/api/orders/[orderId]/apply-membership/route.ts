import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const applyMembershipSchema = z.object({
  membershipCode: z.string().min(1, "请输入会员码"),
})

// 为待支付订单应用会员码优惠
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const body = await req.json()
    const { membershipCode } = applyMembershipSchema.parse(body)

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true
          }
        },
        membership: true
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: "订单不存在" },
        { status: 404 }
      )
    }

    // 只有待支付订单可以应用会员码
    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "只有待支付订单可以应用会员码" },
        { status: 400 }
      )
    }

    // 如果订单已经应用了会员码，不允许再次应用
    if (order.membershipId) {
      return NextResponse.json(
        { error: "此订单已应用会员码，不能重复使用" },
        { status: 400 }
      )
    }

    // 验证会员码
    const membership = await prisma.membership.findUnique({
      where: { membershipCode: membershipCode.toUpperCase() }
    })

    if (!membership) {
      return NextResponse.json(
        { error: "会员码不存在" },
        { status: 400 }
      )
    }

    // 检查会员是否过期
    if (membership.endDate && new Date() > membership.endDate) {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: "expired" }
      })
      return NextResponse.json(
        { error: "会员已过期" },
        { status: 400 }
      )
    }

    if (membership.status !== "active") {
      return NextResponse.json(
        { error: "会员已失效" },
        { status: 400 }
      )
    }

    // 检查今日使用次数
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let usageRecord = await prisma.membershipUsage.findUnique({
      where: {
        membershipId_usageDate: {
          membershipId: membership.id,
          usageDate: today
        }
      }
    })

    const todayUsed = usageRecord?.count || 0
    const remainingToday = Math.max(0, membership.dailyLimit - todayUsed)

    if (remainingToday === 0) {
      return NextResponse.json(
        { error: "今日会员优惠次数已用完" },
        { status: 400 }
      )
    }

    // 计算可以享受折扣的商品数量
    const totalItems = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
    const discountableCount = Math.min(totalItems, remainingToday)

    // 计算原价
    const originalAmount = order.orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )

    // 计算折扣金额
    let remaining = discountableCount
    let discountAmount = 0

    for (const item of order.orderItems) {
      if (remaining <= 0) break
      const itemCount = Math.min(item.quantity, remaining)
      discountAmount += item.price * itemCount * (1 - membership.discount)
      remaining -= itemCount
    }

    const newTotalAmount = originalAmount - discountAmount

    // 更新订单
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        membershipId: membership.id,
        originalAmount,
        discount: membership.discount,
        totalAmount: newTotalAmount
      },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                coverImage: true,
              }
            }
          }
        }
      }
    })

    // 更新会员使用次数
    if (usageRecord) {
      await prisma.membershipUsage.update({
        where: { id: usageRecord.id },
        data: { count: usageRecord.count + discountableCount }
      })
    } else {
      await prisma.membershipUsage.create({
        data: {
          membershipId: membership.id,
          usageDate: today,
          count: discountableCount
        }
      })
    }

    return NextResponse.json({
      order: updatedOrder,
      appliedDiscount: {
        discount: membership.discount,
        originalAmount,
        finalAmount: newTotalAmount,
        saved: originalAmount - newTotalAmount,
        discountableCount
      },
      message: "会员码应用成功"
    })

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("应用会员码失败:", error)
    return NextResponse.json(
      { error: "应用会员码失败" },
      { status: 500 }
    )
  }
}
