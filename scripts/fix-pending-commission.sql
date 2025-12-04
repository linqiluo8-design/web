-- ============================================================
-- 分销佣金数据修复脚本
-- ============================================================
-- 问题：历史测试订单跳过了支付回调，导致 pendingCommission 为负数
-- 解决：重新计算所有分销商的统计数据
-- ============================================================

-- 1. 修正 test001@example.com 的数据（立即修复）
UPDATE "Distributor" d
SET
  "pendingCommission" = 0,
  "totalEarnings" = 1089.5
FROM "User" u
WHERE d."userId" = u.id
  AND u.email = 'test001@example.com';

-- 2. 查找所有 pendingCommission 为负数的分销商
SELECT
  d.id,
  u.email,
  d."totalEarnings",
  d."pendingCommission",
  d."availableBalance",
  d."withdrawnAmount"
FROM "Distributor" d
JOIN "User" u ON d."userId" = u.id
WHERE d."pendingCommission" < 0;

-- 3. 通用修复脚本（可选执行）
-- 为所有分销商重新计算统计数据
WITH order_stats AS (
  SELECT
    "distributorId",
    -- 总收益 = 所有已确认和已结算订单的佣金总和
    COALESCE(SUM(CASE
      WHEN status IN ('confirmed', 'settled') THEN "commissionAmount"
      ELSE 0
    END), 0) as calculated_total_earnings,
    -- 待结算佣金 = 已确认但未结算的订单佣金总和
    COALESCE(SUM(CASE
      WHEN status = 'confirmed' THEN "commissionAmount"
      ELSE 0
    END), 0) as calculated_pending_commission,
    -- 可提现余额 = 已结算的订单佣金总和
    COALESCE(SUM(CASE
      WHEN status = 'settled' THEN "commissionAmount"
      ELSE 0
    END), 0) as calculated_available_balance
  FROM "DistributionOrder"
  GROUP BY "distributorId"
)
UPDATE "Distributor" d
SET
  "totalEarnings" = COALESCE(os.calculated_total_earnings, 0),
  "pendingCommission" = COALESCE(os.calculated_pending_commission, 0),
  "availableBalance" = COALESCE(os.calculated_available_balance, 0)
FROM order_stats os
WHERE d.id = os."distributorId"
  -- 只更新数据不一致的记录
  AND (
    d."totalEarnings" != COALESCE(os.calculated_total_earnings, 0) OR
    d."pendingCommission" != COALESCE(os.calculated_pending_commission, 0) OR
    d."availableBalance" != COALESCE(os.calculated_available_balance, 0)
  );

-- 4. 验证修复结果
SELECT
  u.email,
  d."totalEarnings",
  d."pendingCommission",
  d."availableBalance",
  d."withdrawnAmount",
  -- 计算应有的值
  (SELECT COALESCE(SUM("commissionAmount"), 0)
   FROM "DistributionOrder"
   WHERE "distributorId" = d.id AND status IN ('confirmed', 'settled')) as expected_total,
  (SELECT COALESCE(SUM("commissionAmount"), 0)
   FROM "DistributionOrder"
   WHERE "distributorId" = d.id AND status = 'confirmed') as expected_pending,
  (SELECT COALESCE(SUM("commissionAmount"), 0)
   FROM "DistributionOrder"
   WHERE "distributorId" = d.id AND status = 'settled') as expected_available
FROM "Distributor" d
JOIN "User" u ON d."userId" = u.id
WHERE d."pendingCommission" < 0
   OR d."totalEarnings" < 0
   OR d."availableBalance" < 0
ORDER BY u.email;

-- 5. 查看修复后的 test001 数据
SELECT
  u.email,
  d."totalEarnings",
  d."pendingCommission",
  d."availableBalance",
  d."withdrawnAmount"
FROM "Distributor" d
JOIN "User" u ON d."userId" = u.id
WHERE u.email = 'test001@example.com';
