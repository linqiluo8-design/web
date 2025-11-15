import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// GET /api/membership-plans - 获取所有会员方案（公开）
export async function GET() {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: { status: "active" },
      orderBy: { sortOrder: "asc" }
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error("获取会员方案失败:", error)
    return NextResponse.json({ error: "获取会员方案失败" }, { status: 500 })
  }
}

const createPlanSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  duration: z.number(), // -1 for lifetime
  discount: z.number().min(0).max(1),
  dailyLimit: z.number().int().positive(),
  sortOrder: z.number().int().optional()
})

// POST /api/membership-plans - 创建会员方案（管理员）
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 })
    }

    const body = await request.json()
    const data = createPlanSchema.parse(body)

    const plan = await prisma.membershipPlan.create({
      data: {
        ...data,
        status: "active"
      }
    })

    return NextResponse.json({ plan })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("创建会员方案失败:", error)
    return NextResponse.json({ error: "创建会员方案失败" }, { status: 500 })
  }
}
