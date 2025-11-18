import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { requireWrite } from "@/lib/permissions"

const updateProductSchema = z.object({
  status: z.enum(["active", "inactive", "archived"]).optional(),
  price: z.number().positive().optional(),
  category: z.string().optional(),
  categoryId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  coverImage: z.string().optional(),
  showImage: z.boolean().optional(),
  networkDiskLink: z.string().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户登录和权限 - 需要PRODUCTS模块的写权限
    await requireWrite('PRODUCTS')

    // 等待params解析（Next.js 16+要求）
    const params = await context.params

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

    // 处理空字符串：将空字符串转换为null
    const processedData: any = { ...updateData }

    // 如果更新了categoryId，需要同步更新category字段（分类名称）
    if (processedData.categoryId !== undefined) {
      if (processedData.categoryId === "" || processedData.categoryId === null) {
        // 清除分类
        processedData.categoryId = null
        processedData.category = null
      } else {
        // 查找分类名称并更新
        const categoryData = await prisma.category.findUnique({
          where: { id: processedData.categoryId },
          select: { name: true }
        })
        if (categoryData) {
          processedData.category = categoryData.name
        }
      }
    }

    if (processedData.coverImage === "") {
      processedData.coverImage = null
    }
    if (processedData.content === "") {
      processedData.content = null
    }
    if (processedData.networkDiskLink === "") {
      processedData.networkDiskLink = null
    }

    // 更新商品（只更新提供的字段）
    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: processedData,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        category: true,
        categoryId: true,
        status: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      message: "商品更新成功",
      product: updatedProduct,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "请求数据格式错误", details: error.errors },
        { status: 400 }
      )
    }

    console.error("更新商品状态失败:", error)
    return NextResponse.json(
      { error: error.message || "更新商品状态失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
