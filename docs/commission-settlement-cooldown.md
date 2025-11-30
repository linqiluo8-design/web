# 佣金结算冷静期机制

## 📋 问题背景

### 原有的安全漏洞

在之前的分销系统中存在一个严重的安全漏洞：

1. 用户通过分销链接购买商品 → 订单支付成功
2. 支付回调**立即**将佣金结算为 `settled` 状态，并加入分销商的 `availableBalance`（可提现余额）
3. 分销商可以**马上提现**
4. ⚠️ **如果用户申请退款，分销商已经提现成功，平台会承受损失**

### 风险场景

- 恶意分销商与买家勾结：买家购买 → 分销商立即提现 → 买家退款
- 正常买家的七天无理由退货：分销商已提现，退款时无法追回佣金
- 虚假交易：刷单后立即提现，订单被发现后取消

## ✅ 解决方案：延迟结算机制

### 核心设计

```
订单支付成功
    ↓
佣金状态：pending → confirmed（已确认）
佣金暂存：pendingCommission（待结算佣金）⏳
    ↓
等待结算冷静期（默认 15 天）
    ↓
无退款 → 自动结算 ✅
佣金状态：confirmed → settled
佣金转入：availableBalance（可提现余额）
    ↓
分销商可以提现

【冷静期内退款】
    ↓
佣金状态：confirmed → cancelled ❌
从 pendingCommission 中扣除
```

## 🔧 技术实现

### 1. 系统配置

**新增配置项**：`commission_settlement_cooldown_days`

- 默认值：15 天
- 说明：订单支付后需等待此期限才能结算佣金
- 配置文件：`scripts/init-withdrawal-configs.ts`

### 2. 支付回调修改

**文件修改**：
- `/app/api/payment/callback/route.ts`
- `/app/api/payment/callback/wechat/route.ts`
- `/app/api/payment/callback/alipay/route.ts`
- `/app/api/payment/callback/paypal/route.ts`

**关键变更**：

```typescript
// ❌ 旧逻辑（有漏洞）
await prisma.distributionOrder.update({
  where: { id: distributionOrder.id },
  data: {
    status: "settled",  // 立即结算
    confirmedAt: new Date(),
    settledAt: new Date()
  }
})

await prisma.distributor.update({
  where: { id: order.distributorId },
  data: {
    totalEarnings: { increment: commissionAmount },
    availableBalance: { increment: commissionAmount }  // 立即可提现
  }
})

// ✅ 新逻辑（安全）
await prisma.distributionOrder.update({
  where: { id: distributionOrder.id },
  data: {
    status: "confirmed",  // 仅确认，不结算
    confirmedAt: new Date()
    // 不设置 settledAt，等待冷静期
  }
})

await prisma.distributor.update({
  where: { id: order.distributorId },
  data: {
    totalEarnings: { increment: commissionAmount },
    pendingCommission: { increment: commissionAmount }  // 进入待结算
  }
})
```

### 3. 自动结算定时任务

**接口**：`GET /api/cron/settle-commissions`

**功能**：
- 查找所有状态为 `confirmed` 且确认时间超过冷静期的分销订单
- 将佣金从 `pendingCommission` 转移到 `availableBalance`
- 更新分销订单状态为 `settled`

**调用方式**：
```bash
# 手动触发
curl https://your-domain.com/api/cron/settle-commissions

# 或配置 cron job（推荐每天凌晨执行）
0 2 * * * curl https://your-domain.com/api/cron/settle-commissions
```

**Vercel Cron Jobs 配置**：
```json
{
  "crons": [{
    "path": "/api/cron/settle-commissions",
    "schedule": "0 2 * * *"
  }]
}
```

### 4. 退款处理接口

**接口**：`POST /api/orders/[id]/refund`

**权限**：仅管理员可调用

**功能**：
1. 将订单状态改为 `refunded`
2. 根据佣金状态处理：

   **情况 A：佣金在冷静期内（confirmed）**
   ```
   - 从 pendingCommission 扣除佣金 ✅
   - 分销订单状态改为 cancelled
   - 无风险，自动处理
   ```

   **情况 B：佣金已结算（settled）且余额充足**
   ```
   - 从 availableBalance 扣除佣金 ✅
   - 分销订单状态改为 cancelled
   - 自动处理
   ```

   **情况 C：佣金已结算但余额不足（已提现）**
   ```
   - 无法扣除，创建高优先级安全警报 ⚠️
   - 需要人工处理
   - 可能需要向分销商追讨
   ```

### 5. 前端提示

