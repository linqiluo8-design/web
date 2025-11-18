import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRead } from "@/lib/permissions"

/**
 * GET /api/backendmanager/membership-plans
 * 获取所有会员方案（包括停用的方案）
 */
export async function GET() {
  try {
    // 验证会员管理的读权限
    await requireRead('MEMBERSHIPS')

    // 获取所有会员方案（包括 inactive 状态的）
    const plans = await prisma.membershipPlan.findMany({
      orderBy: { sortOrder: "asc" }
    })

    return NextResponse.json({
      plans,
      total: plans.length
    })
  } catch (error: any) {
    console.error("获取会员方案失败:", error)
    return NextResponse.json(
      { error: error.message || "获取会员方案失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
