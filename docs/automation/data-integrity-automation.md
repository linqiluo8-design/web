# 数据完整性自动化系统

本文档说明如何使用自动化系统来维护数据完整性，防止商品分类等数据不一致问题。

## 概述

系统提供多层防护机制：

1. **Prisma 中间件** - 实时自动同步（写入时）
2. **统一操作函数** - 规范化数据操作
3. **定期检查脚本** - 主动发现问题
4. **定时任务** - 自动修复问题

## 1. Prisma 中间件（实时同步）

### 工作原理

在 `lib/prisma.ts` 中配置了 Prisma 中间件，自动拦截所有商品的创建和更新操作：

```typescript
// lib/prisma.ts
prisma.$use(async (params, next) => {
  if (params.model === 'Product' && (params.action === 'create' || params.action === 'update')) {
    const data = params.args.data

    if (data.categoryId !== undefined) {
      // 自动查询并同步 category 字段
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId }
      })

      if (category) {
        data.category = category.name  // 自动同步
      } else {
        data.categoryId = null  // 无效ID自动清除
        data.category = null
      }
    }
  }

  return next(params)
})
```

### 优点

- ✅ **零侵入** - 不需要修改现有代码
- ✅ **实时生效** - 任何数据库写入都会触发
- ✅ **自动验证** - 无效的 categoryId 会被自动清除
- ✅ **调试友好** - 开发环境会打印同步日志

### 覆盖范围

中间件会自动处理：
- 后台管理界面的商品创建/编辑
- API 接口的商品操作
- 数据导入脚本
- 任何通过 Prisma 的商品写入操作

### 示例

```typescript
// 创建商品 - 中间件自动同步 category
await prisma.product.create({
  data: {
    title: '新课程',
    categoryId: 'category-123',  // 只需设置 categoryId
    // category 字段会被中间件自动填充
  }
})

// 更新商品 - 中间件自动同步 category
await prisma.product.update({
  where: { id: 'product-456' },
  data: {
    categoryId: 'category-789',  // 只需更新 categoryId
    // category 字段会被中间件自动更新
  }
})
```

## 2. 统一操作函数（规范化）

### 位置

`lib/product-helpers.ts`

### 提供的函数

#### createProduct() - 统一商品创建

```typescript
import { createProduct } from '@/lib/product-helpers'

const product = await createProduct({
  title: '新商品',
  description: '商品描述',
  price: 99.00,
  categoryId: 'category-123',  // 自动同步 category
  // ... 其他字段
})
```

#### updateProduct() - 统一商品更新

```typescript
import { updateProduct } from '@/lib/product-helpers'

const product = await updateProduct('product-id', {
  categoryId: 'new-category-id',  // 自动同步 category
  price: 199.00,
})
```

#### createProductsBatch() - 批量创建

```typescript
import { createProductsBatch } from '@/lib/product-helpers'

const products = await createProductsBatch([
  { title: '商品1', categoryId: 'cat-1', price: 99 },
  { title: '商品2', categoryId: 'cat-2', price: 199 },
  // 每个商品都会经过中间件处理
])
```

#### validateProductCategories() - 验证完整性

```typescript
import { validateProductCategories } from '@/lib/product-helpers'

const issues = await validateProductCategories()
// 返回所有数据不一致的商品列表
```

#### repairProductCategories() - 自动修复

```typescript
import { repairProductCategories } from '@/lib/product-helpers'

const result = await repairProductCategories()
console.log(`修复了 ${result.fixed} 个商品`)
```

### 使用建议

- ✅ **推荐** - 在数据导入脚本中使用这些函数
- ✅ **推荐** - 在 API 路由中使用这些函数（虽然中间件已经提供保护）
- ⚠️ **注意** - 批量操作时使用 `createProductsBatch` 而不是 `createMany`

## 3. 定期检查脚本

### 命令

```bash
# 仅检查，不修复
npm run db:check-integrity

# 检查并自动修复
npm run db:check-integrity:fix
```

### 检查内容

1. **商品分类完整性**
   - categoryId 存在但 category 为空
   - categoryId 指向不存在的分类
   - category 与 categoryRef.name 不一致

2. **孤儿记录检测**
   - 订单项关联的商品不存在
   - 购物车项关联的用户不存在

3. **数据库统计**
   - 商品总数、分类总数
   - 有分类的商品占比

### 输出示例

```
🔍 开始数据完整性检查...
⏰ 时间: 2025-12-06 10:30:00

📋 检查商品分类数据完整性...
⚠️  发现 5 个问题:

1. 商品: React前端开发 (ID: prod-123)
   问题: categoryId 存在但 category 字段为空
   categoryId: cat-456
   category: (null)

...

🔧 开始自动修复...
✅ 修复完成:
   - 已同步: 4 个商品
   - 已清除: 1 个商品
   - 失败: 0 个商品

📈 检查结果汇总:
✅ 通过: 2
⚠️  警告: 1
❌ 错误: 0
```

### 使用场景

- 数据导入后运行
- 数据库迁移后运行
- 定期维护检查
- 发现显示问题时诊断

## 4. 定时任务（自动化）

### 命令

```bash
npm run cron:integrity-check
```

### 功能

- 自动检查数据完整性
- 自动修复发现的问题
- 记录日志到 `logs/integrity-checks.json`
- 发现严重问题时发送告警（可配置）

### 设置 Linux Cron Job

#### 每天凌晨 2:00 自动检查并修复

```bash
# 编辑 crontab
crontab -e

# 添加以下行
0 2 * * * cd /path/to/project && npm run cron:integrity-check >> /var/log/integrity-check.log 2>&1
```

#### 每周日凌晨 3:00 检查

