import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 通过订单号查询订单
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderNumber = searchParams.get("orderNumber")

    if (!orderNumber) {
      return NextResponse.json(
        { error: "请提供订单号" },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                coverImage: true,
                category: true,
                networkDiskLink: true, // 包含网盘链接
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

    // 如果订单未支付，移除网盘链接信息（安全考虑）
    if (order.status !== "paid") {
      order.orderItems.forEach((item: any) => {
        item.product.networkDiskLink = null
      })
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
