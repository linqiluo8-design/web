import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateProductSchema = z.object({
  status: z.enum(["active", "inactive", "archived"]),
})

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
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
    const { status } = updateProductSchema.parse(body)

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

    // 更新商品状态
    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: { status },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      message: "商品状态更新成功",
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
