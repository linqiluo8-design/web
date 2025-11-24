import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取分销商统计数据
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || "overview" // overview, orders, clicks

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { distributor: true }
    })

    if (!user || !user.distributor) {
      return NextResponse.json({ error: "您还不是分销商" }, { status: 404 })
    }

    if (user.distributor.status !== "active") {
      return NextResponse.json({ error: "分销商账户未激活" }, { status: 403 })
    }

    switch (type) {
      case "orders": {
        // 获取分销订单列表
        const page = parseInt(searchParams.get("page") || "1")
        const pageSize = parseInt(searchParams.get("pageSize") || "20")
        const skip = (page - 1) * pageSize

        const [orders, total] = await Promise.all([
          prisma.distributionOrder.findMany({
            where: { distributorId: user.distributor.id },
            include: {
              order: {
                include: {
                  orderItems: {
                    include: {
                      product: {
                        select: {
                          title: true,
                          coverImage: true
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize
          }),
          prisma.distributionOrder.count({
            where: { distributorId: user.distributor.id }
          })
        ])

        return NextResponse.json({
          orders: orders.map(order => ({
            id: order.id,
            orderNumber: order.order.orderNumber,
            orderAmount: order.orderAmount,
            commissionAmount: order.commissionAmount,
            commissionRate: order.commissionRate,
            status: order.status,
            products: order.order.orderItems.map(item => ({
              title: item.product.title,
              quantity: item.quantity,
              price: item.price
            })),
            createdAt: order.createdAt,
            confirmedAt: order.confirmedAt,
            settledAt: order.settledAt
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        })
      }

      case "clicks": {
        // 获取点击统计
        const days = parseInt(searchParams.get("days") || "30")
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        const clicks = await prisma.distributionClick.findMany({
          where: {
            distributorId: user.distributor.id,
            clickedAt: { gte: startDate }
          },
          include: {
            product: {
              select: {
                title: true
              }
            }
          },
          orderBy: { clickedAt: "desc" },
          take: 100
        })

        // 按日期分组统计
        const clicksByDate: Record<string, { clicks: number; conversions: number }> = {}
        clicks.forEach(click => {
          const date = click.clickedAt.toISOString().split('T')[0]
          if (!clicksByDate[date]) {
            clicksByDate[date] = { clicks: 0, conversions: 0 }
          }
          clicksByDate[date].clicks++
          if (click.converted) {
            clicksByDate[date].conversions++
          }
        })

        return NextResponse.json({
          clicksByDate,
          totalClicks: clicks.length,
          totalConversions: clicks.filter(c => c.converted).length,
          conversionRate: clicks.length > 0
            ? (clicks.filter(c => c.converted).length / clicks.length * 100).toFixed(2)
            : "0.00"
        })
      }

      default: {
        // 概览数据
        const [
          totalOrders,
          pendingOrders,
          confirmedOrders,
          settledOrders,
          totalCommission,
          pendingCommission,
          settledCommission,
          recentOrders
        ] = await Promise.all([
          prisma.distributionOrder.count({
            where: { distributorId: user.distributor.id }
          }),
          prisma.distributionOrder.count({
            where: { distributorId: user.distributor.id, status: "pending" }
          }),
          prisma.distributionOrder.count({
            where: { distributorId: user.distributor.id, status: "confirmed" }
          }),
          prisma.distributionOrder.count({
            where: { distributorId: user.distributor.id, status: "settled" }
          }),
          prisma.distributionOrder.aggregate({
            where: { distributorId: user.distributor.id },
            _sum: { commissionAmount: true }
          }),
          prisma.distributionOrder.aggregate({
            where: { distributorId: user.distributor.id, status: "confirmed" },
            _sum: { commissionAmount: true }
          }),
          prisma.distributionOrder.aggregate({
            where: { distributorId: user.distributor.id, status: "settled" },
            _sum: { commissionAmount: true }
          }),
          prisma.distributionOrder.findMany({
            where: { distributorId: user.distributor.id },
            include: {
              order: {
                select: {
                  orderNumber: true,
                  totalAmount: true,
                  createdAt: true
                }
              }
            },
            orderBy: { createdAt: "desc" },
            take: 10
          })
        ])

        return NextResponse.json({
          overview: {
            totalOrders,
            pendingOrders,
            confirmedOrders,
            settledOrders,
            totalCommission: totalCommission._sum.commissionAmount || 0,
            pendingCommission: pendingCommission._sum.commissionAmount || 0,
            settledCommission: settledCommission._sum.commissionAmount || 0,
            availableBalance: user.distributor.availableBalance,
            withdrawnAmount: user.distributor.withdrawnAmount,
          },
          recentOrders: recentOrders.map(order => ({
            id: order.id,
            orderNumber: order.order.orderNumber,
            orderAmount: order.orderAmount,
            commissionAmount: order.commissionAmount,
            status: order.status,
            createdAt: order.createdAt
          }))
        })
      }
    }
  } catch (error) {
    console.error("获取统计数据失败:", error)
    return NextResponse.json(
      { error: "获取数据失败，请稍后重试" },
      { status: 500 }
    )
  }
}
