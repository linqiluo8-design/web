import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const updateCartSchema = z.object({
  quantity: z.number().int().positive(),
})

// 更新购物车项数量
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { quantity } = updateCartSchema.parse(body)

    // 验证购物车项属于当前用户
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: params.id }
    })

    if (!cartItem || cartItem.userId !== user.id) {
      return NextResponse.json(
        { error: "购物车项不存在" },
        { status: 404 }
      )
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: params.id },
      data: { quantity },
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

    return NextResponse.json({
      cartItem: updatedItem,
      message: "购物车已更新"
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

    console.error("更新购物车失败:", error)
    return NextResponse.json(
      { error: "更新购物车失败" },
      { status: 500 }
    )
  }
}

// 删除购物车项
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()

    // 验证购物车项属于当前用户
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: params.id }
    })

    if (!cartItem || cartItem.userId !== user.id) {
      return NextResponse.json(
        { error: "购物车项不存在" },
        { status: 404 }
      )
    }

    await prisma.cartItem.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: "已从购物车移除" })
  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("删除购物车项失败:", error)
    return NextResponse.json(
      { error: "删除购物车项失败" },
      { status: 500 }
    )
  }
}
