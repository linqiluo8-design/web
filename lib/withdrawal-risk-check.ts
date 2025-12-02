/**
 * 提现风控检查工具
 *
 * 用于评估提现申请的风险等级，决定是否可以自动审核
 */

import { prisma } from "@/lib/prisma"

/**
 * 测试用户名单（强制人工审核）
 */
const TEST_USERS = ['test001', 'test002']

/**
 * 系统配置缓存接口
 */
interface WithdrawalConfig {
  withdrawal_auto_approve: boolean
  withdrawal_auto_max_amount: number
  withdrawal_auto_min_days: number
  withdrawal_auto_require_verified: boolean
  withdrawal_bank_info_stable_days: number
  withdrawal_daily_count_limit: number
  withdrawal_daily_amount_limit: number
  withdrawal_monthly_amount_limit: number
  withdrawal_min_amount: number
  withdrawal_max_amount: number

  // 风险权重
  withdrawal_risk_weight_frozen: number
  withdrawal_risk_weight_large_amount: number
  withdrawal_risk_weight_first_withdrawal: number
  withdrawal_risk_weight_not_verified: number
  withdrawal_risk_weight_new_account: number
  withdrawal_risk_weight_high_risk_account: number
  withdrawal_risk_weight_bank_changed: number
  withdrawal_risk_weight_medium_risk_account: number
  withdrawal_risk_weight_daily_limit: number

  // 风险阈值
  withdrawal_risk_threshold_auto: number
  withdrawal_risk_threshold_manual: number
}

/**
 * 风险检查结果
 */
export interface RiskCheckResult {
  canAutoApprove: boolean  // 是否可以自动审核
  riskScore: number        // 风险评分（0-100）
  riskLevel: 'low' | 'medium' | 'high'  // 风险等级
  risks: string[]          // 触发的风险项列表
  reasons: string[]        // 详细原因说明
  shouldAlert: boolean     // 是否需要记录安全警报
}

/**
 * 分销商信息接口（简化版）
 */
interface DistributorInfo {
  id: string
  userId: string
  createdAt: Date
  isVerified: boolean
  verifiedAt: Date | null
  riskLevel: string
  isFrozen: boolean
  frozenReason: string | null
  lastBankInfoUpdate: Date | null
  firstWithdrawalAt: Date | null
}

/**
 * 获取提现配置
 */
async function getWithdrawalConfig(): Promise<WithdrawalConfig> {
  const configs = await prisma.systemConfig.findMany({
    where: {
      category: {
        in: ['withdrawal', 'withdrawal_risk']
      }
    }
  })

  const configMap: any = {}

  for (const config of configs) {
    let value: any = config.value

    // 类型转换
    if (config.type === 'boolean') {
      value = value === 'true'
    } else if (config.type === 'number') {
      value = parseFloat(value)
    }

    configMap[config.key] = value
  }

  // 设置默认值（如果配置不存在）
  return {
    withdrawal_auto_approve: configMap.withdrawal_auto_approve ?? false,
    withdrawal_auto_max_amount: configMap.withdrawal_auto_max_amount ?? 5000,
    withdrawal_auto_min_days: configMap.withdrawal_auto_min_days ?? 30,
    withdrawal_auto_require_verified: configMap.withdrawal_auto_require_verified ?? false,
    withdrawal_bank_info_stable_days: configMap.withdrawal_bank_info_stable_days ?? 7,
    withdrawal_daily_count_limit: configMap.withdrawal_daily_count_limit ?? 3,
    withdrawal_daily_amount_limit: configMap.withdrawal_daily_amount_limit ?? 10000,
    withdrawal_monthly_amount_limit: configMap.withdrawal_monthly_amount_limit ?? 50000,
    withdrawal_min_amount: configMap.withdrawal_min_amount ?? 100,
    withdrawal_max_amount: configMap.withdrawal_max_amount ?? 50000,

    withdrawal_risk_weight_frozen: configMap.withdrawal_risk_weight_frozen ?? 100,
    withdrawal_risk_weight_large_amount: configMap.withdrawal_risk_weight_large_amount ?? 30,
    withdrawal_risk_weight_first_withdrawal: configMap.withdrawal_risk_weight_first_withdrawal ?? 20,
    withdrawal_risk_weight_not_verified: configMap.withdrawal_risk_weight_not_verified ?? 15,
    withdrawal_risk_weight_new_account: configMap.withdrawal_risk_weight_new_account ?? 15,
    withdrawal_risk_weight_high_risk_account: configMap.withdrawal_risk_weight_high_risk_account ?? 10,
    withdrawal_risk_weight_bank_changed: configMap.withdrawal_risk_weight_bank_changed ?? 10,
    withdrawal_risk_weight_medium_risk_account: configMap.withdrawal_risk_weight_medium_risk_account ?? 5,
    withdrawal_risk_weight_daily_limit: configMap.withdrawal_risk_weight_daily_limit ?? 5,

    withdrawal_risk_threshold_auto: configMap.withdrawal_risk_threshold_auto ?? 10,
    withdrawal_risk_threshold_manual: configMap.withdrawal_risk_threshold_manual ?? 30,
  }
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay))
}

