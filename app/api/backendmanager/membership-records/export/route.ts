import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRead } from "@/lib/permissions"
import { buildWhereClause, type FilterGroup } from "@/lib/filter-builder"

// 将会员订单数据转换为CSV格式
function convertToCSV(records: any[]): string {
  if (records.length === 0) {
    return ""
  }

  // CSV表头
  const headers = [
    "会员码",
    "订单号",
    "用户邮箱",
    "会员套餐",
    "购买价格",
    "折扣率",
    "每日限额",
    "有效期(天)",
    "开始日期",
    "结束日期",
    "会员状态",
    "支付方式",
    "支付状态",
    "创建时间"
  ]

  // CSV数据行
  const rows = records.map(record => {
    return [
      record.membershipCode,
      record.orderNumber || "",
      record.user?.email || "匿名用户",
      record.plan?.name || "",
      record.purchasePrice.toFixed(2),
      `${(record.discount * 100).toFixed(0)}%`,
      record.dailyLimit,
      record.duration,
      new Date(record.startDate).toLocaleDateString("zh-CN"),
      record.endDate ? new Date(record.endDate).toLocaleDateString("zh-CN") : "",
      record.status,
      record.paymentMethod || "",
      record.paymentStatus,
      new Date(record.createdAt).toLocaleString("zh-CN")
    ]
  })

  // 组合CSV内容
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n")

  // 添加BOM以支持Excel正确显示中文
  return "\uFEFF" + csvContent
}

// 导出会员订单数据
export async function GET(req: Request) {
  try {
    // 验证会员管理的读权限
    await requireRead('MEMBERSHIPS')

    const { searchParams } = new URL(req.url)

    // 导出参数
    const format = searchParams.get("format") || "csv" // csv 或 json
    const filtersJson = searchParams.get("filters") // 新的筛选条件（JSON格式）

    // 兼容旧版参数
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")
    const paymentStatus = searchParams.get("paymentStatus")
    const paymentMethod = searchParams.get("paymentMethod")
    const minPrice = searchParams.get("minPrice")
    const maxPrice = searchParams.get("maxPrice")

    // 构建查询条件
    let where: any = {}

    // 如果提供了新的 filters 参数，使用高级筛选
    if (filtersJson) {
      try {
        const filterGroup: FilterGroup = JSON.parse(filtersJson)
        where = buildWhereClause(filterGroup)
      } catch (error) {
        console.error("解析筛选条件失败:", error)
        return NextResponse.json(
          { error: "筛选条件格式错误" },
          { status: 400 }
        )
      }
    } else {
      // 兼容旧版简单筛选
      const conditions: any = {}

      // 会员状态
      if (status && status !== "all") {
        conditions.status = status
      }

      // 支付状态
      if (paymentStatus && paymentStatus !== "all") {
        conditions.paymentStatus = paymentStatus
      }

      // 支付方式
      if (paymentMethod && paymentMethod !== "all") {
        conditions.paymentMethod = paymentMethod
      }

      // 日期范围
      if (startDate || endDate) {
        conditions.createdAt = {}
        if (startDate) {
          conditions.createdAt.gte = new Date(startDate)
        }
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          conditions.createdAt.lte = end
        }
      }

      // 价格范围
      if (minPrice || maxPrice) {
        conditions.purchasePrice = {}
        if (minPrice) {
          conditions.purchasePrice.gte = parseFloat(minPrice)
        }
        if (maxPrice) {
          conditions.purchasePrice.lte = parseFloat(maxPrice)
        }
      }

      where = conditions
    }

    // 查询会员订单数据
    const records = await prisma.membership.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        plan: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    // 根据格式返回数据
    if (format === "json") {
      // JSON格式
      const jsonData = JSON.stringify(records, null, 2)

      return new NextResponse(jsonData, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename=membership_records_${Date.now()}.json`
        }
      })
    } else {
      // CSV格式（默认）
      const csvData = convertToCSV(records)

      return new NextResponse(csvData, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=membership_records_${Date.now()}.csv`
        }
      })
    }
  } catch (error: any) {
    console.error("导出会员订单数据失败:", error)
    return NextResponse.json(
      { error: error.message || "导出会员订单数据失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
