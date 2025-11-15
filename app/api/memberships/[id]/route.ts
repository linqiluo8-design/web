import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/memberships/[id] - 获取会员信息
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const membership = await prisma.membership.findUnique({
      where: { id }
    })

    if (!membership) {
      return NextResponse.json({ error: "会员订单不存在" }, { status: 404 })
    }

    return NextResponse.json({ membership })
  } catch (error) {
    console.error("获取会员信息失败:", error)
    return NextResponse.json({ error: "获取会员信息失败" }, { status: 500 })
  }
}
