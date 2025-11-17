import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/backendmanager/membership-plans
 * 获取所有会员方案（包括停用的方案）
 * 仅限管理员访问
 */
export async function GET() {
  try {
    // 验证用户登录
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "未授权，请先登录" },
        { status: 401 }
      )
    }

    // 验证管理员权限
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "无权限访问，仅管理员可访问" },
        { status: 403 }
      )
    }

    // 获取所有会员方案（包括 inactive 状态的）
    const plans = await prisma.membershipPlan.findMany({
      orderBy: { sortOrder: "asc" }
    })

    return NextResponse.json({
      plans,
      total: plans.length
    })
  } catch (error) {
    console.error("获取会员方案失败:", error)
    return NextResponse.json(
      { error: "获取会员方案失败" },
      { status: 500 }
    )
  }
}
