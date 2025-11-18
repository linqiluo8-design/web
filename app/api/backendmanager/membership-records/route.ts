import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRead } from "@/lib/permissions"

// GET /api/backendmanager/membership-records - 获取所有会员购买记录
export async function GET(req: Request) {
  try {
    // 需要会员管理的读权限
    await requireRead('MEMBERSHIPS')

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const paymentStatus = searchParams.get("paymentStatus") || ""

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {}

    // 搜索会员码或订单号
    if (search) {
      where.OR = [
        { membershipCode: { contains: search } },
        { orderNumber: { contains: search } }
      ]
    }

    // 筛选会员状态
    if (status) {
      where.status = status
    }

    // 筛选支付状态
    if (paymentStatus) {
      where.paymentStatus = paymentStatus
    }

    // 获取总数
    const total = await prisma.membership.count({ where })

    // 获取会员购买记录
    const records = await prisma.membership.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error: any) {
    console.error("获取会员购买记录失败:", error)
    return NextResponse.json(
      { error: error.message || "获取会员购买记录失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
