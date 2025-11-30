/**
 * 初始化提现自动审核系统配置
 *
 * 此脚本用于在数据库中创建所有提现相关的系统配置项
 * 包括自动审核开关、风控规则参数等
 */

import { prisma } from "@/lib/prisma"

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

async function main() {
  console.log("开始初始化提现配置...")

  let created = 0
  let updated = 0
  let failed = 0

  for (const config of withdrawalConfigs) {
    try {
      // 检查配置是否已存在
      const existing = await prisma.systemConfig.findUnique({
        where: { key: config.key }
      })

      if (existing) {
        console.log(`⏭️  配置已存在，跳过: ${config.key}`)
        updated++
      } else {
        await prisma.systemConfig.create({
          data: config
        })
        console.log(`✅ 创建配置: ${config.key} = ${config.value}`)
        created++
      }
    } catch (error) {
      console.error(`❌ 创建配置失败: ${config.key}`, error)
      failed++
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("初始化完成！")
  console.log(`✅ 新创建: ${created} 项`)
  console.log(`⏭️  已存在: ${updated} 项`)
  console.log(`❌ 失败: ${failed} 项`)
  console.log("=".repeat(60))

  // 显示当前配置摘要
  console.log("\n📋 当前配置摘要：")
  console.log("─".repeat(60))
  console.log(`自动审核开关: ${withdrawalConfigs[0].value === "true" ? "✅ 已启用" : "❌ 未启用"}`)
  console.log(`最低提现金额: ¥${withdrawalConfigs[1].value}`)
  console.log(`最高提现金额: ¥${withdrawalConfigs[2].value}`)
  console.log(`自动审核最大金额: ¥${withdrawalConfigs[4].value}`)
  console.log(`手续费率: ${(parseFloat(withdrawalConfigs[3].value) * 100).toFixed(2)}%`)
  console.log(`每日提现次数限制: ${withdrawalConfigs[8].value} 次`)
  console.log(`每日提现金额限制: ¥${withdrawalConfigs[9].value}`)
  console.log(`每月提现金额限制: ¥${withdrawalConfigs[10].value}`)
  console.log("─".repeat(60))

  console.log("\n💡 提示：")
  console.log("1. 自动审核功能默认关闭，建议充分测试后再启用")
  console.log("2. 可在后台管理界面调整这些配置参数")
  console.log("3. 修改配置后会立即生效，无需重启服务")
  console.log("4. 建议根据实际业务情况调整风控参数\n")
}

main()
  .catch((e) => {
    console.error("初始化失败:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
