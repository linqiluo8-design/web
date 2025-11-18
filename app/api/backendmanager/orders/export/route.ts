import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRead } from "@/lib/permissions"

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
    // 验证订单管理的读权限
    await requireRead('ORDERS')

    const { searchParams } = new URL(req.url)

    // 导出参数
    const format = searchParams.get("format") || "csv" // csv 或 json
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")

    // 构建查询条件
    const where: any = {}

    if (status && status !== "all") {
      where.status = status
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
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
