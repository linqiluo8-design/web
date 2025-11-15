import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// GET /api/categories - 获取所有分类
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { products: true }
        }
      }
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error("获取分类失败:", error)
    return NextResponse.json({ error: "获取分类失败" }, { status: 500 })
  }
}

const createCategorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空"),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  sortOrder: z.number().optional()
})

// POST /api/categories - 创建新分类（仅管理员）
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 })
    }

    const body = await request.json()
    const data = createCategorySchema.parse(body)

    // 检查分类名是否已存在
    const existing = await prisma.category.findUnique({
      where: { name: data.name }
    })

    if (existing) {
      return NextResponse.json({ error: "分类名称已存在" }, { status: 400 })
    }

    const category = await prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        coverImage: data.coverImage,
        sortOrder: data.sortOrder ?? 0
      }
    })

    return NextResponse.json({ category })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("创建分类失败:", error)
    return NextResponse.json({ error: "创建分类失败" }, { status: 500 })
  }
}
