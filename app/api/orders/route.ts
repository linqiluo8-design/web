import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const createOrderSchema = z.object({
  // 两种模式：cart（从购物车创建）或 direct（立即购买）
  type: z.enum(["cart", "direct"]),
  // 立即购买时需要提供商品ID和数量
  productId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  // 支付方式（暂时可选，创建订单后选择）
  paymentMethod: z.enum(["alipay", "wechat", "paypal"]).optional(),
})

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

// 创建订单
export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const data = createOrderSchema.parse(body)

    let orderItems: { productId: string; quantity: number; price: number }[] = []
    let totalAmount = 0

    if (data.type === "direct") {
      // 立即购买模式
      if (!data.productId || !data.quantity) {
        return NextResponse.json(
          { error: "立即购买需要提供商品ID和数量" },
          { status: 400 }
        )
      }

      const product = await prisma.product.findUnique({
        where: { id: data.productId }
      })

      if (!product || product.status !== "active") {
        return NextResponse.json(
          { error: "商品不存在或已下架" },
          { status: 404 }
        )
      }

      orderItems.push({
        productId: product.id,
        quantity: data.quantity,
        price: product.price
      })

      totalAmount = product.price * data.quantity

    } else if (data.type === "cart") {
      // 从购物车创建订单
      const cartItems = await prisma.cartItem.findMany({
        where: { userId: user.id },
        include: { product: true }
      })

      if (cartItems.length === 0) {
        return NextResponse.json(
          { error: "购物车为空" },
          { status: 400 }
        )
      }

      // 检查所有商品是否可用
      for (const item of cartItems) {
        if (item.product.status !== "active") {
          return NextResponse.json(
            { error: `商品"${item.product.title}"已下架` },
            { status: 400 }
          )
        }

        orderItems.push({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price
        })

        totalAmount += item.product.price * item.quantity
      }
    }

    // 生成订单号
    const orderNumber = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase()

    // 创建订单（使用事务）
    const order = await prisma.$transaction(async (tx) => {
      // 创建订单
      const newOrder = await tx.order.create({
        data: {
          userId: user.id,
          orderNumber,
          totalAmount,
          status: "pending",
          paymentMethod: data.paymentMethod,
          orderItems: {
            create: orderItems
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

      // 如果是从购物车创建，清空购物车
      if (data.type === "cart") {
        await tx.cartItem.deleteMany({
          where: { userId: user.id }
        })
      }

      return newOrder
    })

    return NextResponse.json({
      order,
      message: "订单创建成功"
    }, { status: 201 })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

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
