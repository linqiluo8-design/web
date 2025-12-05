# 分销佣金数据修复指南

## 📌 问题背景

### 问题描述

在实现 `pendingCommission`（待结算佣金）字段后，发现测试用户 `test001@example.com` 的数据出现异常：

- `pendingCommission` = **-1089.5**（负数）❌
- `totalEarnings` = **0**（应该是 1089.5）❌
- `availableBalance` = **1089.5**（正确）✅

### 根本原因

1. **正常流程（正确）：**
   ```
   订单支付成功 → 支付回调 → 确认订单
   ├─ status: "pending" → "confirmed"
   ├─ totalEarnings += 佣金
   └─ pendingCommission += 佣金

   冷静期到期 → 自动结算
   ├─ status: "confirmed" → "settled"
   ├─ pendingCommission -= 佣金
   └─ availableBalance += 佣金
   ```

2. **test001 的实际情况（错误）：**
   ```
   手动创建测试数据 → 直接设置 status = "confirmed"
   ├─ 跳过了支付回调
   ├─ totalEarnings 未更新（保持 0）
   └─ pendingCommission 未更新（保持 0）

   冷静期到期 → 自动结算
   ├─ status: "confirmed" → "settled"
   ├─ pendingCommission -= 佣金  ← 导致负数！
   └─ availableBalance += 佣金
   ```

### 影响范围

- ✅ **正常用户不受影响**：通过正常支付流程创建的订单数据正确
- ⚠️ **测试数据受影响**：手动创建或跳过支付回调的测试订单数据异常
- ⚠️ **历史数据**：在添加 `pendingCommission` 字段之前的订单可能存在类似问题

---

## 🔧 解决方案

### 方案1：SQL 脚本修复（快速）

**适用场景：** 快速修复已知的特定用户数据

#### 1️⃣ 修复 test001 用户

```sql
UPDATE "Distributor" d
SET
  "pendingCommission" = 0,
  "totalEarnings" = 1089.5
FROM "User" u
WHERE d."userId" = u.id
  AND u.email = 'test001@example.com';
```

#### 2️⃣ 查找所有异常数据

```sql
SELECT
  d.id,
  u.email,
  d."totalEarnings",
  d."pendingCommission",
  d."availableBalance"
FROM "Distributor" d
JOIN "User" u ON d."userId" = u.id
WHERE d."pendingCommission" < 0
   OR d."totalEarnings" < 0
   OR d."availableBalance" < 0;
```

#### 3️⃣ 完整 SQL 脚本

执行 `scripts/fix-pending-commission.sql`：

```bash
psql -U pg -d knowledge_shop -f scripts/fix-pending-commission.sql
```

---

### 方案2：TypeScript 脚本修复（推荐）

**适用场景：** 自动重新计算所有分销商的统计数据，适合生产环境

#### 执行命令

```bash
npm run db:fix-commission
```

或直接运行：

```bash
tsx scripts/recalculate-distributor-stats.ts
```

#### 脚本功能

1. ✅ 遍历所有分销商
2. ✅ 根据订单状态重新计算：
   - `totalEarnings` = 所有 `confirmed` 和 `settled` 订单佣金总和
   - `pendingCommission` = 所有 `confirmed` 订单佣金总和
   - `availableBalance` = 所有 `settled` 订单佣金总和
3. ✅ 只更新数据不一致的记录
4. ✅ 输出详细的修复日志
5. ✅ 最后验证是否还有问题数据

#### 输出示例

```
🔄 开始重新计算分销商统计数据...

📊 找到 15 个分销商

🔧 修复分销商: test001@example.com
   旧值: totalEarnings=0, pendingCommission=-1089.5, availableBalance=1089.5
   新值: totalEarnings=1089.5, pendingCommission=0, availableBalance=1089.5
   ✅ 已修复

📈 统计结果:
   ✅ 已修复: 1 个分销商
   ⚠️  跳过: 14 个分销商（数据正确）
   ❌ 错误: 0 个分销商

✅ 所有分销商数据正常！

✅ 脚本执行完成
```

