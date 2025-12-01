-- 插入提现配置数据
-- 使用 ON CONFLICT DO NOTHING 避免重复插入

-- ===== 基础配置 =====
INSERT INTO "SystemConfig" (key, value, type, category, description, "createdAt", "updatedAt")
VALUES
  ('withdrawal_auto_approve', 'false', 'boolean', 'withdrawal', '是否启用提现自动审核（默认关闭，建议测试完成后再启用）', NOW(), NOW()),
  ('withdrawal_min_amount', '100', 'number', 'withdrawal', '最低提现金额（元）', NOW(), NOW()),
  ('withdrawal_max_amount', '50000', 'number', 'withdrawal', '最高提现金额（元）', NOW(), NOW()),
  ('withdrawal_fee_rate', '0.02', 'number', 'withdrawal', '提现手续费率（如 0.02 表示 2%）', NOW(), NOW()),
  ('commission_settlement_cooldown_days', '15', 'number', 'withdrawal', '佣金结算冷静期（天），订单支付后需等待此期限才能结算佣金，防止退款风险', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- ===== 自动审核条件配置 =====
INSERT INTO "SystemConfig" (key, value, type, category, description, "createdAt", "updatedAt")
VALUES
  ('withdrawal_auto_max_amount', '5000', 'number', 'withdrawal', '自动审核最大金额（元），超过此金额必须人工审核', NOW(), NOW()),
  ('withdrawal_auto_min_days', '30', 'number', 'withdrawal', '自动审核要求的最少注册天数，新注册分销商需人工审核', NOW(), NOW()),
  ('withdrawal_auto_require_verified', 'false', 'boolean', 'withdrawal', '自动审核是否要求实名认证（建议启用以提高安全性）', NOW(), NOW()),
  ('withdrawal_bank_info_stable_days', '7', 'number', 'withdrawal', '银行信息稳定期要求（天），最近变更过银行信息需人工审核', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- ===== 风控规则配置 =====
INSERT INTO "SystemConfig" (key, value, type, category, description, "createdAt", "updatedAt")
VALUES
  ('withdrawal_daily_count_limit', '3', 'number', 'withdrawal', '每日提现次数限制，超过限制将被拒绝', NOW(), NOW()),
  ('withdrawal_daily_amount_limit', '10000', 'number', 'withdrawal', '每日提现金额限制（元），超过限制将被拒绝', NOW(), NOW()),
  ('withdrawal_monthly_amount_limit', '50000', 'number', 'withdrawal', '每月提现总额限制（元），超过限制将被拒绝', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- ===== 风险评分权重配置 =====
INSERT INTO "SystemConfig" (key, value, type, category, description, "createdAt", "updatedAt")
VALUES
  ('withdrawal_risk_weight_frozen', '100', 'number', 'withdrawal_risk', '风险权重：账户冻结（直接拒绝）', NOW(), NOW()),
  ('withdrawal_risk_weight_large_amount', '30', 'number', 'withdrawal_risk', '风险权重：大额提现（≥自动审核最大金额）', NOW(), NOW()),
  ('withdrawal_risk_weight_first_withdrawal', '20', 'number', 'withdrawal_risk', '风险权重：首次提现', NOW(), NOW()),
  ('withdrawal_risk_weight_not_verified', '15', 'number', 'withdrawal_risk', '风险权重：未实名认证', NOW(), NOW()),
  ('withdrawal_risk_weight_new_account', '15', 'number', 'withdrawal_risk', '风险权重：新注册账户（<最少注册天数）', NOW(), NOW()),
  ('withdrawal_risk_weight_high_risk_account', '10', 'number', 'withdrawal_risk', '风险权重：高风险账户（人工标记）', NOW(), NOW()),
  ('withdrawal_risk_weight_bank_changed', '10', 'number', 'withdrawal_risk', '风险权重：银行信息近期变更', NOW(), NOW()),
  ('withdrawal_risk_weight_medium_risk_account', '5', 'number', 'withdrawal_risk', '风险权重：中风险账户（人工标记）', NOW(), NOW()),
  ('withdrawal_risk_weight_daily_limit', '5', 'number', 'withdrawal_risk', '风险权重：超过每日提现限制', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- ===== 风险等级阈值配置 =====
INSERT INTO "SystemConfig" (key, value, type, category, description, "createdAt", "updatedAt")
VALUES
  ('withdrawal_risk_threshold_auto', '10', 'number', 'withdrawal_risk', '自动审核风险评分阈值，低于此分数可自动审核', NOW(), NOW()),
  ('withdrawal_risk_threshold_manual', '30', 'number', 'withdrawal_risk', '人工审核风险评分阈值，高于此分数记录安全警报', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- 显示结果
SELECT COUNT(*) as "配置项总数" FROM "SystemConfig" WHERE category IN ('withdrawal', 'withdrawal_risk');
