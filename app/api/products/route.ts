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
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const where: any = {
      status: "active"
    }

    if (category) {
      where.category = category
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ]
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
