import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWrite } from "@/lib/permissions"

// 获取提现配置
export async function GET(req: Request) {
  try {
    // 需要系统设置的读权限
    await requireWrite('DISTRIBUTION')

    const configs = await prisma.systemConfig.findMany({
      where: {
        category: {
          in: ['withdrawal', 'withdrawal_risk']
        }
      },
      orderBy: { key: 'asc' }
    })

    // 按类别分组
    const grouped = {
      basic: configs.filter(c => c.category === 'withdrawal' && !c.key.includes('risk')),
      risk: configs.filter(c => c.category === 'withdrawal_risk')
    }

    return NextResponse.json({
      configs: grouped,
      all: configs
    })
  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("获取提现配置失败:", error)
    return NextResponse.json(
      { error: "获取配置失败" },
      { status: 500 }
    )
  }
}

// 批量更新提现配置
export async function PUT(req: Request) {
  try {
    // 需要系统设置的写权限
    await requireWrite('DISTRIBUTION')

    const body = await req.json()
    const { configs } = body

    if (!Array.isArray(configs)) {
      return NextResponse.json(
        { error: "configs 必须是数组" },
        { status: 400 }
      )
    }

    // 验证配置值
    for (const config of configs) {
      if (config.type === 'boolean' && !['true', 'false'].includes(config.value)) {
        return NextResponse.json(
          { error: `配置 ${config.key} 的值必须是 true 或 false` },
          { status: 400 }
        )
      }

      if (config.type === 'number') {
        const num = parseFloat(config.value)
        if (isNaN(num)) {
          return NextResponse.json(
            { error: `配置 ${config.key} 的值必须是数字` },
            { status: 400 }
          )
        }

        // 特殊验证
        if (config.key === 'withdrawal_fee_rate' && (num < 0 || num > 1)) {
          return NextResponse.json(
            { error: "手续费率必须在 0-1 之间" },
            { status: 400 }
          )
        }

        if (config.key.includes('amount') && num < 0) {
          return NextResponse.json(
            { error: `${config.key} 金额不能为负数` },
            { status: 400 }
          )
        }

        // 冷静期天数验证（最少 7 天，test001/test002 测试用户除外）
        if (config.key === 'commission_settlement_cooldown_days' && num < 7) {
          return NextResponse.json(
            { error: '冷静期天数不能少于 7 天（防范欺诈风险，test001/test002 测试用户除外）' },
            { status: 400 }
          )
        }
      }
    }

    // 批量更新
    const results = await Promise.all(
      configs.map((config: any) =>
        prisma.systemConfig.update({
          where: { key: config.key },
          data: {
            value: config.value.toString()
          }
        })
      )
    )

    return NextResponse.json({
      configs: results,
      message: "配置更新成功"
    })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("更新提现配置失败:", error)
    return NextResponse.json(
      { error: "更新配置失败" },
      { status: 500 }
    )
  }
}
