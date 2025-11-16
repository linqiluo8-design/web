import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const bannerSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  image: z.string().url("请输入有效的图片URL"),
  link: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
  status: z.enum(["active", "inactive"]).default("active"),
})

// 获取所有轮播图
export async function GET(req: Request) {
  try {
    const user = await requireAuth()

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "需要管理员权限" },
        { status: 403 }
      )
    }

    const banners = await prisma.banner.findMany({
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "desc" }
      ]
    })

    return NextResponse.json({ banners })
  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("获取轮播图列表失败:", error)
    return NextResponse.json(
      { error: "获取轮播图列表失败" },
      { status: 500 }
    )
  }
}

// 创建轮播图
export async function POST(req: Request) {
  try {
    const user = await requireAuth()

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "需要管理员权限" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const data = bannerSchema.parse(body)

    const banner = await prisma.banner.create({
      data
    })

    return NextResponse.json({
      banner,
      message: "轮播图创建成功"
    }, { status: 201 })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("创建轮播图失败:", error)
    return NextResponse.json(
      { error: "创建轮播图失败" },
      { status: 500 }
    )
  }
}