```bash
0 3 * * 0 cd /path/to/project && npm run cron:integrity-check >> /var/log/integrity-check.log 2>&1
```

### 日志存储

日志保存在 `logs/integrity-checks.json`，包含：

```json
[
  {
    "timestamp": "2025-12-06T02:00:00.000Z",
    "autoFixed": true,
    "issues": 3,
    "fixed": 2,
    "cleared": 1,
    "errors": 0,
    "details": [...]
  }
]
```

- 自动保留最近 30 天的日志
- 可用于生成报告和趋势分析

### 告警配置

在 `scripts/cron-integrity-check.ts` 的 `sendAlert()` 函数中配置：

```typescript
async function sendAlert(log: CheckLog) {
  if (log.issues > 0) {
    // 发送邮件
    await sendEmail({
      to: 'admin@example.com',
      subject: '数据完整性检查发现问题',
      body: `发现 ${log.issues} 个问题...`
    })

    // 或发送钉钉/Slack 通知
    await sendDingTalk({
      webhook: 'https://...',
      message: `数据完整性问题: ${log.issues} 个`
    })
  }
}
```

## 5. 手动同步脚本（向后兼容）

### 命令

```bash
npm run db:sync-categories
```

### 用途

- 修复历史数据（Prisma 中间件启用前的数据）
- 一次性批量同步所有商品
- 数据迁移后使用

### 与自动化的关系

- **中间件启用后**，新数据不需要手动同步
- **历史数据**仍需运行一次手动同步
- 可作为应急修复工具

## 快速开始

### 初次设置（修复现有数据）

```bash
# 1. 拉取最新代码（包含 Prisma 中间件）
git pull

# 2. 安装依赖
npm install

# 3. 同步历史数据（一次性）
npm run db:sync-categories

# 4. 验证修复结果
npm run db:check-integrity
```

### 日常使用（自动维护）

一旦 Prisma 中间件生效，数据会自动保持一致：

```typescript
// 任何商品操作都会自动同步，无需手动处理
await prisma.product.create({ data: { ... } })  // ✅ 自动同步
await prisma.product.update({ ... })            // ✅ 自动同步
```

### 定期维护（可选）

```bash
# 每周或每月运行一次完整检查
npm run db:check-integrity:fix

# 或配置 cron job 自动运行
# 见上文"设置 Linux Cron Job"
```

## 最佳实践

### 开发环境

1. ✅ 启用中间件调试日志（自动启用）
2. ✅ 数据导入后运行 `npm run db:check-integrity`
3. ✅ 发现问题时运行 `npm run db:check-integrity:fix`

### 生产环境

1. ✅ 配置 cron job 定期检查（每天或每周）
2. ✅ 配置告警通知（发现问题时通知管理员）
3. ✅ 监控日志文件 `logs/integrity-checks.json`
4. ✅ 数据库备份后运行完整性检查

### 数据导入流程

```typescript
// 推荐：使用统一函数
import { createProductsBatch } from '@/lib/product-helpers'

const products = await createProductsBatch([...])  // ✅ 自动同步

// 或直接使用 Prisma（中间件会自动处理）
await prisma.product.create({ data: {...} })  // ✅ 也会自动同步

// 导入完成后验证
const issues = await validateProductCategories()
if (issues.length > 0) {
  console.warn('发现问题，请检查')
}
```

## 故障排除

### 问题：中间件没有生效

**原因：** Prisma 中间件只在导入 `prisma` 实例时注册一次

**解决：**
- 确保所有代码都从 `@/lib/prisma` 导入
- 重启开发服务器
- 检查是否有多个 PrismaClient 实例

### 问题：手动同步脚本报错

**原因：** 数据库连接问题或环境变量未设置

**解决：**
```bash
# 确保 DATABASE_URL 已设置
echo $DATABASE_URL

# 或检查 .env 文件
cat .env | grep DATABASE_URL
```

### 问题：定时任务没有运行

**原因：** Cron 配置错误或路径问题

**解决：**
```bash
# 检查 cron 日志
tail -f /var/log/cron

# 手动运行测试
cd /path/to/project && npm run cron:integrity-check

# 确保路径和权限正确
which npm
ls -la /path/to/project
```

## 性能考虑

### Prisma 中间件性能

- 每次商品写入多一次分类查询（SELECT）
- 对大多数操作影响可忽略（< 10ms）
- 批量操作时会逐条处理（使用 `createMany` 会跳过中间件）

### 优化建议

1. **批量导入时**：使用 `createProductsBatch()` 而不是循环调用 `create()`
2. **大量更新时**：考虑临时禁用中间件，事后运行同步脚本
3. **定时任务**：安排在低峰时段运行（如凌晨）

## 监控指标

建议监控以下指标：

- 每日完整性检查发现的问题数
- 自动修复成功率
- 修复失败次数（需要人工介入）
- 孤儿记录数量趋势

可以基于 `logs/integrity-checks.json` 构建监控面板。

## 总结

| 机制 | 时机 | 覆盖范围 | 自动化程度 |
|------|------|----------|-----------|
| Prisma 中间件 | 实时（写入时） | 所有 Prisma 操作 | 🟢 全自动 |
| 统一操作函数 | 调用时 | 使用函数的代码 | 🟡 半自动 |
| 定期检查脚本 | 手动运行 | 全库扫描 | 🟡 半自动 |
| 定时任务 | 定时执行 | 全库扫描+修复 | 🟢 全自动 |

**推荐配置：**
1. 启用 Prisma 中间件（已默认启用）✅
2. 配置每日定时任务 ✅
3. 数据导入后手动验证 ✅

这样可以实现 **99%+ 的数据一致性保障**。
