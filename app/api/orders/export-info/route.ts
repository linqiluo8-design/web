import { NextResponse } from "next/server"
import { checkOrderExportLimit } from "@/lib/export-limiter"

/**
 * 查询订单导出信息（剩余次数等）
 * GET /api/orders/export-info?visitorId=xxx
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const visitorId = searchParams.get("visitorId") || undefined

    // 获取订单号列表
    const orderNumbersParam = searchParams.get("orderNumbers")
    const orderNumbers = orderNumbersParam ? orderNumbersParam.split(',').filter(Boolean) : undefined

    // 检查导出限制
    const limitResult = await checkOrderExportLimit(visitorId, orderNumbers)

    return NextResponse.json({
      allowed: limitResult.allowed,
      reason: limitResult.reason,
      paidOrderCount: limitResult.paidOrderCount || 0,
      usedExports: limitResult.usedExports || 0,
      remainingExports: limitResult.remainingExports || 0,
      totalAllowed: limitResult.totalAllowed || 0
    })
  } catch (error: any) {
    console.error("查询导出信息失败:", error)
    return NextResponse.json(
      { error: error.message || "查询导出信息失败" },
      { status: 500 }
    )
  }
}
