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
})

// 生成安全的唯一订单号
function generateOrderNumber(): string {
  const timestamp = Date.now().toString()
  const randomBytes = crypto.randomBytes(6).toString('hex').toUpperCase()
  return `ORD${timestamp}${randomBytes}`
}

// 获取用户订单列表
export async function GET(req: Request) {
  try {
    const user = await requireAuth()

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
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
    })

    return NextResponse.json({ orders })
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

    let totalAmount = 0

    // 验证所有商品是否存在且可用
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

      totalAmount += item.price * item.quantity
    }

    // 生成安全的唯一订单号
    const orderNumber = generateOrderNumber()

    // 创建订单
    const order = await prisma.order.create({
      data: {
        orderNumber,
        totalAmount,
        status: "pending",
        paymentMethod: data.paymentMethod,
        orderItems: {
          create: data.items
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
      message: "订单创建成功"
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
