import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateProductSchema = z.object({
  status: z.enum(["active", "inactive", "archived"]).optional(),
  price: z.number().positive().optional(),
  category: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // 等待params解析（兼容Next.js 15+）
    const params = await Promise.resolve(context.params)

    // 验证用户登录和权限
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "未授权，请先登录" },
        { status: 401 }
      )
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "无权限访问" },
        { status: 403 }
      )
    }

    // 解析请求数据
    const body = await request.json()
    const updateData = updateProductSchema.parse(body)

    // 检查商品是否存在
    const product = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!product) {
      return NextResponse.json(
        { error: "商品不存在" },
        { status: 404 }
      )
    }

    // 更新商品（只更新提供的字段）
    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        category: true,
        status: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      message: "商品更新成功",
      product: updatedProduct,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "请求数据格式错误", details: error.errors },
        { status: 400 }
      )
    }

    console.error("更新商品状态失败:", error)
    return NextResponse.json(
      { error: "更新商品状态失败" },
      { status: 500 }
    )
  }
}
