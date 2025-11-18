import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWrite } from "@/lib/permissions"
import { z } from "zod"

// GET /api/categories - 获取所有分类（公开接口，无需权限）
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

const bulkCategorySchema = z.object({
  categories: z.array(createCategorySchema).min(1, "至少需要一个分类"),
})

// POST /api/categories - 创建新分类（支持单个和批量）
export async function POST(request: Request) {
  try {
    // 需要分类管理的写权限
    await requireWrite('CATEGORIES')

    const body = await request.json()

    // 判断是单个创建还是批量创建
    if (Array.isArray(body.categories)) {
      // 批量创建
      const validatedData = bulkCategorySchema.parse(body)

      // 检查分类名是否已存在
      const existingNames = await prisma.category.findMany({
        where: {
          name: {
            in: validatedData.categories.map(c => c.name)
          }
        },
        select: { name: true }
      })

      if (existingNames.length > 0) {
        return NextResponse.json({
          error: `以下分类名称已存在：${existingNames.map(c => c.name).join(', ')}`
        }, { status: 400 })
      }

      const createdCategories = await prisma.$transaction(
        validatedData.categories.map((category) =>
          prisma.category.create({
            data: {
              name: category.name,
              description: category.description,
              coverImage: category.coverImage,
              sortOrder: category.sortOrder ?? 0
            }
          })
        )
      )

      return NextResponse.json({
        categories: createdCategories,
        count: createdCategories.length,
        message: `成功创建 ${createdCategories.length} 个分类`,
      })
    } else {
      // 单个创建
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
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("创建分类失败:", error)
    return NextResponse.json(
      { error: error.message || "创建分类失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
