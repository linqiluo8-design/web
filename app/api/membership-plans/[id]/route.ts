import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  duration: z.number().optional(),
  discount: z.number().min(0).max(1).optional(),
  dailyLimit: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["active", "inactive"]).optional()
})

// PATCH /api/membership-plans/[id] - 更新会员方案（管理员）
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 })
    }

    const params = await context.params
    const body = await request.json()
    const data = updatePlanSchema.parse(body)

    const plan = await prisma.membershipPlan.update({
      where: { id: params.id },
      data
    })

    return NextResponse.json({ plan })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("更新会员方案失败:", error)
    return NextResponse.json({ error: "更新会员方案失败" }, { status: 500 })
  }
}

// DELETE /api/membership-plans/[id] - 删除会员方案（管理员）
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 })
    }

    const params = await context.params

    // 检查是否有会员使用此方案
    const membershipCount = await prisma.membership.count({
      where: { planId: params.id }
    })

    if (membershipCount > 0) {
      return NextResponse.json(
        { error: `该方案已有 ${membershipCount} 位会员，无法删除` },
        { status: 400 }
      )
    }

    await prisma.membershipPlan.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除会员方案失败:", error)
    return NextResponse.json({ error: "删除会员方案失败" }, { status: 500 })
  }
}
