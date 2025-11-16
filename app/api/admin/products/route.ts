import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// 单个商品验证模式
const productSchema = z.object({
  title: z.string().min(1, "商品标题不能为空"),
  description: z.string().min(1, "商品描述不能为空"),
  content: z.string().optional(),
  price: z.number().positive("价格必须大于0"),
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

export async function GET() {
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

    // 获取所有商品（包括下架的）
    const products = await prisma.product.findMany({
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
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      products,
      total: products.length,
    })
  } catch (error) {
    console.error("获取商品列表失败:", error)
    return NextResponse.json(
      { error: "获取商品列表失败" },
      { status: 500 }
    )
  }
}

// 创建商品（支持单个和批量）
export async function POST(req: Request) {
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

    const body = await req.json()

    // 判断是单个创建还是批量创建
    if (Array.isArray(body.products)) {
      // 批量创建
      const validatedData = bulkProductSchema.parse(body)

      const createdProducts = await prisma.$transaction(
        validatedData.products.map((product) =>
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

      const product = await prisma.product.create({
        data: validatedData,
      })

      return NextResponse.json(
        {
          product,
          message: "商品创建成功",
        },
        { status: 201 }
      )
    }
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
