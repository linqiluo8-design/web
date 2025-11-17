import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// POST /api/memberships/purchase - 购买会员
export async function POST(request: Request) {
  try {
    // 获取当前用户session（支持匿名购买，所以不强制要求登录）
    const session = await getServerSession(authOptions)
    let userId: string | null = null

    // 如果有session，验证用户是否存在
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      })
      // 只有用户存在时才关联userId
      if (user) {
        userId = user.id
      }
    }

    const { planId } = await request.json()

    if (!planId) {
      return NextResponse.json({ error: "请选择会员方案" }, { status: 400 })
    }

    // 获取会员方案
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId }
    })

    if (!plan || plan.status !== "active") {
      return NextResponse.json({ error: "会员方案不存在或已停用" }, { status: 400 })
    }

    // 生成唯一会员码（SHA256哈希）
    const randomString = `${Date.now()}-${Math.random()}-${planId}`
    const membershipCode = crypto
      .createHash('sha256')
      .update(randomString)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase()

    // 计算过期时间
    const endDate = plan.duration === -1
      ? null
      : new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000)

    // 保存方案快照
    const planSnapshot = JSON.stringify({
      name: plan.name,
      price: plan.price,
      duration: plan.duration,
      discount: plan.discount,
      dailyLimit: plan.dailyLimit
    })

    // 创建会员记录
    const membership = await prisma.membership.create({
      data: {
        userId,  // 记录购买用户ID（可为null，支持匿名）
        membershipCode,
        planId: plan.id,
        planSnapshot,
        purchasePrice: plan.price,
        discount: plan.discount,
        dailyLimit: plan.dailyLimit,
        duration: plan.duration,
        endDate,
        status: "active",
        paymentStatus: "pending"  // 初始状态为待支付
      }
    })

    return NextResponse.json({
      membership: {
        id: membership.id,
        membershipCode: membership.membershipCode,
        price: membership.purchasePrice,
        endDate: membership.endDate
      },
      redirectUrl: `/payment/membership/${membership.id}`
    })
  } catch (error) {
    console.error("购买会员失败:", error)
    return NextResponse.json({ error: "购买会员失败" }, { status: 500 })
  }
}
