import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWrite } from "@/lib/permissions"

// 提现配置初始化数据
const withdrawalConfigs = [
  // ===== 基础配置 =====
  {
    key: "withdrawal_auto_approve",
    value: "false",
    type: "boolean",
    category: "withdrawal",
    description: "是否启用提现自动审核（默认关闭，建议测试完成后再启用）"
  },
  {
    key: "withdrawal_min_amount",
    value: "100",
    type: "number",
    category: "withdrawal",
    description: "最低提现金额（元）"
  },
  {
    key: "withdrawal_max_amount",
    value: "50000",
    type: "number",
    category: "withdrawal",
    description: "最高提现金额（元）"
  },
  {
    key: "withdrawal_fee_rate",
    value: "0.02",
    type: "number",
    category: "withdrawal",
    description: "提现手续费率（如 0.02 表示 2%）"
  },
  {
    key: "commission_settlement_cooldown_days",
    value: "15",
    type: "number",
    category: "withdrawal",
    description: "佣金结算冷静期（天），订单支付后需等待此期限才能结算佣金，防止退款风险"
  },

  // ===== 自动审核条件配置 =====
  {
    key: "withdrawal_auto_max_amount",
    value: "5000",
    type: "number",
    category: "withdrawal",
    description: "自动审核最大金额（元），超过此金额必须人工审核"
  },
  {
    key: "withdrawal_auto_min_days",
    value: "30",
    type: "number",
    category: "withdrawal",
    description: "自动审核要求的最少注册天数，新注册分销商需人工审核"
  },
  {
    key: "withdrawal_auto_require_verified",
    value: "false",
    type: "boolean",
    category: "withdrawal",
    description: "自动审核是否要求实名认证（建议启用以提高安全性）"
  },
  {
    key: "withdrawal_bank_info_stable_days",
    value: "7",
    type: "number",
    category: "withdrawal",
    description: "银行信息稳定期要求（天），最近变更过银行信息需人工审核"
  },

  // ===== 风控规则配置 =====
  {
    key: "withdrawal_daily_count_limit",
    value: "3",
    type: "number",
    category: "withdrawal",
    description: "每日提现次数限制，超过限制将被拒绝"
  },
  {
    key: "withdrawal_daily_amount_limit",
    value: "10000",
    type: "number",
    category: "withdrawal",
    description: "每日提现金额限制（元），超过限制将被拒绝"
  },
  {
    key: "withdrawal_monthly_amount_limit",
    value: "50000",
    type: "number",
    category: "withdrawal",
    description: "每月提现总额限制（元），超过限制将被拒绝"
  },

  // ===== 风险评分权重配置 =====
  {
    key: "withdrawal_risk_weight_frozen",
    value: "100",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：账户冻结（直接拒绝）"
  },
  {
    key: "withdrawal_risk_weight_large_amount",
    value: "30",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：大额提现（≥自动审核最大金额）"
  },
  {
    key: "withdrawal_risk_weight_first_withdrawal",
    value: "20",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：首次提现"
  },
  {
    key: "withdrawal_risk_weight_not_verified",
    value: "15",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：未实名认证"
  },
  {
    key: "withdrawal_risk_weight_new_account",
    value: "15",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：新注册账户（<最少注册天数）"
  },
  {
    key: "withdrawal_risk_weight_high_risk_account",
    value: "10",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：高风险账户（人工标记）"
  },
  {
    key: "withdrawal_risk_weight_bank_changed",
    value: "10",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：银行信息近期变更"
  },
  {
    key: "withdrawal_risk_weight_medium_risk_account",
    value: "5",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：中风险账户（人工标记）"
  },
  {
    key: "withdrawal_risk_weight_daily_limit",
    value: "5",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：超过每日提现限制"
  },

  // ===== 风险等级阈值配置 =====
  {
    key: "withdrawal_risk_threshold_auto",
    value: "10",
    type: "number",
    category: "withdrawal_risk",
    description: "自动审核风险评分阈值，低于此分数可自动审核"
  },
  {
    key: "withdrawal_risk_threshold_manual",
    value: "30",
    type: "number",
    category: "withdrawal_risk",
    description: "人工审核风险评分阈值，高于此分数记录安全警报"
  }
]

// 初始化提现配置
export async function POST(req: Request) {
  try {
    // 需要分销管理的写权限
    await requireWrite('DISTRIBUTION')

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const config of withdrawalConfigs) {
      try {
        // 检查配置是否已存在
        const existing = await prisma.systemConfig.findUnique({
          where: { key: config.key }
        })

        if (existing) {
          skipped++
          continue
        }

        // 创建配置
        await prisma.systemConfig.create({
          data: config
        })
        created++
      } catch (error: any) {
        errors.push(`${config.key}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: withdrawalConfigs.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `成功创建 ${created} 个配置项，跳过 ${skipped} 个已存在的配置项`
    })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("初始化提现配置失败:", error)
    return NextResponse.json(
      { error: "初始化配置失败" },
      { status: 500 }
    )
  }
}