---

## 📋 验证修复结果

### 1️⃣ 查看 test001 数据

```sql
SELECT
  u.email,
  d."totalEarnings",
  d."pendingCommission",
  d."availableBalance",
  d."withdrawnAmount"
FROM "Distributor" d
JOIN "User" u ON d."userId" = u.id
WHERE u.email = 'test001@example.com';
```

**预期结果：**
```
email                  | totalEarnings | pendingCommission | availableBalance | withdrawnAmount
-----------------------|---------------|-------------------|------------------|----------------
test001@example.com    | 1089.5        | 0                 | 1089.5           | 0
```

### 2️⃣ 验证订单状态

```sql
SELECT
  dorder.id,
  dorder.status,
  dorder."commissionAmount",
  dorder."confirmedAt",
  dorder."settledAt",
  u.email
FROM "DistributionOrder" dorder
JOIN "Distributor" d ON dorder."distributorId" = d.id
JOIN "User" u ON d."userId" = u.id
WHERE u.email = 'test001@example.com'
ORDER BY dorder."settledAt" DESC;
```

**预期结果：**
- 所有订单状态为 `settled`
- 所有订单都有 `settledAt` 时间戳

### 3️⃣ 查找其他异常数据

```sql
SELECT
  u.email,
  d."totalEarnings",
  d."pendingCommission",
  d."availableBalance"
FROM "Distributor" d
JOIN "User" u ON d."userId" = u.id
WHERE d."pendingCommission" < 0
   OR d."totalEarnings" < 0
   OR d."availableBalance" < 0;
```

**预期结果：** 空结果（没有异常数据）

---

## 🛡️ 预防措施

### 1. 确保所有支付回调正确实现

所有支付回调都必须包含佣金确认逻辑：

```typescript
// 更新分销订单状态
await prisma.distributionOrder.update({
  where: { id: distributionOrder.id },
  data: {
    status: "confirmed",
    confirmedAt: new Date()
  }
})

// 更新分销商统计（重要！）
await prisma.distributor.update({
  where: { id: order.distributorId },
  data: {
    totalEarnings: { increment: distributionOrder.commissionAmount },
    pendingCommission: { increment: distributionOrder.commissionAmount }
  }
})
```

**已实现的支付回调：**
- ✅ `app/api/payment/callback/route.ts` - 通用回调
- ✅ `app/api/payment/callback/alipay/route.ts` - 支付宝
- ✅ `app/api/payment/callback/wechat/route.ts` - 微信支付
- ✅ `app/api/payment/callback/paypal/route.ts` - PayPal

### 2. 测试数据创建规范

**❌ 错误做法：**
```typescript
// 直接创建 confirmed 状态的订单
await prisma.distributionOrder.create({
  data: {
    status: "confirmed",  // 跳过了佣金确认逻辑
    distributorId,
    orderId,
    commissionAmount
  }
})
```

**✅ 正确做法：**
```typescript
// 方法1：模拟完整支付流程
await createOrder()  // 创建订单
await mockPaymentCallback()  // 模拟支付回调
await settlementCron()  // 等待结算

// 方法2：手动更新分销商统计
const order = await prisma.distributionOrder.create({
  data: { status: "confirmed", ... }
})

await prisma.distributor.update({
  where: { id: distributorId },
  data: {
    totalEarnings: { increment: commissionAmount },
    pendingCommission: { increment: commissionAmount }
  }
})
```

### 3. 定期数据一致性检查

建议在生产环境定期运行数据修复脚本（例如每周一次）：

```bash
# 添加到 crontab
0 2 * * 0 cd /path/to/project && npm run db:fix-commission
```

---

## 📚 相关文档

- [Prisma Client 使用指南](./PRISMA_CLIENT_GUIDE.md)
- [佣金结算冷静期设计](./commission-settlement-cooldown.md)
- [分销系统文档](../DISTRIBUTION_SYSTEM_README.md)

---

**文档创建时间**: 2025-12-04
**最后更新时间**: 2025-12-04
**维护者**: Claude Code Assistant
