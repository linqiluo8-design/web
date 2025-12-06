import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { requireRead, requireWrite } from "@/lib/permissions"

// 单个商品验证模式
const productSchema = z.object({
  title: z.string().min(1, "商品标题不能为空"),
  description: z.string().min(1, "商品描述不能为空"),
  content: z.string().optional(),
  price: z.number().min(0, "价格不能为负数"),
  coverImage: z.string().optional(),
  showImage: z.boolean().optional().default(true),
  categoryId: z.string().optional(),
  tags: z.string().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional().default("active"),
  networkDiskLink: z.string().optional(),
})

// 批量创建验证模式
const bulkProductSchema = z.object({
  products: z.array(productSchema).min(1, "至少需要一个商品"),
})

export async function GET(req: Request) {
  try {
    // 验证用户登录和权限 - 需要PRODUCTS模块的读权限
    await requireRead('PRODUCTS')

    // 获取查询参数
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""

    // 计算分页
    const skip = (page - 1) * limit

    // 构建搜索条件
    const where: any = {}
    if (search.trim()) {
      where.OR = [
        {
          title: {
            contains: search.trim(),
            mode: "insensitive" as const,
          },
        },
        {
          description: {
            contains: search.trim(),
            mode: "insensitive" as const,
          },
        },
      ]
    }

    // 获取商品列表和总数
    const [productsRaw, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          title: true,
          description: true,
          content: true,
          price: true,
          coverImage: true,
          showImage: true,
          category: true,
          categoryId: true,
          categoryRef: {
            select: {
              id: true,
              name: true,
            },
          },
          networkDiskLink: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.product.count({ where }),
    ])

    // 映射产品数据，优先使用 categoryRef.name，其次使用旧的 category 字段
    const products = productsRaw.map((p) => ({
      ...p,
      category: p.categoryRef?.name || p.category || null,
      categoryRef: undefined, // 不返回给前端
    }))

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error("获取商品列表失败:", error)
    return NextResponse.json(
      { error: error.message || "获取商品列表失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}

// 创建商品（支持单个和批量）
export async function POST(req: Request) {
  try {
    // 验证用户登录和权限 - 需要PRODUCTS模块的写权限
    await requireWrite('PRODUCTS')

    const body = await req.json()

    // 判断是单个创建还是批量创建
    if (Array.isArray(body.products)) {
      // 批量创建
      const validatedData = bulkProductSchema.parse(body)

      // 处理每个商品的数据，将空字符串的categoryId转为undefined
      const productsToCreate = validatedData.products.map((product) => {
        const data: any = { ...product }
        // 如果categoryId是空字符串，设为undefined（数据库会存null）
        if (data.categoryId === "") {
          delete data.categoryId
        }
        return data
      })

      const createdProducts = await prisma.$transaction(
        productsToCreate.map((product) =>
          prisma.product.create({
            data: product,
          })
        )
      )

      return NextResponse.json(
        {
          products: createdProducts,
          count: createdProducts.length,
          message: `成功创建 ${createdProducts.length} 个商品`,
        },
        { status: 201 }
      )
    } else {
      // 单个创建
      const validatedData = productSchema.parse(body)

      // 处理数据，将空字符串的categoryId转为undefined
      const data: any = { ...validatedData }
      if (data.categoryId === "") {
        delete data.categoryId
      }

      const product = await prisma.product.create({
        data,
      })

      return NextResponse.json(
        {
          product,
          message: "商品创建成功",
        },
        { status: 201 }
      )
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("创建商品失败:", error)
    return NextResponse.json(
      { error: error.message || "创建商品失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
