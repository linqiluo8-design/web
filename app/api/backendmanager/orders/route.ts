import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取所有订单列表（管理员权限，支持分页和搜索）
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url)

    // 分页参数
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    // 搜索参数
    const search = searchParams.get("search") // 订单号搜索
    const status = searchParams.get("status") // 状态筛选
    const startDate = searchParams.get("startDate") // 开始日期
    const endDate = searchParams.get("endDate") // 结束日期

    // 构建查询条件
    const where: any = {}

    if (search) {
      where.orderNumber = { contains: search }
    }

    if (status && status !== "all") {
      where.status = status
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // 查询订单和总数
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  coverImage: true,
                  networkDiskLink: true,
                }
              }
            }
          },
          payment: true,
          membership: {
            select: {
              id: true,
              membershipCode: true,
              discount: true,
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.order.count({ where })
    ])

    return NextResponse.json({
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("获取订单列表失败:", error)
    return NextResponse.json(
      { error: "获取订单列表失败" },
      { status: 500 }
    )
  }
}
