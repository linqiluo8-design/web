# 佣金自动结算指南

## 📌 概述

分销佣金结算系统支持自动定时结算，无需手动调用API。系统会自动：

1. ✅ 检测已过冷静期的订单
2. ✅ 将佣金从 `pendingCommission` 转移到 `availableBalance`
3. ✅ 更新订单状态为 `settled`
4. ✅ 测试用户（test001/test002）享有0天冷静期，立即结算

---

## 🚀 使用方法

### 生产环境（Vercel 部署）

**自动配置：** 部署到 Vercel 后自动启用

#### 配置说明

`vercel.json` 配置了 Cron Job：

```json
{
  "crons": [
    {
      "path": "/api/cron/settle-commissions",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

**执行频率：** 每 4 小时执行一次（北京时间：00:00、04:00、08:00、12:00、16:00、20:00）

**Cron 表达式说明：**
- `0 */4 * * *` = 每4小时的第0分钟执行
- `0 0 * * *` = 每天凌晨执行
- `0 0,12 * * *` = 每天0点和12点执行

#### 查看执行日志

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目
3. 进入 "Logs" 标签
4. 搜索 "settle-commissions"

---

### 本地开发环境

**方式1：启动自动结算服务（推荐）**

在**单独的终端窗口**中运行：

```bash
# 启动开发服务器（终端1）
npm run dev

# 启动自动结算服务（终端2）
npm run cron:settle
```

**服务特点：**
- ✅ 立即执行一次结算
- ✅ 每4小时自动结算
- ✅ 失败自动重试
- ✅ 详细日志输出
- ✅ 按 Ctrl+C 停止

**输出示例：**
```
╔═══════════════════════════════════════════════════╗
║   🤖 佣金自动结算服务（开发环境）                  ║
╚═══════════════════════════════════════════════════╝

⚙️  配置:
   - API地址: http://localhost:3000/api/cron/settle-commissions
   - 结算间隔: 每 4 小时
   - 立即执行: 是

💡 提示:
   - 测试用户 (test001@example.com, test002@example.com) 享有0天冷静期
   - 普通用户订单需等待冷静期（默认15天）后结算
   - 按 Ctrl+C 停止服务

[2025/12/04 17:52:00] 🔄 开始执行佣金结算...
✅ 结算成功: 成功结算 5 个订单的佣金
   - 已结算: 5 个订单
⏰ 下次结算时间: 2025/12/04 21:52:00

✅ 自动结算服务已启动！
```

**方式2：手动触发结算**

```bash
# 在浏览器访问
http://localhost:3000/api/cron/settle-commissions

# 或使用 curl
curl http://localhost:3000/api/cron/settle-commissions
```

---

## ⚙️ 配置选项

### 修改结算间隔

#### 生产环境（Vercel）

编辑 `vercel.json`：

```json
{
  "crons": [
    {
      "path": "/api/cron/settle-commissions",
      "schedule": "0 */1 * * *"  // 每小时
    }
  ]
}
```

常用 Cron 表达式：

| 表达式 | 说明 |
|--------|------|
| `0 * * * *` | 每小时 |
| `0 */2 * * *` | 每2小时 |
| `0 */4 * * *` | 每4小时（默认）|
| `0 */6 * * *` | 每6小时 |
| `0 0 * * *` | 每天凌晨 |
| `0 0,12 * * *` | 每天0点和12点 |
| `0 0 * * 0` | 每周日凌晨 |

#### 本地开发环境

编辑 `scripts/auto-settle-dev.ts`：

```typescript
// 修改这一行
const INTERVAL_MS = 4 * 60 * 60 * 1000 // 4小时

// 改为
const INTERVAL_MS = 1 * 60 * 60 * 1000 // 1小时
```

### 修改冷静期天数

编辑系统配置（后台管理 → 提现配置）：

1. 登录管理员账号
2. 进入 "后台管理" → "提现配置"
3. 修改 "佣金结算冷静期天数"
4. 保存配置

或直接修改数据库：

```sql
UPDATE "SystemConfig"
SET value = '7'
WHERE key = 'commission_settlement_cooldown_days';
```

---

## 📊 监控和日志

### 查看结算日志

**生产环境：**
```bash
# Vercel CLI
vercel logs --since 1h

