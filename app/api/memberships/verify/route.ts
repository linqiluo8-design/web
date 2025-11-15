import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST /api/memberships/verify - 验证会员码
export async function POST(request: Request) {
  try {
    const { membershipCode } = await request.json()

    if (!membershipCode) {
      return NextResponse.json({ valid: false, error: "请输入会员码" }, { status: 400 })
    }

    const membership = await prisma.membership.findUnique({
      where: { membershipCode: membershipCode.toUpperCase() },
      include: {
        plan: true
      }
    })

    if (!membership) {
      return NextResponse.json({ valid: false, error: "会员码不存在" })
    }

    // 检查会员状态
    if (membership.status !== "active") {
      return NextResponse.json({ valid: false, error: "会员已失效" })
    }

    // 检查是否过期
    if (membership.endDate && new Date() > membership.endDate) {
      // 更新状态为过期
      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: "expired" }
      })
      return NextResponse.json({ valid: false, error: "会员已过期" })
    }

    // 检查今日使用次数
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let usageRecord = await prisma.membershipUsage.findUnique({
      where: {
        membershipId_usageDate: {
          membershipId: membership.id,
          usageDate: today
        }
      }
    })

    const todayUsed = usageRecord?.count || 0
    const remainingToday = Math.max(0, membership.dailyLimit - todayUsed)

    return NextResponse.json({
      valid: true,
      membership: {
        id: membership.id,
        code: membership.membershipCode,
        discount: membership.discount,
        dailyLimit: membership.dailyLimit,
        todayUsed,
        remainingToday,
        endDate: membership.endDate,
        planSnapshot: JSON.parse(membership.planSnapshot)
      }
    })
  } catch (error) {
    console.error("验证会员失败:", error)
    return NextResponse.json({ valid: false, error: "验证失败" }, { status: 500 })
  }
}
