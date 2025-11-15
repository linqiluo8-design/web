import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  sortOrder: z.number().optional()
})

// PATCH /api/categories/[id] - 更新分类（仅管理员）
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 })
    }

    const params = await context.params
    const body = await request.json()
    const data = updateCategorySchema.parse(body)

    // 如果更新名称，检查是否重复
    if (data.name) {
      const existing = await prisma.category.findFirst({
        where: {
          name: data.name,
          id: { not: params.id }
        }
      })

      if (existing) {
        return NextResponse.json({ error: "分类名称已存在" }, { status: 400 })
      }
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder })
      }
    })

    return NextResponse.json({ category })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("更新分类失败:", error)
    return NextResponse.json({ error: "更新分类失败" }, { status: 500 })
  }
}

// DELETE /api/categories/[id] - 删除分类（仅管理员）
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 })
    }

    const params = await context.params

    // 检查是否有商品使用此分类
    const productCount = await prisma.product.count({
      where: { categoryId: params.id }
    })

    if (productCount > 0) {
      return NextResponse.json(
        { error: `该分类下还有 ${productCount} 个商品，无法删除` },
        { status: 400 }
      )
    }

    await prisma.category.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除分类失败:", error)
    return NextResponse.json({ error: "删除分类失败" }, { status: 500 })
  }
}
