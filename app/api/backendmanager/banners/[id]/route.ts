import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const updateBannerSchema = z.object({
  title: z.string().min(1, "标题不能为空").optional(),
  image: z.string().url("请输入有效的图片URL").optional(),
  link: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

// 更新轮播图
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "需要管理员权限" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()
    const data = updateBannerSchema.parse(body)

    const banner = await prisma.banner.update({
      where: { id },
      data
    })

    return NextResponse.json({
      banner,
      message: "轮播图更新成功"
    })

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

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "轮播图不存在" },
        { status: 404 }
      )
    }

    console.error("更新轮播图失败:", error)
    return NextResponse.json(
      { error: "更新轮播图失败" },
      { status: 500 }
    )
  }
}

// 删除轮播图
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "需要管理员权限" },
        { status: 403 }
      )
    }

    const { id } = await params

    await prisma.banner.delete({
      where: { id }
    })

    return NextResponse.json({
      message: "轮播图删除成功"
    })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "轮播图不存在" },
        { status: 404 }
      )
    }

    console.error("删除轮播图失败:", error)
    return NextResponse.json(
      { error: "删除轮播图失败" },
      { status: 500 }
    )
  }
}
