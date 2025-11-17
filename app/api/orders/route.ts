import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"
import crypto from "crypto"

const createOrderSchema = z.object({
  // 订单项列表（匿名购物车）
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive()
  })).min(1, "订单至少需要一个商品"),
  // 支付方式（暂时可选，创建订单后选择）
  paymentMethod: z.enum(["alipay", "wechat", "paypal"]).optional(),
  // 会员码（可选）
  membershipCode: z.string().optional(),
})

// 生成安全的唯一订单号
function generateOrderNumber(): string {
  const timestamp = Date.now().toString()
  const randomBytes = crypto.randomBytes(6).toString('hex').toUpperCase()
  return `ORD${timestamp}${randomBytes}`
}

// 获取用户订单列表（支持分页和搜索）
export async function GET(req: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)

    // 分页参数
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    // 搜索参数
    const search = searchParams.get("search") // 订单号搜索
    const status = searchParams.get("status") // 状态筛选

    // 构建查询条件
    const where: any = { userId: user.id }

    if (search) {
      where.orderNumber = { contains: search }
    }

    if (status && status !== "all") {
      where.status = status
    }

    // 查询订单和总数
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
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
          },
          payment: true,
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.order.count({ where })
    ])

    return NextResponse.json({
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("获取订单列表失败:", error)
    return NextResponse.json(
      { error: "获取订单列表失败" },
      { status: 500 }
    )
  }
}

// 创建订单（匿名购物）
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = createOrderSchema.parse(body)

    let originalAmount = 0
    let totalAmount = 0
    let membership = null
    let membershipDiscount = null

    // 验证所有商品是否存在且可用，计算原价
    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      })

      if (!product || product.status !== "active") {
        return NextResponse.json(
          { error: `商品不存在或已下架` },
          { status: 404 }
        )
      }

      // 验证价格是否匹配（防止客户端篡改价格）
      if (Math.abs(product.price - item.price) > 0.01) {
        return NextResponse.json(
          { error: `商品价格已变更，请刷新页面` },
          { status: 400 }
        )
      }

      originalAmount += item.price * item.quantity
    }

    // 如果提供了会员码，验证并应用折扣
    if (data.membershipCode) {
      membership = await prisma.membership.findUnique({
        where: { membershipCode: data.membershipCode.toUpperCase() }
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
      const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0)
      const discountableCount = Math.min(totalItems, remainingToday)

      // 计算折扣金额
      let remaining = discountableCount
      let discountAmount = 0

      for (const item of data.items) {
        if (remaining <= 0) break
        const itemCount = Math.min(item.quantity, remaining)
        discountAmount += item.price * itemCount * (1 - membership.discount)
        remaining -= itemCount
      }

      totalAmount = originalAmount - discountAmount
      membershipDiscount = membership.discount

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
    } else {
      totalAmount = originalAmount
    }

    // 安全检查：检测价格篡改攻击
    // 区分两种情况：
    // 1. 商品原价就是0元（合法的免费商品） - 允许
    // 2. 商品原价 > 0 但被折扣/篡改成0元（攻击） - 拦截并记录
    if (originalAmount > 0.01 && totalAmount <= 0.01) {
      // 这是价格篡改攻击：原价大于0，但折后价变成了0或负数
      try {
        await prisma.securityAlert.create({
          data: {
            type: "PRICE_MANIPULATION",
            severity: "high",
            userId: null, // 匿名订单暂无userId
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            description: `检测到价格篡改攻击：商品原价${originalAmount}元，被异常折扣至${totalAmount}元`,
            metadata: JSON.stringify({
              originalAmount,
              totalAmount,
              discount: membershipDiscount,
              membershipCode: data.membershipCode,
              items: data.items,
              timestamp: new Date().toISOString()
            }),
            status: "unresolved"
          }
        })
      } catch (alertError) {
        console.error("创建安全警报失败:", alertError)
      }

      return NextResponse.json(
        {
          error: "订单金额异常",
          message: "检测到订单金额异常，系统已记录此行为并通知管理员。如果您认为这是一个错误，请联系客服。",
          code: "PRICE_MANIPULATION"
        },
        { status: 400 }
      )
    }

    // 如果 originalAmount <= 0.01 且 totalAmount <= 0.01，说明是管理员上架的合法0元商品，允许创建订单

    // 生成安全的唯一订单号
    const orderNumber = generateOrderNumber()

    // 创建订单
    const order = await prisma.order.create({
      data: {
        orderNumber,
        totalAmount,
        originalAmount: membership ? originalAmount : null,
        discount: membershipDiscount,
        membershipId: membership?.id,
        status: "pending",
        paymentMethod: data.paymentMethod,
        orderItems: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          }))
        }
      },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                coverImage: true,
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      order,
      orderNumber,
      message: "订单创建成功",
      appliedDiscount: membership ? {
        discount: membershipDiscount,
        originalAmount,
        finalAmount: totalAmount,
        saved: originalAmount - totalAmount
      } : null
    }, { status: 201 })

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("创建订单失败:", error)
    return NextResponse.json(
      { error: "创建订单失败" },
      { status: 500 }
    )
  }
}
