import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildWhereClause, type FilterGroup } from "@/lib/filter-builder"
import { checkOrderExportLimit, recordOrderExport, rollbackExportRecord } from "@/lib/export-limiter"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// 将订单数据转换为CSV格式
function convertToCSV(orders: any[]): string {
  if (orders.length === 0) {
    return ""
  }

  // CSV表头
  const headers = [
    "订单号",
    "用户邮箱",
    "订单总额",
    "原价",
    "折扣",
    "订单状态",
    "支付方式",
    "会员码",
    "商品列表",
    "创建时间",
    "更新时间"
  ]

  // CSV数据行
  const rows = orders.map(order => {
    const products = order.orderItems
      .map((item: any) => `${item.product.title}(x${item.quantity})`)
      .join("; ")

    return [
      order.orderNumber,
      order.user?.email || "匿名用户",
      order.totalAmount.toFixed(2),
      order.originalAmount?.toFixed(2) || "",
      order.discount || "",
      order.status,
      order.paymentMethod || "",
      order.membership?.membershipCode || "",
      `"${products}"`, // 使用引号包裹，避免逗号分隔问题
      new Date(order.createdAt).toLocaleString("zh-CN"),
      new Date(order.updatedAt).toLocaleString("zh-CN")
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

// 导出订单数据
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    // 获取用户 session
    const session = await getServerSession(authOptions)

    // 获取访客ID（用于匿名用户限制）
    const visitorId = searchParams.get("visitorId") || undefined

    // 获取订单号列表（从 localStorage 读取）
    const orderNumbersParam = searchParams.get("orderNumbers")
    const orderNumbers = orderNumbersParam ? orderNumbersParam.split(',').filter(Boolean) : undefined

    // 只对匿名用户检查导出限制
    // 已登录用户（无论是否有权限）都不受限制
    let isAnonymous = false
    if (!session?.user) {
      isAnonymous = true
      const limitResult = await checkOrderExportLimit(visitorId, orderNumbers)

      if (!limitResult.allowed) {
        return NextResponse.json(
          {
            error: limitResult.reason || "不允许导出",
            paidOrderCount: limitResult.paidOrderCount,
            usedExports: limitResult.usedExports,
            remainingExports: limitResult.remainingExports,
            totalAllowed: limitResult.totalAllowed
          },
          { status: 403 }
        )
      }

      // 【关键修复】立即记录导出次数（在实际导出之前）
      // 这样可以防止用户在导出过程中重复点击，或者记录失败导致无限导出
      try {
        await recordOrderExport(visitorId, undefined)
      } catch (err) {
        console.error('记录导出操作失败，拒绝导出:', err)
        return NextResponse.json(
          { error: '记录导出操作失败，请稍后重试' },
          { status: 500 }
        )
      }
    }

    // 导出参数
    const format = searchParams.get("format") || "csv" // csv 或 json
    const filtersJson = searchParams.get("filters") // 新的筛选条件（JSON格式）

    // 兼容旧版参数
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")
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

      // 订单状态
      if (status && status !== "all") {
        conditions.status = status
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
        conditions.totalAmount = {}
        if (minPrice) {
          conditions.totalAmount.gte = parseFloat(minPrice)
        }
        if (maxPrice) {
          conditions.totalAmount.lte = parseFloat(maxPrice)
        }
      }

      where = conditions
    }

    // 匿名用户：强制限制只能导出自己的已支付订单
    if (!session?.user) {
      if (!orderNumbers || orderNumbers.length === 0) {
        return NextResponse.json(
          { error: '只有已支付订单支持导出，非已支付订单不支持导出哦' },
          { status: 403 }
        )
      }

      // 使用 AND 操作符强制应用限制条件，确保无论用户筛选什么，都只能导出自己的已支付订单
      const anonymousRestrictions = {
        orderNumber: { in: orderNumbers },  // 只能导出自己的订单
        status: 'paid'  // 只能导出已支付订单
      }

      // 如果用户有筛选条件，使用 AND 合并；否则直接使用限制条件
      if (Object.keys(where).length > 0) {
        where = {
          AND: [where, anonymousRestrictions]
        }
      } else {
        where = anonymousRestrictions
      }
    }

    // 查询订单数据
    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                price: true,
              }
            }
          }
        },
        payment: true,
        membership: {
          select: {
            id: true,
            membershipCode: true,
            discount: true,
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    // 匿名用户：检查是否有数据可导出
    if (isAnonymous) {
      if (orders.length === 0) {
        // 没有数据可导出，需要回滚导出次数记录
        try {
          await rollbackExportRecord(visitorId)
        } catch (err) {
          console.error('回滚导出记录失败:', err)
        }
        return NextResponse.json(
          { error: '没有符合条件的已支付订单可以导出' },
          { status: 403 }
        )
      }
    }

    // 注意：匿名用户的导出次数已经在前面记录过了（第91-99行）
    // 这里不需要再次记录

    // 根据格式返回数据
    if (format === "json") {
      // JSON格式
      const jsonData = JSON.stringify(orders, null, 2)

      return new NextResponse(jsonData, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename=orders_${Date.now()}.json`
        }
      })
    } else {
      // CSV格式（默认）
      const csvData = convertToCSV(orders)

      return new NextResponse(csvData, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=orders_${Date.now()}.csv`
        }
      })
    }
  } catch (error: any) {
    console.error("导出订单数据失败:", error)
    return NextResponse.json(
      { error: error.message || "导出订单数据失败" },
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
