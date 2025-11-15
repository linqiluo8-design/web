import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 根据订单ID获取订单详情
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                coverImage: true,
              }
            }
          }
        },
        payment: true,
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: "订单不存在" },
        { status: 404 }
      )
    }

    return NextResponse.json({ order })
  } catch (error: any) {
    console.error("查询订单失败:", error)
    return NextResponse.json(
      { error: "查询订单失败" },
      { status: 500 }
    )
  }
}