/**
 * 获取今日提现统计
 */
async function getTodayWithdrawals(distributorId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const withdrawals = await prisma.commissionWithdrawal.findMany({
    where: {
      distributorId,
      createdAt: {
        gte: today
      },
      status: {
        notIn: ['rejected']  // 不计算已拒绝的
      }
    }
  })

  return {
    count: withdrawals.length,
    amount: withdrawals.reduce((sum, w) => sum + w.amount, 0)
  }
}

/**
 * 获取本月提现统计
 */
async function getMonthlyWithdrawals(distributorId: string) {
  const firstDayOfMonth = new Date()
  firstDayOfMonth.setDate(1)
  firstDayOfMonth.setHours(0, 0, 0, 0)

  const withdrawals = await prisma.commissionWithdrawal.findMany({
    where: {
      distributorId,
      createdAt: {
        gte: firstDayOfMonth
      },
      status: {
        in: ['processing', 'completed']  // 只计算处理中和已完成的
      }
    }
  })

  return {
    count: withdrawals.length,
    amount: withdrawals.reduce((sum, w) => sum + w.amount, 0)
  }
}

/**
 * 执行风险检查
 *
 * @param amount 提现金额
 * @param distributor 分销商信息
 * @returns 风险检查结果
 */
export async function checkWithdrawalRisk(
  amount: number,
  distributor: DistributorInfo
): Promise<RiskCheckResult> {
  const config = await getWithdrawalConfig()
  const now = new Date()

  const risks: string[] = []
  const reasons: string[] = []
  let riskScore = 0

  // 0. 检查是否为测试用户（test001, test002）
  let isTestUser = false
  try {
    const user = await prisma.user.findUnique({
      where: { id: distributor.userId },
      select: { email: true }
    })
    if (user?.email) {
      const emailPrefix = user.email.split('@')[0]
      isTestUser = TEST_USERS.includes(emailPrefix)
      if (isTestUser) {
        risks.push('测试用户')
        reasons.push(`测试用户（${emailPrefix}）提现需人工审核，即使配置了自动审核`)
        riskScore += 50  // 添加风险分数确保不会自动审核
      }
    }
  } catch (error) {
    console.error('检查测试用户失败:', error)
  }

  // 1. 账户冻结检查（权重最高，直接拒绝）
  if (distributor.isFrozen) {
    risks.push('账户已冻结')
    reasons.push(`账户已被冻结: ${distributor.frozenReason || '未说明原因'}`)
    riskScore += config.withdrawal_risk_weight_frozen
  }

  // 2. 金额检查
  if (amount >= config.withdrawal_auto_max_amount) {
    risks.push('大额提现')
    reasons.push(`提现金额 ¥${amount} 超过自动审核限额 ¥${config.withdrawal_auto_max_amount}`)
    riskScore += config.withdrawal_risk_weight_large_amount
  }

  // 3. 首次提现检查
  if (!distributor.firstWithdrawalAt) {
    risks.push('首次提现')
    reasons.push('这是该分销商的首次提现申请，需要额外审核')
    riskScore += config.withdrawal_risk_weight_first_withdrawal
  }

  // 4. 注册天数检查
  const daysSinceRegistration = daysBetween(now, distributor.createdAt)
  if (daysSinceRegistration < config.withdrawal_auto_min_days) {
    risks.push('新注册分销商')
    reasons.push(`注册仅 ${daysSinceRegistration} 天，未满 ${config.withdrawal_auto_min_days} 天要求`)
    riskScore += config.withdrawal_risk_weight_new_account
  }

  // 5. 实名认证检查
  if (config.withdrawal_auto_require_verified && !distributor.isVerified) {
    risks.push('未实名认证')
    reasons.push('该账户未通过实名认证')
    riskScore += config.withdrawal_risk_weight_not_verified
  }

  // 6. 银行信息变更检查
  if (distributor.lastBankInfoUpdate) {
    const daysSinceUpdate = daysBetween(now, distributor.lastBankInfoUpdate)
    if (daysSinceUpdate < config.withdrawal_bank_info_stable_days) {
      risks.push('银行信息近期变更')
      reasons.push(`银行信息在 ${daysSinceUpdate} 天前变更，未满 ${config.withdrawal_bank_info_stable_days} 天稳定期`)
      riskScore += config.withdrawal_risk_weight_bank_changed
    }
  }

  // 7. 每日限额检查
  const todayWithdrawals = await getTodayWithdrawals(distributor.id)
  if (todayWithdrawals.count >= config.withdrawal_daily_count_limit) {
    risks.push('超过每日提现次数')
    reasons.push(`今日已提现 ${todayWithdrawals.count} 次，达到限制 ${config.withdrawal_daily_count_limit} 次`)
    riskScore += config.withdrawal_risk_weight_daily_limit
  }

  if (todayWithdrawals.amount + amount > config.withdrawal_daily_amount_limit) {
    risks.push('超过每日提现金额')
    reasons.push(`今日已提现 ¥${todayWithdrawals.amount.toFixed(2)}，本次申请 ¥${amount}，超过每日限额 ¥${config.withdrawal_daily_amount_limit}`)
    riskScore += config.withdrawal_risk_weight_daily_limit
  }

  // 8. 每月限额检查
  const monthlyWithdrawals = await getMonthlyWithdrawals(distributor.id)
  if (monthlyWithdrawals.amount + amount > config.withdrawal_monthly_amount_limit) {
    risks.push('超过每月提现金额')
    reasons.push(`本月已提现 ¥${monthlyWithdrawals.amount.toFixed(2)}，本次申请 ¥${amount}，超过每月限额 ¥${config.withdrawal_monthly_amount_limit}`)
    riskScore += config.withdrawal_risk_weight_daily_limit
  }

  // 9. 账户风险等级检查
  if (distributor.riskLevel === 'high') {
    risks.push('高风险账户')
    reasons.push('该账户已被标记为高风险')
    riskScore += config.withdrawal_risk_weight_high_risk_account
  } else if (distributor.riskLevel === 'medium') {
    risks.push('中风险账户')
    reasons.push('该账户已被标记为中风险')
    riskScore += config.withdrawal_risk_weight_medium_risk_account
  }

  // 计算风险等级
  let riskLevel: 'low' | 'medium' | 'high' = 'low'
  let canAutoApprove = false
  let shouldAlert = false

  if (riskScore >= config.withdrawal_risk_threshold_manual) {
    riskLevel = 'high'
    canAutoApprove = false
    shouldAlert = true
  } else if (riskScore >= config.withdrawal_risk_threshold_auto) {
    riskLevel = 'medium'
    canAutoApprove = false
    shouldAlert = false
  } else {
    riskLevel = 'low'
    canAutoApprove = config.withdrawal_auto_approve  // 还需要检查总开关
    shouldAlert = false
  }

  return {
    canAutoApprove,
    riskScore,
    riskLevel,
    risks,
    reasons,
    shouldAlert
  }
}

