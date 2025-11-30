import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取所有提现记录（管理员）
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    // 检查用户权限
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { permissions: true }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 检查是否是管理员或有分销管理权限
    const distributionPermission = user.permissions.find(
      p => p.module === "DISTRIBUTION"
    )

    if (user.role !== "ADMIN" && distributionPermission?.level !== "WRITE") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")
    const status = searchParams.get("status")
    const skip = (page - 1) * pageSize

    // 构建查询条件
    const where: any = {}
    if (status && status !== "all") {
      where.status = status
    }

    const [withdrawals, total] = await Promise.all([
      prisma.commissionWithdrawal.findMany({
        where,
        include: {
          distributor: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.commissionWithdrawal.count({ where })
    ])

    return NextResponse.json({
      withdrawals,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error("获取提现记录失败:", error)
    return NextResponse.json(
      { error: "获取记录失败，请稍后重试" },
      { status: 500 }
    )
  }
}