**分销中心页面**（`/distribution`）：
- 显示待结算佣金金额
- 当有待结算佣金时，显示冷静期说明提示框

```
⏳ 待结算佣金说明：订单支付成功后，佣金会进入15天的结算冷静期，
期间如果订单退款，佣金将自动取消。超过冷静期后，佣金会自动转入可提现余额。
```

## 📊 数据流转

### 佣金状态流转

```
pending (待确认)
    ↓ 支付成功
confirmed (已确认，冷静期)
    ↓ 超过冷静期
settled (已结算，可提现)
    ↓ 提现
    已提现

【退款场景】
confirmed → cancelled (佣金取消，从 pendingCommission 扣除)
settled → cancelled (佣金取消，从 availableBalance 扣除或创建警报)
```

### 分销商余额变化

**正常流程**：
```
支付成功:
  totalEarnings +100
  pendingCommission +100

15天后自动结算:
  pendingCommission -100
  availableBalance +100

提现:
  availableBalance -100
  withdrawnAmount +100
```

**退款流程（冷静期内）**：
```
退款:
  totalEarnings -100
  pendingCommission -100
```

**退款流程（已结算）**：
```
退款:
  totalEarnings -100
  availableBalance -100 (如果余额足够)
  或创建安全警报 (如果余额不足)
```

## 🚀 部署步骤

### 1. 运行配置初始化

```bash
npx tsx scripts/init-withdrawal-configs.ts
```

这会添加 `commission_settlement_cooldown_days` 配置项。

### 2. 配置定时任务

#### 方式 A：Vercel Cron Jobs

在项目根目录创建 `vercel.json`：

```json
{
  "crons": [{
    "path": "/api/cron/settle-commissions",
    "schedule": "0 2 * * *"
  }]
}
```

#### 方式 B：外部 Cron 服务

使用 [cron-job.org](https://cron-job.org) 或类似服务：
- URL: `https://your-domain.com/api/cron/settle-commissions`
- 执行时间: 每天凌晨 2:00

#### 方式 C：服务器 Cron Tab

```bash
crontab -e

# 添加
0 2 * * * curl https://your-domain.com/api/cron/settle-commissions
```

### 3. 配置冷静期天数（可选）

在系统配置中调整 `commission_settlement_cooldown_days`：
- 建议值：7-30 天
- 默认值：15 天

## 📈 监控和维护

### 需要监控的指标

1. **待结算佣金总额**
   ```sql
   SELECT SUM(pendingCommission) FROM Distributor;
   ```

2. **冷静期订单数量**
   ```sql
   SELECT COUNT(*) FROM DistributionOrder
   WHERE status = 'confirmed';
   ```

3. **自动结算成功率**
   - 检查定时任务日志
   - 确保每天都有执行

4. **退款警报**
   ```sql
   SELECT * FROM SecurityAlert
   WHERE type = 'REFUND_COMMISSION_SHORTAGE'
   AND status = 'pending';
   ```

### 常见问题处理

**Q: 佣金一直不结算？**
- 检查定时任务是否正常运行
- 手动访问 `/api/cron/settle-commissions` 触发结算

**Q: 退款时余额不足怎么办？**
- 系统会创建高优先级安全警报
- 需要人工联系分销商处理
- 可以从未来佣金中扣除

**Q: 冷静期设置多少天合适？**
- 建议 15-30 天
- 需要平衡平台安全性和分销商体验
- 可以参考电商平台的退款期限

## 🔒 安全优势

### 防护效果

✅ **防止恶意套现**：冷静期内无法提现，退款会自动取消佣金

✅ **降低平台损失**：大部分退款发生在7天内，15天冷静期可覆盖大部分风险场景

✅ **自动化处理**：无需人工干预，系统自动结算和取消

✅ **异常警报**：特殊情况（余额不足）会创建警报，便于人工处理

### 与其他机制配合

可以结合提现风控系统使用：
- 首次提现需人工审核
- 大额提现需人工审核
- 新注册分销商需等待更长时间

两者配合形成多层防护体系。

## 📝 总结

通过实施佣金结算冷静期机制：
1. ✅ 有效防止了分销商与买家勾结套现的风险
2. ✅ 降低了退款场景下平台的资金损失
3. ✅ 实现了自动化处理，减少人工成本
4. ✅ 提供了完善的监控和警报机制

这是分销系统中一个**非常重要的安全机制**，强烈建议启用。

---

**版本**: v1.0
**创建日期**: 2025-11-30
**作者**: Claude Code
