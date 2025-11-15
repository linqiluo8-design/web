import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const productSchema = z.object({
  title: z.string().min(1, "商品标题不能为空"),
  description: z.string().min(1, "商品描述不能为空"),
  content: z.string().optional(),
  price: z.number().positive("价格必须大于0"),
  coverImage: z.string().url().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
})

// 获取商品列表（公开访问，无需登录）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const selectedCategories = searchParams.getAll("categories[]")
    const showOther = searchParams.get("showOther") === "true"
    const excludeCategories = searchParams.getAll("excludeCategories[]")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const where: any = {
      status: "active"
    }

    // 多分类筛选
    if (selectedCategories.length > 0 && !showOther) {
      where.category = { in: selectedCategories }
    }

    // "其他"分类：显示不属于已知分类的商品
    if (showOther && !selectedCategories.length) {
      if (excludeCategories.length > 0) {
        where.OR = [
          { category: { notIn: excludeCategories } },
          { category: null }
        ]
      } else {
        where.category = null
      }
    }

    // 同时选择了具体分类和"其他"
    if (selectedCategories.length > 0 && showOther) {
      if (excludeCategories.length > 0) {
        where.OR = [
          { category: { in: selectedCategories } },
          { category: { notIn: excludeCategories.filter(c => !selectedCategories.includes(c)) } },
          { category: null }
        ]
      } else {
        // 如果没有排除分类，就显示选中的分类 + null
        where.OR = [
          { category: { in: selectedCategories } },
          { category: null }
        ]
      }
    }

    if (search) {
      const searchCondition = {
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
        ]
      }

      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchCondition]
        delete where.OR
      } else {
        where.OR = searchCondition.OR
      }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          coverImage: true,
          showImage: true,
          category: true,
          tags: true,
          createdAt: true,
        }
      }),
      prisma.product.count({ where })
    ])

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("获取商品列表失败:", error)
    return NextResponse.json(
      { error: "获取商品列表失败" },
      { status: 500 }
    )
  }
}

// 创建商品（管理员功能）
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = productSchema.parse(body)

    const product = await prisma.product.create({
      data: {
        ...data,
        status: "active"
      }
    })

    return NextResponse.json(
      { product, message: "商品创建成功" },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("创建商品失败:", error)
    return NextResponse.json(
      { error: "创建商品失败" },
      { status: 500 }
    )
  }
}
