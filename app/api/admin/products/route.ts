import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
        price: true,
        coverImage: true,
        category: true,
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
