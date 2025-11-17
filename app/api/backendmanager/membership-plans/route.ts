import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/backendmanager/membership-plans - 获取所有会员方案（包括停用的，仅管理员）
export async function GET() {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 })
    }

    // 获取所有方案（包括inactive的）
    const plans = await prisma.membershipPlan.findMany({
      orderBy: { sortOrder: "asc" }
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error("获取会员方案失败:", error)
    return NextResponse.json({ error: "获取会员方案失败" }, { status: 500 })
  }
}
