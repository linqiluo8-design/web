import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/membership-orders - 获取会员订单列表（支持匿名用户通过localStorage中的会员码查询）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const membershipCodes = searchParams.get("membershipCodes") || "" // 匿名用户传递的会员码列表

    // 计算分页
    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {
      paymentStatus: "completed" // 只显示已支付的会员订单
    }

    // 如果有搜索关键词，按订单号或会员码搜索
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { membershipCode: { contains: search } }
      ]
    }

    // 如果是匿名用户，只显示他们购买的会员订单
    if (membershipCodes) {
      const codes = membershipCodes.split(",").filter(Boolean)
      if (codes.length > 0) {
        where.membershipCode = { in: codes }
      }
    }

    // 查询总数
    const total = await prisma.membership.count({ where })

    // 查询数据
    const memberships = await prisma.membership.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        plan: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      memberships,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    })
  } catch (error) {
    console.error("获取会员订单列表失败:", error)
    return NextResponse.json(
      { error: "获取会员订单列表失败" },
      { status: 500 }
    )
  }
}