# 或在 Vercel Dashboard 查看
```

**本地开发：**
```bash
# 查看自动结算服务输出
npm run cron:settle
```

### 结算API响应格式

**成功：**
```json
{
  "success": true,
  "message": "成功结算 5 个订单的佣金",
  "settled": 5,
  "failed": 0
}
```

**部分失败：**
```json
{
  "success": true,
  "message": "成功结算 3 个订单的佣金",
  "settled": 3,
  "failed": 2,
  "errors": [
    "订单 ORD123: 更新失败 - 数据库连接错误",
    "订单 ORD456: 分销商不存在"
  ]
}
```

**完全失败：**
```json
{
  "success": false,
  "error": "佣金结算失败",
  "message": "数据库连接失败: ..."
}
```

---

## 🐛 故障排查

### 问题1：定时任务不执行

**症状：** 等待很久，佣金没有自动结算

**排查步骤：**

1. **生产环境（Vercel）：**
   ```bash
   # 检查 Cron Job 配置
   cat vercel.json

   # 查看 Vercel 日志
   vercel logs --since 24h
   ```

2. **本地开发：**
   ```bash
   # 确认开发服务器运行
   curl http://localhost:3000/api/cron/settle-commissions

   # 启动自动结算服务
   npm run cron:settle
   ```

### 问题2：结算失败

**症状：** API返回错误或部分订单结算失败

**可能原因：**

1. **数据库连接问题**
   ```bash
   # 检查数据库连接
   psql -U pg -d knowledge_shop -c "SELECT NOW();"
   ```

2. **pendingCommission 数据异常**
   ```bash
   # 运行修复脚本
   npm run db:fix-commission
   ```

3. **订单数据不一致**
   ```sql
   -- 查找异常订单
   SELECT * FROM "DistributionOrder"
   WHERE status = 'confirmed'
     AND "confirmedAt" IS NULL;
   ```

### 问题3：测试用户没有立即结算

**症状：** test001@example.com 的订单没有立即结算

**检查步骤：**

1. **确认测试用户配置：**
   ```typescript
   // app/api/cron/settle-commissions/route.ts
   const TEST_USER_EMAILS = ['test001@example.com', 'test002@example.com']
   ```

2. **手动触发结算：**
   ```bash
   curl http://localhost:3000/api/cron/settle-commissions
   ```

3. **查看订单状态：**
   ```sql
   SELECT
     dorder.id,
     dorder.status,
     dorder."confirmedAt",
     u.email
   FROM "DistributionOrder" dorder
   JOIN "Distributor" d ON dorder."distributorId" = d.id
   JOIN "User" u ON d."userId" = u.id
   WHERE u.email = 'test001@example.com'
   ORDER BY dorder."createdAt" DESC
   LIMIT 10;
   ```

---

## 📚 相关文档

- [佣金结算冷静期设计](./commission-settlement-cooldown.md)
- [分销系统文档](../DISTRIBUTION_SYSTEM_README.md)
- [Prisma Client 使用指南](./PRISMA_CLIENT_GUIDE.md)
- [Vercel Cron Jobs 文档](https://vercel.com/docs/cron-jobs)

---

## 💡 最佳实践

### 生产环境

1. ✅ **使用 Vercel Cron Jobs** - 免费、稳定、无需维护
2. ✅ **设置合理的执行频率** - 推荐每4-6小时
3. ✅ **监控执行日志** - 定期查看 Vercel 日志
4. ✅ **配置告警通知** - 使用 Sentry 或其他监控服务

### 开发环境

1. ✅ **使用自动结算服务** - `npm run cron:settle`
2. ✅ **独立终端运行** - 不阻塞开发服务器
3. ✅ **关注日志输出** - 及时发现问题
4. ✅ **测试完整流程** - 从订单创建到自动结算

### 测试建议

```bash
# 1. 创建测试订单（使用 test001 账号）
# 2. 启动自动结算服务
npm run cron:settle

# 3. 观察日志，确认立即结算
# 4. 验证数据库数据正确
```

---

**文档创建时间**: 2025-12-04
**最后更新时间**: 2025-12-04
**维护者**: Claude Code Assistant
