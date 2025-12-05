import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkMembershipExportLimit, recordMembershipExport, rollbackMembershipExportRecord } from "@/lib/export-limiter"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// 将会员订单数据转换为CSV格式
function convertToCSV(orders: any[]): string {
  if (orders.length === 0) {
    return ""
  }

  // CSV表头
  const headers = [
    "会员订单号",
    "会员码",
    "会员方案",
    "购买价格",
    "折扣率",
    "每日限制",
    "有效期(天)",
    "开始时间",
    "到期时间",
    "状态",
    "支付方式",
    "支付状态",
    "创建时间"
  ]

  // CSV数据行
  const rows = orders.map((order: any) => {
    return [
      order.orderNumber || "无",
      order.membershipCode,
      order.plan?.name || "",
      order.purchasePrice.toFixed(2),
      `${(order.discount * 100).toFixed(0)}%`,
      `${order.dailyLimit}次/天`,
      `${order.duration}天`,
      new Date(order.startDate).toLocaleString("zh-CN"),
      order.endDate ? new Date(order.endDate).toLocaleString("zh-CN") : "永久有效",
      order.status,
      order.paymentMethod || "未支付",
      order.paymentStatus === "completed" ? "已支付" : order.paymentStatus === "pending" ? "待支付" : "失败",
      new Date(order.createdAt).toLocaleString("zh-CN")
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
    const { searchParams } = new URL(req.url)

    // 获取用户 session
    const session = await getServerSession(authOptions)

    // 检查是否是管理员
    const isAdmin = session?.user?.role === 'ADMIN'

    // 获取访客ID（用于匿名用户限制）
    const visitorId = searchParams.get("visitorId") || undefined

    // 获取会员码列表（从 localStorage 读取）
    const membershipCodesParam = searchParams.get("membershipCodes")
    const membershipCodes = membershipCodesParam ? membershipCodesParam.split(',').filter(Boolean) : undefined

    // 只有管理员不受限制，其他用户（包括登录用户和匿名用户）都需要检查
    let isAnonymous = !session?.user
    if (!isAdmin) {
      const limitResult = await checkMembershipExportLimit(visitorId, membershipCodes)

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
      // 为每个会员订单分别记录导出次数
      try {
        await recordMembershipExport(visitorId, undefined, membershipCodes)
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

    // 构建查询条件
    let where: any = {}

    // 匿名用户：强制限制只能导出自己的已支付会员订单
    if (isAnonymous) {
      if (!membershipCodes || membershipCodes.length === 0) {
        return NextResponse.json(
          { error: '只有已支付会员订单支持导出，非已支付订单不支持导出哦' },
          { status: 403 }
        )
      }

      // 强制限制条件
      where = {
        membershipCode: { in: membershipCodes },  // 只能导出自己的会员订单
        paymentStatus: 'completed'  // 只能导出已支付订单
      }
    }

    // 查询会员订单数据
    const orders = await prisma.membership.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    // 匿名用户：检查是否有数据可导出
    if (isAnonymous) {
      if (orders.length === 0) {
        // 没有数据可导出，需要回滚导出次数记录（按会员码回滚）
        try {
          await rollbackMembershipExportRecord(visitorId, membershipCodes)
        } catch (err) {
          console.error('回滚导出记录失败:', err)
        }
        return NextResponse.json(
          { error: '没有符合条件的已支付会员订单可以导出' },
          { status: 403 }
        )
      }
    }

    // 注意：匿名用户的导出次数已经在前面记录过了
    // 这里不需要再次记录

    // 根据格式返回数据
    if (format === "json") {
      // JSON格式
      const jsonData = JSON.stringify(orders, null, 2)

      return new NextResponse(jsonData, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename=membership_orders_${Date.now()}.json`
        }
      })
    } else {
      // CSV格式（默认）
      const csvData = convertToCSV(orders)

      return new NextResponse(csvData, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=membership_orders_${Date.now()}.csv`
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
