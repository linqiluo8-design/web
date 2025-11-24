import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取分销商列表
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    // 检查权限
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        permissions: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const hasPermission = user.role === "ADMIN" ||
      user.permissions.some(p => p.module === "DISTRIBUTION" && (p.level === "READ" || p.level === "WRITE"))

    if (!hasPermission) {
      return NextResponse.json({ error: "无权限访问" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")
    const status = searchParams.get("status") // all, pending, active, suspended, rejected
    const search = searchParams.get("search") || ""

    const skip = (page - 1) * pageSize

    // 构建查询条件
    const where: any = {}
    if (status && status !== "all") {
      where.status = status
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { contactEmail: { contains: search, mode: "insensitive" } },
        { contactPhone: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } }
      ]
    }

    const [distributors, total] = await Promise.all([
      prisma.distributor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              distributionOrders: true,
              clicks: true,
              withdrawals: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.distributor.count({ where })
    ])

    return NextResponse.json({
      distributors: distributors.map(d => ({
        id: d.id,
        code: d.code,
        status: d.status,
        commissionRate: d.commissionRate,
        totalEarnings: d.totalEarnings,
        availableBalance: d.availableBalance,
        withdrawnAmount: d.withdrawnAmount,
        totalOrders: d._count.distributionOrders,
        totalClicks: d._count.clicks,
        totalWithdrawals: d._count.withdrawals,
        contactName: d.contactName,
        contactEmail: d.contactEmail,
        contactPhone: d.contactPhone,
        appliedAt: d.appliedAt,
        approvedAt: d.approvedAt,
        rejectedReason: d.rejectedReason,
        user: d.user
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error("获取分销商列表失败:", error)
    return NextResponse.json(
      { error: "获取列表失败，请稍后重试" },
      { status: 500 }
    )
  }
}
