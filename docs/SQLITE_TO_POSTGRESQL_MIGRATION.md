# SQLite 到 PostgreSQL 数据库迁移指南

本指南详细说明如何将项目从 SQLite 数据库迁移到 PostgreSQL 数据库。

## 目录

- [为什么迁移到 PostgreSQL](#为什么迁移到-postgresql)
- [准备工作](#准备工作)
- [配置步骤](#配置步骤)
- [数据迁移方法](#数据迁移方法)
- [验证和测试](#验证和测试)
- [常见问题](#常见问题)
- [回滚方案](#回滚方案)

---

## 为什么迁移到 PostgreSQL

### SQLite 的限制

- 不支持多用户并发写入
- 文件锁定可能导致性能问题
- 不适合生产环境的高并发场景
- 缺少某些高级特性（如全文搜索、JSON 操作等）

### PostgreSQL 的优势

- ✅ 支持高并发读写
- ✅ 更好的性能和可扩展性
- ✅ 完整的 ACID 事务支持
- ✅ 丰富的数据类型和索引
- ✅ 适合生产环境部署
- ✅ 支持云端托管（Vercel Postgres, Supabase, AWS RDS 等）

---

## 准备工作

### 1. 安装 PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS (使用 Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
下载并安装 [PostgreSQL 官方安装包](https://www.postgresql.org/download/windows/)

### 2. 启动 PostgreSQL 服务

**Linux:**
```bash
sudo service postgresql start
# 或
sudo systemctl start postgresql
```

**macOS:**
```bash
brew services start postgresql@15
```

**Windows:**
在"服务"管理器中启动 PostgreSQL 服务

### 3. 创建数据库和用户

```bash
# 连接到 PostgreSQL
sudo -u postgres psql

# 或者使用默认用户
psql -U postgres
```

**在 PostgreSQL 命令行中执行：**
```sql
-- 创建用户（如果不存在）
CREATE USER pg WITH PASSWORD 'postgresql';

-- 创建数据库
CREATE DATABASE knowledge_shop;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE knowledge_shop TO pg;

-- 退出
\q
```

### 4. 测试连接

```bash
psql -h 127.0.0.1 -U pg -d knowledge_shop -c "SELECT version();"
```

如果成功显示 PostgreSQL 版本信息，说明连接正常。

---

## 配置步骤

### 步骤 1: 备份现有 SQLite 数据库

```bash
# 如果有现有的 SQLite 数据库，先备份
cp prisma/dev.db prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)
```

### 步骤 2: 更新 Prisma Schema

编辑 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"  // 从 "sqlite" 改为 "postgresql"
  url      = env("DATABASE_URL")
}
```

### 步骤 3: 更新环境变量

编辑 `.env` 文件：

```env
# 从 SQLite
# DATABASE_URL="file:./dev.db"

# 改为 PostgreSQL
DATABASE_URL="postgresql://pg:postgresql@127.0.0.1:5432/knowledge_shop"
```

**PostgreSQL 连接字符串格式：**
```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]
```

**示例：**
```env
# 本地开发
DATABASE_URL="postgresql://pg:postgresql@127.0.0.1:5432/knowledge_shop"

# Vercel Postgres (生产环境)
DATABASE_URL="postgres://username:password@host.vercel-storage.com:5432/verceldb"

# Supabase
DATABASE_URL="postgresql://postgres:password@db.supabase.co:5432/postgres"
```

### 步骤 4: 删除旧的迁移文件（可选）

如果你想重新开始迁移历史：

```bash
# 删除旧的 SQLite 迁移记录
rm -rf prisma/migrations
```

### 步骤 5: 创建 PostgreSQL 表结构

```bash
# 生成并应用迁移
npx prisma migrate dev --name init_postgresql

# 或者直接推送 schema（不创建迁移文件）
npx prisma db push
```

### 步骤 6: 生成 Prisma Client

```bash
npx prisma generate
```

---

## 数据迁移方法

### 方法一：使用 Prisma + TypeScript 脚本（推荐）

这是最安全和可控的方法，适合生产数据迁移。

#### 1. 创建迁移脚本

创建文件 `scripts/migrate-sqlite-to-postgres.ts`：

```typescript
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

// SQLite 连接（使用旧数据库）
const sqliteUrl = 'file:./prisma/dev.db'
const sqliteClient = new PrismaClient({
  datasources: {
    db: {
      url: sqliteUrl,
    },
  },
})

// PostgreSQL 连接（使用当前 .env 配置）
const postgresClient = new PrismaClient()

interface MigrationStats {
  [key: string]: number
}

async function migrate() {
  const stats: MigrationStats = {}

  console.log('=' .repeat(60))
  console.log('开始数据迁移：SQLite → PostgreSQL')
  console.log('=' .repeat(60))
  console.log()

  try {
    // ====== 1. 迁移用户数据 ======
    console.log('📦 迁移用户数据...')
    const users = await sqliteClient.user.findMany({
      include: {
        permissions: true,
      },
    })

    for (const user of users) {
      const { permissions, ...userData } = user

      // 创建用户
      await postgresClient.user.create({
        data: userData,
      })

      // 创建权限
      for (const permission of permissions) {
        await postgresClient.permission.create({
          data: permission,
        })
      }
    }
    stats['用户'] = users.length
    console.log(`   ✓ 已迁移 ${users.length} 个用户\n`)

    // ====== 2. 迁移分类数据 ======
    console.log('📦 迁移分类数据...')
    const categories = await sqliteClient.category.findMany()
    for (const category of categories) {
      await postgresClient.category.create({ data: category })
    }
    stats['分类'] = categories.length
    console.log(`   ✓ 已迁移 ${categories.length} 个分类\n`)

    // ====== 3. 迁移商品数据 ======
    console.log('📦 迁移商品数据...')
    const products = await sqliteClient.product.findMany()
    for (const product of products) {
      await postgresClient.product.create({ data: product })
    }
    stats['商品'] = products.length
    console.log(`   ✓ 已迁移 ${products.length} 个商品\n`)

    // ====== 4. 迁移会员方案 ======
    console.log('📦 迁移会员方案数据...')
    const plans = await sqliteClient.membershipPlan.findMany()
    for (const plan of plans) {
      await postgresClient.membershipPlan.create({ data: plan })
    }
    stats['会员方案'] = plans.length
    console.log(`   ✓ 已迁移 ${plans.length} 个会员方案\n`)

    // ====== 5. 迁移会员购买记录 ======
    console.log('📦 迁移会员购买记录...')
    const memberships = await sqliteClient.membership.findMany({
      include: {
        usageRecords: true,
      },
    })

    for (const membership of memberships) {
      const { usageRecords, ...membershipData } = membership

      // 创建会员记录
      await postgresClient.membership.create({
        data: membershipData,
      })

      // 创建使用记录
      for (const usage of usageRecords) {
        await postgresClient.membershipUsage.create({
          data: usage,
        })
      }
    }
    stats['会员记录'] = memberships.length
    console.log(`   ✓ 已迁移 ${memberships.length} 个会员记录\n`)

    // ====== 6. 迁移订单数据 ======
    console.log('📦 迁移订单数据...')
    const orders = await sqliteClient.order.findMany({
      include: {
        orderItems: true,
        payment: true,
      },
    })

    for (const order of orders) {
      const { orderItems, payment, ...orderData } = order

      // 创建订单
      await postgresClient.order.create({
        data: orderData,
      })

      // 创建订单项
      for (const item of orderItems) {
        await postgresClient.orderItem.create({
          data: item,
        })
      }

      // 创建支付记录
      if (payment) {
        await postgresClient.payment.create({
          data: payment,
        })
      }
    }
    stats['订单'] = orders.length
    console.log(`   ✓ 已迁移 ${orders.length} 个订单\n`)

    // ====== 7. 迁移购物车数据 ======
    console.log('📦 迁移购物车数据...')
    const cartItems = await sqliteClient.cartItem.findMany()
    for (const item of cartItems) {
      await postgresClient.cartItem.create({ data: item })
    }
    stats['购物车项'] = cartItems.length
    console.log(`   ✓ 已迁移 ${cartItems.length} 个购物车项\n`)

    // ====== 8. 迁移聊天会话 ======
    console.log('📦 迁移聊天会话数据...')
    const chatSessions = await sqliteClient.chatSession.findMany({
      include: {
        messages: true,
      },
    })

    for (const session of chatSessions) {
      const { messages, ...sessionData } = session

      // 创建会话
      await postgresClient.chatSession.create({
        data: sessionData,
      })

      // 创建消息
      for (const message of messages) {
        await postgresClient.chatMessage.create({
          data: message,
        })
      }
    }
    stats['聊天会话'] = chatSessions.length
    console.log(`   ✓ 已迁移 ${chatSessions.length} 个聊天会话\n`)

    // ====== 9. 迁移轮播图 ======
    console.log('📦 迁移轮播图数据...')
    const banners = await sqliteClient.banner.findMany()
    for (const banner of banners) {
      await postgresClient.banner.create({ data: banner })
    }
    stats['轮播图'] = banners.length
    console.log(`   ✓ 已迁移 ${banners.length} 个轮播图\n`)

    // ====== 10. 迁移系统配置 ======
    console.log('📦 迁移系统配置...')
    const configs = await sqliteClient.systemConfig.findMany()
    for (const config of configs) {
      await postgresClient.systemConfig.create({ data: config })
    }
    stats['系统配置'] = configs.length
    console.log(`   ✓ 已迁移 ${configs.length} 个配置项\n`)

    // ====== 11. 迁移页面访问记录 ======
    console.log('📦 迁移页面访问记录...')
    const pageViews = await sqliteClient.pageView.findMany()
    for (const view of pageViews) {
      await postgresClient.pageView.create({ data: view })
    }
    stats['页面访问'] = pageViews.length
    console.log(`   ✓ 已迁移 ${pageViews.length} 条访问记录\n`)

    // ====== 12. 迁移安全警报 ======
    console.log('📦 迁移安全警报...')
    const alerts = await sqliteClient.securityAlert.findMany()
    for (const alert of alerts) {
      await postgresClient.securityAlert.create({ data: alert })
    }
    stats['安全警报'] = alerts.length
    console.log(`   ✓ 已迁移 ${alerts.length} 条安全警报\n`)

    // ====== 13. 迁移系统日志 ======
    console.log('📦 迁移系统日志...')
    const logs = await sqliteClient.systemLog.findMany()
    for (const log of logs) {
      await postgresClient.systemLog.create({ data: log })
    }
    stats['系统日志'] = logs.length
    console.log(`   ✓ 已迁移 ${logs.length} 条系统日志\n`)

    // ====== 14. 迁移导出记录 ======
    console.log('📦 迁移导出记录...')
    const orderExports = await sqliteClient.orderExportRecord.findMany()
    for (const record of orderExports) {
      await postgresClient.orderExportRecord.create({ data: record })
    }
    const membershipExports = await sqliteClient.membershipExportRecord.findMany()
    for (const record of membershipExports) {
      await postgresClient.membershipExportRecord.create({ data: record })
    }
    stats['导出记录'] = orderExports.length + membershipExports.length
    console.log(`   ✓ 已迁移 ${stats['导出记录']} 条导出记录\n`)

    // ====== 迁移完成 ======
    console.log('=' .repeat(60))
    console.log('🎉 数据迁移完成！')
    console.log('=' .repeat(60))
    console.log('\n📊 迁移统计：\n')

    Object.entries(stats).forEach(([key, value]) => {
      console.log(`   ${key.padEnd(12)}: ${value} 条`)
    })

    const total = Object.values(stats).reduce((a, b) => a + b, 0)
    console.log(`   ${'总计'.padEnd(12)}: ${total} 条`)
    console.log()

  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    throw error
  } finally {
    await sqliteClient.$disconnect()
    await postgresClient.$disconnect()
  }
}

// 执行迁移
migrate()
  .then(() => {
    console.log('✅ 迁移脚本执行成功')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 迁移脚本执行失败:', error)
    process.exit(1)
  })
```

#### 2. 安装依赖（如果需要）

```bash
npm install tsx --save-dev
```

#### 3. 执行迁移

```bash
# 确保 PostgreSQL 表结构已创建
npx prisma migrate dev --name init_postgresql

# 运行迁移脚本
npx tsx scripts/migrate-sqlite-to-postgres.ts
```

---

### 方法二：使用 pgloader（快速迁移）

`pgloader` 是专门用于数据库迁移的工具，适合快速迁移大量数据。

#### 1. 安装 pgloader

**Ubuntu/Debian:**
```bash
sudo apt-get install pgloader
```

**macOS:**
```bash
brew install pgloader
```

#### 2. 创建迁移配置文件

创建 `migration.load`：

```
LOAD DATABASE
  FROM sqlite://prisma/dev.db
  INTO postgresql://pg:postgresql@127.0.0.1:5432/knowledge_shop

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB',
    maintenance_work_mem to '512 MB';
```

#### 3. 执行迁移

```bash
pgloader migration.load
```

⚠️ **注意：** pgloader 可能无法完美处理 Prisma 的某些特殊配置，需要手动验证和调整。

---

### 方法三：导出/导入 JSON（小数据量）

适合测试环境或少量数据迁移。

#### 1. 创建导出脚本 `scripts/export-data.ts`

```typescript
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/dev.db' } }
})

async function exportData() {
  const data = {
    users: await prisma.user.findMany({ include: { permissions: true } }),
    categories: await prisma.category.findMany(),
    products: await prisma.product.findMany(),
    membershipPlans: await prisma.membershipPlan.findMany(),
    memberships: await prisma.membership.findMany({ include: { usageRecords: true } }),
    orders: await prisma.order.findMany({ include: { orderItems: true, payment: true } }),
    chatSessions: await prisma.chatSession.findMany({ include: { messages: true } }),
    banners: await prisma.banner.findMany(),
    systemConfigs: await prisma.systemConfig.findMany(),
  }

  fs.writeFileSync('data-export.json', JSON.stringify(data, null, 2))
  console.log('✅ 数据已导出到 data-export.json')

  await prisma.$disconnect()
}

exportData()
```

#### 2. 创建导入脚本 `scripts/import-data.ts`

```typescript
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function importData() {
  const data = JSON.parse(fs.readFileSync('data-export.json', 'utf-8'))

  // 按顺序导入（考虑外键依赖）
  for (const user of data.users) {
    const { permissions, ...userData } = user
    await prisma.user.create({ data: userData })
    for (const perm of permissions) {
      await prisma.permission.create({ data: perm })
    }
  }

  for (const category of data.categories) {
    await prisma.category.create({ data: category })
  }

  // ... 依此类推

  console.log('✅ 数据导入完成')
  await prisma.$disconnect()
}

importData()
```

---

## 验证和测试

### 1. 验证数据完整性

```bash
# 使用 Prisma Studio 可视化检查
npx prisma studio
```

在浏览器中检查：
- 用户数据是否完整
- 订单和订单项的关联是否正确
- 会员记录和使用记录是否匹配
- 聊天会话和消息是否完整

### 2. 运行应用测试

```bash
# 启动开发服务器
npm run dev
```

测试关键功能：
- ✅ 用户登录/注册
- ✅ 浏览商品
- ✅ 创建订单
- ✅ 会员购买
- ✅ 客服聊天
- ✅ 后台管理

### 3. 数据库查询测试

```bash
# 连接到 PostgreSQL
psql -h 127.0.0.1 -U pg -d knowledge_shop

# 检查表数量
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Order";
SELECT COUNT(*) FROM "Product";

# 检查关联数据
SELECT o.id, o."orderNumber", oi."productId"
FROM "Order" o
JOIN "OrderItem" oi ON o.id = oi."orderId"
LIMIT 5;
```

---

## 常见问题

### Q1: 迁移时报错 "Foreign key constraint failed"

**原因：** 数据插入顺序不对，违反外键约束。

**解决：** 按正确顺序迁移数据：
1. User → Permission
2. Category
3. Product
4. MembershipPlan → Membership → MembershipUsage
5. Order → OrderItem → Payment
6. ChatSession → ChatMessage

### Q2: 日期格式不兼容

**原因：** SQLite 和 PostgreSQL 的日期格式不同。

**解决：** Prisma 会自动处理，但如果手动迁移，需要转换：

```typescript
// SQLite: "2024-01-01 12:00:00"
// PostgreSQL: new Date("2024-01-01T12:00:00Z")
```

### Q3: 布尔值类型不匹配

**原因：** SQLite 使用 0/1，PostgreSQL 使用 true/false。

**解决：** Prisma 自动处理，手动迁移时需要转换。

### Q4: 迁移后性能变慢

**解决：** 创建索引和优化查询

```sql
-- 检查查询计划
EXPLAIN ANALYZE SELECT * FROM "User" WHERE email = 'test@example.com';

-- 创建缺失的索引（Prisma 应该已创建）
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- 更新统计信息
ANALYZE "User";
```

### Q5: 连接数过多

**原因：** Prisma 连接池配置不当。

**解决：** 在 `schema.prisma` 中配置连接池：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // 连接池配置
  connectionLimit = 10
}
```

---

## 回滚方案

如果迁移失败或遇到问题，可以快速回滚到 SQLite。

### 1. 恢复配置文件

```bash
# 恢复 schema.prisma
git checkout prisma/schema.prisma

# 或手动改回
# datasource db {
#   provider = "sqlite"
#   url      = env("DATABASE_URL")
# }
```

### 2. 恢复环境变量

```env
# .env
DATABASE_URL="file:./dev.db"
```

### 3. 恢复 SQLite 数据库

```bash
# 如果有备份
cp prisma/dev.db.backup prisma/dev.db
```

### 4. 重新生成 Prisma Client

```bash
npx prisma generate
npm run dev
```

---

## 生产环境部署建议

### 使用云端 PostgreSQL

**Vercel Postgres (推荐用于 Vercel 部署):**
```bash
# 在 Vercel 项目中添加 Postgres 存储
vercel postgres create

# 获取连接字符串并设置环境变量
```

**Supabase (免费套餐):**
1. 访问 [supabase.com](https://supabase.com)
2. 创建项目
3. 获取数据库连接字符串
4. 运行 `npx prisma migrate deploy`

**Railway (简单易用):**
```bash
# 安装 Railway CLI
npm install -g railway

# 登录并创建项目
railway login
railway init
railway add postgres

# 部署
railway up
```

### 环境变量配置

```env
# 生产环境 .env.production
DATABASE_URL="postgresql://user:password@host:5432/db?sslmode=require"
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-production-secret"
```

### 运行迁移

```bash
# 在生产环境执行
npx prisma migrate deploy
```

---

## 总结

| 方法 | 优点 | 缺点 | 适用场景 |
|-----|------|------|---------|
| **Prisma 脚本** | 安全可控，支持复杂数据关系 | 需要编写代码 | 生产数据，重要迁移 |
| **pgloader** | 快速，自动处理表结构 | 可能需要手动调整 | 大量数据，快速迁移 |
| **JSON 导出/导入** | 简单易懂 | 不适合大数据量 | 测试环境，少量数据 |

**推荐流程：**
1. 开发环境先测试迁移
2. 使用 Prisma 脚本迁移（方法一）
3. 验证数据完整性
4. 测试所有功能
5. 备份后在生产环境执行

---

## 相关文档

- [Prisma 官方文档](https://www.prisma.io/docs)
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [生产环境部署指南](./PRODUCTION_DEPLOYMENT.md)

---

**最后更新时间：** 2025-01-22
