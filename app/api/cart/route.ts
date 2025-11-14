import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const addToCartSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().default(1),
})

// 获取用户购物车
export async function GET(req: Request) {
  try {
    const user = await requireAuth()

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            coverImage: true,
            status: true,
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    // 计算总价
    const total = cartItems.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity)
    }, 0)

    return NextResponse.json({
      items: cartItems,
      total,
      count: cartItems.length
    })
  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("获取购物车失败:", error)
    return NextResponse.json(
      { error: "获取购物车失败" },
      { status: 500 }
    )
  }
}

// 添加商品到购物车
export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { productId, quantity } = addToCartSchema.parse(body)

    // 检查商品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!product || product.status !== "active") {
      return NextResponse.json(
        { error: "商品不存在或已下架" },
        { status: 404 }
      )
    }

    // 检查购物车中是否已有该商品
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId: productId
        }
      }
    })

    let cartItem
    if (existingItem) {
      // 更新数量
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              price: true,
              coverImage: true,
            }
          }
        }
      })
    } else {
      // 创建新的购物车项
      cartItem = await prisma.cartItem.create({
        data: {
          userId: user.id,
          productId: productId,
          quantity: quantity
        },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              price: true,
              coverImage: true,
            }
          }
        }
      })
    }

    return NextResponse.json({
      cartItem,
      message: "已添加到购物车"
    })
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

    console.error("添加到购物车失败:", error)
    return NextResponse.json(
      { error: "添加到购物车失败" },
      { status: 500 }
    )
  }
}
