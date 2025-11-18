import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWrite } from "@/lib/permissions"
import { z } from "zod"

const cleanupSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  confirmDelete: z.boolean().refine(val => val === true, {
    message: "必须确认删除操作"
  })
})

// 清理订单数据（删除）
export async function POST(req: Request) {
  try {
    // 验证订单管理的写权限（删除操作需要写权限）
    await requireWrite('ORDERS')

    const body = await req.json()
    const data = cleanupSchema.parse(body)

    // 构建查询条件
    const where: any = {}

    if (data.status && data.status !== "all") {
      where.status = data.status
    }

    if (data.startDate || data.endDate) {
      where.createdAt = {}
      if (data.startDate) {
        where.createdAt.gte = new Date(data.startDate)
      }
      if (data.endDate) {
        const end = new Date(data.endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // 先统计要删除的订单数量
    const count = await prisma.order.count({ where })

    if (count === 0) {
      return NextResponse.json({
        message: "没有符合条件的订单需要删除",
        deletedCount: 0
      })
    }

    // 删除订单（级联删除订单项和支付记录）
    const result = await prisma.order.deleteMany({
      where
    })

    return NextResponse.json({
      message: `成功删除 ${result.count} 条订单记录`,
      deletedCount: result.count
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("清理订单数据失败:", error)
    return NextResponse.json(
      { error: error.message || "清理订单数据失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
