import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 获取启用的轮播图（公开接口）
export async function GET() {
  try {
    const banners = await prisma.banner.findMany({
      where: {
        status: "active"
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "desc" }
      ]
    })

    return NextResponse.json({ banners })
  } catch (error) {
    console.error("获取轮播图失败:", error)
    return NextResponse.json(
      { error: "获取轮播图失败" },
      { status: 500 }
    )
  }
}