/**
 * 验证提现基础条件（金额、余额等）
 */
export async function validateWithdrawalBasics(
  amount: number,
  distributorId: string
): Promise<{ valid: boolean; error?: string }> {
  const config = await getWithdrawalConfig()

  // 1. 金额范围检查
  if (amount < config.withdrawal_min_amount) {
    return {
      valid: false,
      error: `提现金额不能低于 ¥${config.withdrawal_min_amount}`
    }
  }

  if (amount > config.withdrawal_max_amount) {
    return {
      valid: false,
      error: `提现金额不能超过 ¥${config.withdrawal_max_amount}`
    }
  }

  // 2. 检查是否有待处理的提现
  const pendingWithdrawals = await prisma.commissionWithdrawal.count({
    where: {
      distributorId,
      status: { in: ['pending', 'processing'] }
    }
  })

  if (pendingWithdrawals > 0) {
    return {
      valid: false,
      error: '您有待处理的提现申请，请等待处理完成后再申请'
    }
  }

  // 3. 检查每日次数限制
  const todayWithdrawals = await getTodayWithdrawals(distributorId)
  if (todayWithdrawals.count >= config.withdrawal_daily_count_limit) {
    return {
      valid: false,
      error: `每日最多提现 ${config.withdrawal_daily_count_limit} 次，您今日已达限制`
    }
  }

  // 4. 检查每日金额限制
  if (todayWithdrawals.amount + amount > config.withdrawal_daily_amount_limit) {
    const remaining = config.withdrawal_daily_amount_limit - todayWithdrawals.amount
    return {
      valid: false,
      error: `超过每日提现限额，今日剩余可提现额度：¥${remaining.toFixed(2)}`
    }
  }

  // 5. 检查每月金额限制
  const monthlyWithdrawals = await getMonthlyWithdrawals(distributorId)
  if (monthlyWithdrawals.amount + amount > config.withdrawal_monthly_amount_limit) {
    const remaining = config.withdrawal_monthly_amount_limit - monthlyWithdrawals.amount
    return {
      valid: false,
      error: `超过每月提现限额，本月剩余可提现额度：¥${remaining.toFixed(2)}`
    }
  }

  return { valid: true }
}

/**
 * 记录安全警报
 */
export async function createSecurityAlert(
  distributorId: string,
  userId: string,
  withdrawalAmount: number,
  riskResult: RiskCheckResult,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.securityAlert.create({
      data: {
        type: 'HIGH_RISK_WITHDRAWAL',
        severity: riskResult.riskLevel === 'high' ? 'high' : 'medium',
        userId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        description: `高风险提现申请：金额 ¥${withdrawalAmount}，风险评分 ${riskResult.riskScore}。触发风险：${riskResult.risks.join(', ')}`,
        metadata: JSON.stringify({
          distributorId,
          amount: withdrawalAmount,
          riskScore: riskResult.riskScore,
          risks: riskResult.risks,
          reasons: riskResult.reasons
        }),
        status: 'pending'
      }
    })
  } catch (error) {
    console.error('创建安全警报失败:', error)
    // 不影响主流程，仅记录错误
  }
}
