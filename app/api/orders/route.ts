import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"
import crypto from "crypto"

const createOrderSchema = z.object({
  // 订单项列表（匿名购物车）
  // 安全改进：移除 price 参数，价格完全由服务器从数据库查询决定
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive()
  })).min(1, "订单至少需要一个商品"),
  // 支付方式（暂时可选，创建订单后选择）
  paymentMethod: z.enum(["alipay", "wechat", "paypal"]).optional(),
  // 会员码（可选）
  membershipCode: z.string().optional(),
  // 分销码（可选）
  referralCode: z.string().optional(),
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
    let distributor = null

    // 安全检查：订单项数量限制
    if (data.items.length > 100) {
      try {
        await prisma.securityAlert.create({
          data: {
            type: "EXCESSIVE_ORDER_ITEMS",
            severity: "medium",
            userId: null,
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            description: `检测到异常订单项数量：订单包含${data.items.length}种商品`,
            metadata: JSON.stringify({
              itemCount: data.items.length,
              items: data.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
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
          error: "订单商品数量异常",
          message: "单个订单最多支持100种不同商品。",
          code: "EXCESSIVE_ORDER_ITEMS"
        },
        { status: 400 }
      )
    }

    // 验证所有商品是否存在且可用，计算原价
    // 安全改进：价格完全从数据库查询，不信任客户端传来的任何价格数据
    const validatedItems: Array<{ productId: string; quantity: number; price: number }> = []

    for (const item of data.items) {
      // 安全检查：商品数量上限
      if (item.quantity > 10000) {
        try {
          await prisma.securityAlert.create({
            data: {
              type: "EXCESSIVE_QUANTITY",
              severity: "high",
              userId: null,
              ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
              userAgent: req.headers.get("user-agent") || "unknown",
              description: `检测到异常商品数量：商品${item.productId}数量为${item.quantity}`,
              metadata: JSON.stringify({
                productId: item.productId,
                quantity: item.quantity,
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
            error: "商品数量异常",
            message: "单个商品数量不能超过10000件。",
            code: "EXCESSIVE_QUANTITY"
          },
          { status: 400 }
        )
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      })

      if (!product || product.status !== "active") {
        return NextResponse.json(
          { error: `商品不存在或已下架` },
          { status: 404 }
        )
      }

      // 使用数据库中的价格（完全不信任客户端）
      const serverPrice = product.price
      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: serverPrice  // 使用服务器价格
      })

      originalAmount += serverPrice * item.quantity
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

      // 安全检查：验证折扣率是否在合法范围内（0-1之间）
      if (membership.discount < 0 || membership.discount > 1) {
        // 记录安全警报：检测到异常的会员折扣率
        try {
          await prisma.securityAlert.create({
            data: {
              type: "INVALID_DISCOUNT_RATE",
              severity: "critical",
              userId: null,
              ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
              userAgent: req.headers.get("user-agent") || "unknown",
              description: `检测到异常的会员折扣率：会员码${membership.membershipCode}的折扣率为${membership.discount}（合法范围：0-1）`,
              metadata: JSON.stringify({
                membershipCode: membership.membershipCode,
                membershipId: membership.id,
                invalidDiscount: membership.discount,
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
            error: "会员码数据异常",
            message: "检测到会员码数据异常，系统已记录此问题并通知管理员。请联系客服处理。",
            code: "INVALID_DISCOUNT_RATE"
          },
          { status: 400 }
        )
      }

      // 安全检查：会员有效期异常检测
      if (membership.endDate) {
        const now = new Date()
        const endDate = new Date(membership.endDate)
        const daysUntilExpiry = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

        // 检查是否过期
        if (now > endDate) {
          // 记录过期会员码使用警报
          try {
            await prisma.securityAlert.create({
              data: {
                type: "EXPIRED_MEMBERSHIP_USE",
                severity: "medium",
                userId: null,
                ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
                userAgent: req.headers.get("user-agent") || "unknown",
                description: `检测到使用过期会员码：${membership.membershipCode}，过期时间：${endDate.toISOString()}`,
                metadata: JSON.stringify({
                  membershipCode: membership.membershipCode,
                  membershipId: membership.id,
                  endDate: endDate.toISOString(),
                  attemptTime: now.toISOString(),
                  timestamp: new Date().toISOString()
                }),
                status: "unresolved"
              }
            })
          } catch (alertError) {
            console.error("创建安全警报失败:", alertError)
          }

          await prisma.membership.update({
            where: { id: membership.id },
            data: { status: "expired" }
          })
          return NextResponse.json(
            { error: "会员已过期" },
            { status: 400 }
          )
        }

        // 检查会员有效期是否异常（超过10年）
        if (daysUntilExpiry > 3650) {
          try {
            await prisma.securityAlert.create({
              data: {
                type: "ABNORMAL_MEMBERSHIP_DURATION",
                severity: "high",
                userId: null,
                ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
                userAgent: req.headers.get("user-agent") || "unknown",
                description: `检测到异常会员有效期：${membership.membershipCode}，有效期至${endDate.toISOString()}（${Math.floor(daysUntilExpiry)}天后）`,
                metadata: JSON.stringify({
                  membershipCode: membership.membershipCode,
                  membershipId: membership.id,
                  endDate: endDate.toISOString(),
                  daysUntilExpiry: Math.floor(daysUntilExpiry),
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
              error: "会员数据异常",
              message: "检测到会员数据异常，系统已记录此问题并通知管理员。请联系客服处理。",
              code: "ABNORMAL_MEMBERSHIP_DURATION"
            },
            { status: 400 }
          )
        }
      }

      // 安全检查：会员状态检测
      if (membership.status !== "active") {
        // 记录失效会员码使用警报
        try {
          await prisma.securityAlert.create({
            data: {
              type: "INACTIVE_MEMBERSHIP_USE",
              severity: "medium",
              userId: null,
              ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
              userAgent: req.headers.get("user-agent") || "unknown",
              description: `检测到使用失效会员码：${membership.membershipCode}，状态：${membership.status}`,
              metadata: JSON.stringify({
                membershipCode: membership.membershipCode,
                membershipId: membership.id,
                status: membership.status,
                timestamp: new Date().toISOString()
              }),
              status: "unresolved"
            }
          })
        } catch (alertError) {
          console.error("创建安全警报失败:", alertError)
        }

        return NextResponse.json(
          { error: "会员已失效" },
          { status: 400 }
        )
      }

      // 安全检查：每日限额异常检测
      if (membership.dailyLimit > 10000) {
        try {
          await prisma.securityAlert.create({
            data: {
              type: "ABNORMAL_DAILY_LIMIT",
              severity: "high",
              userId: null,
              ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
              userAgent: req.headers.get("user-agent") || "unknown",
              description: `检测到异常每日限额：${membership.membershipCode}，每日限额：${membership.dailyLimit}`,
              metadata: JSON.stringify({
                membershipCode: membership.membershipCode,
                membershipId: membership.id,
                dailyLimit: membership.dailyLimit,
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
            error: "会员数据异常",
            message: "检测到会员数据异常，系统已记录此问题并通知管理员。请联系客服处理。",
            code: "ABNORMAL_DAILY_LIMIT"
          },
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
        // 记录频繁达到每日限额警报
        try {
          await prisma.securityAlert.create({
            data: {
              type: "DAILY_LIMIT_EXHAUSTED",
              severity: "low",
              userId: null,
              ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
              userAgent: req.headers.get("user-agent") || "unknown",
              description: `会员码${membership.membershipCode}今日优惠次数已用完（${todayUsed}/${membership.dailyLimit}）`,
              metadata: JSON.stringify({
                membershipCode: membership.membershipCode,
                membershipId: membership.id,
                todayUsed,
                dailyLimit: membership.dailyLimit,
                timestamp: new Date().toISOString()
              }),
              status: "unresolved"
            }
          })
        } catch (alertError) {
          console.error("创建安全警报失败:", alertError)
        }

        return NextResponse.json(
          { error: "今日会员优惠次数已用完" },
          { status: 400 }
        )
      }

      // 计算可以享受折扣的商品数量
      const totalItems = validatedItems.reduce((sum, item) => sum + item.quantity, 0)
      const discountableCount = Math.min(totalItems, remainingToday)

      // 计算折扣金额
      let remaining = discountableCount
      let discountAmount = 0

      for (const item of validatedItems) {
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

    // 验证分销码
    if (data.referralCode) {
      distributor = await prisma.distributor.findUnique({
        where: {
          code: data.referralCode.toUpperCase()
        }
      })

      // 如果分销码无效，只记录日志但不阻止订单创建
      if (!distributor) {
        console.warn(`无效的分销码: ${data.referralCode}`)
      } else if (distributor.status !== "active") {
        console.warn(`分销商状态非激活: ${data.referralCode}, 状态: ${distributor.status}`)
        distributor = null // 非激活状态不计入分销
      } else {
        // 生成访客唯一标识（基于 IP + User Agent + 时间戳）
        const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
        const userAgent = req.headers.get("user-agent") || "unknown"
        const visitorId = `${ipAddress}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        // 记录分销点击
        await prisma.distributionClick.create({
          data: {
            distributorId: distributor.id,
            visitorId,
            ipAddress,
            userAgent
          }
        })

        // 更新分销商总点击数
        await prisma.distributor.update({
          where: { id: distributor.id },
          data: {
            totalClicks: { increment: 1 }
          }
        })
      }
    }

    // 安全检查：免费商品使用会员码检测
    if (membership && originalAmount <= 0.01) {
      try {
        await prisma.securityAlert.create({
          data: {
            type: "FREE_PRODUCT_WITH_MEMBERSHIP",
            severity: "low",
            userId: null,
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            description: `检测到免费商品使用会员码：会员码${membership.membershipCode}，商品原价${originalAmount}元`,
            metadata: JSON.stringify({
              membershipCode: membership.membershipCode,
              membershipId: membership.id,
              originalAmount,
              items: validatedItems,
              timestamp: new Date().toISOString()
            }),
            status: "unresolved"
          }
        })
      } catch (alertError) {
        console.error("创建安全警报失败:", alertError)
      }
    }

    // 安全检查：检测价格异常（多层检查）
    // 检查1: 负价格检测
    if (totalAmount < 0) {
      try {
        await prisma.securityAlert.create({
          data: {
            type: "NEGATIVE_PRICE",
            severity: "critical",
            userId: null,
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            description: `检测到负价格订单：商品原价${originalAmount}元，计算后价格为${totalAmount}元`,
            metadata: JSON.stringify({
              originalAmount,
              totalAmount,
              discount: membershipDiscount,
              membershipCode: data.membershipCode,
              items: validatedItems,
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
          message: "检测到订单金额异常（负价格），系统已记录此行为并通知管理员。",
          code: "NEGATIVE_PRICE"
        },
        { status: 400 }
      )
    }

    // 检查2: 价格异常增加检测（折扣后价格不应该高于原价）
    if (totalAmount > originalAmount + 0.01) {
      try {
        await prisma.securityAlert.create({
          data: {
            type: "PRICE_INCREASE",
            severity: "critical",
            userId: null,
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            description: `检测到价格异常增加：商品原价${originalAmount}元，折扣后变成${totalAmount}元`,
            metadata: JSON.stringify({
              originalAmount,
              totalAmount,
              discount: membershipDiscount,
              membershipCode: data.membershipCode,
              items: validatedItems,
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
          message: "检测到订单金额异常（价格增加），系统已记录此行为并通知管理员。",
          code: "PRICE_INCREASE"
        },
        { status: 400 }
      )
    }

    // 检查3: 异常0元订单检测
    // 区分两种情况：
    // 1. 商品原价就是0元（合法的免费商品） - 允许
    // 2. 商品原价 > 0 但被折扣/篡改成0元（攻击） - 拦截并记录
    if (originalAmount > 0.01 && totalAmount <= 0.01) {
      try {
        await prisma.securityAlert.create({
          data: {
            type: "PRICE_MANIPULATION",
            severity: "high",
            userId: null,
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            description: `检测到价格篡改攻击：商品原价${originalAmount}元，被异常折扣至${totalAmount}元`,
            metadata: JSON.stringify({
              originalAmount,
              totalAmount,
              discount: membershipDiscount,
              membershipCode: data.membershipCode,
              items: validatedItems,
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

    // 计算订单过期时间（15分钟后）
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    // 创建订单
    const order = await prisma.order.create({
      data: {
        orderNumber,
        totalAmount,
        originalAmount: membership ? originalAmount : null,
        discount: membershipDiscount,
        membershipId: membership?.id,
        distributorId: distributor?.id, // 保存分销商ID
        status: "pending",
        paymentMethod: data.paymentMethod,
        expiresAt, // 设置订单过期时间
        orderItems: {
          create: validatedItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price  // 使用服务器从数据库查询的价格
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
