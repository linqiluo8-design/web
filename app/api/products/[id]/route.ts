import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 获取单个商品详情（公开访问，无需登录）
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: {
        id: params.id,
        status: "active"
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: "商品不存在" },
        { status: 404 }
      )
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error("获取商品详情失败:", error)
    return NextResponse.json(
      { error: "获取商品详情失败" },
      { status: 500 }
    )
  }
}

// 更新商品（管理员功能）
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()

    const product = await prisma.product.update({
      where: { id: params.id },
      data: body
    })

    return NextResponse.json({ product, message: "商品更新成功" })
  } catch (error) {
    console.error("更新商品失败:", error)
    return NextResponse.json(
      { error: "更新商品失败" },
      { status: 500 }
    )
  }
}

// 删除商品（管理员功能）
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.product.update({
      where: { id: params.id },
      data: { status: "archived" }
    })

    return NextResponse.json({ message: "商品已删除" })
  } catch (error) {
    console.error("删除商品失败:", error)
    return NextResponse.json(
      { error: "删除商品失败" },
      { status: 500 }
    )
  }
}
