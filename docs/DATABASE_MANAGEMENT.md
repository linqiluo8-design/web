# 数据库管理指南

本文档介绍如何查看和管理 PostgreSQL 数据库中的数据。

---

## 📋 目录

- [快速开始](#快速开始)
- [方法1：Prisma Studio（推荐）](#方法1prisma-studio推荐)
- [方法2：pgAdmin（图形界面）](#方法2pgadmin图形界面)
- [方法3：命令行（psql）](#方法3命令行psql)
- [常用数据库操作](#常用数据库操作)
- [性能监控](#性能监控)

---

## 🚀 快速开始

最简单的查看数据库数据的方法：

```bash
npx prisma studio
```

浏览器会自动打开 http://localhost:5555，在那里你可以：
- ✅ 查看所有表的数据
- ✅ 添加、编辑、删除数据
- ✅ 查看表之间的关联关系
- ✅ 过滤和排序数据

---

## 方法1：Prisma Studio（推荐）

### 为什么推荐 Prisma Studio？

- ✅ **零配置**：自动读取 `.env` 中的数据库连接
- ✅ **类型安全**：基于 Prisma Schema，显示正确的数据类型
- ✅ **直观易用**：现代化的 Web 界面
- ✅ **支持关联**：自动显示表之间的关系

### 启动 Prisma Studio

```bash
# 在项目根目录执行
npx prisma studio
```

**或者添加到 package.json：**

```json
{
  "scripts": {
    "studio": "prisma studio"
  }
}
```

然后运行：

```bash
npm run studio
```

### 使用技巧

**查看数据：**
1. 左侧选择表名（如 `User`、`Order`、`Product`）
2. 右侧显示该表的所有数据
3. 点击单行可以查看详细信息和关联数据

**筛选数据：**
```
点击列名 → 选择过滤条件
例如：email contains "@example.com"
```

**编辑数据：**
```
点击某个字段 → 直接修改 → 点击 "Save" 按钮
```

**添加数据：**
```
点击 "Add record" 按钮 → 填写字段 → 保存
```

**删除数据：**
```
选中记录 → 点击删除图标 → 确认
```

---

## 方法2：pgAdmin（图形界面）

pgAdmin 是 PostgreSQL 官方的图形化管理工具，功能强大。

### 安装 pgAdmin

**Windows/macOS：**
- PostgreSQL 安装时通常会自带 pgAdmin
- 单独下载：https://www.pgadmin.org/download/

**启动 pgAdmin：**
- Windows：开始菜单搜索 "pgAdmin 4"
- macOS：应用程序中找到 pgAdmin
- 或浏览器访问：http://localhost:5050

### 连接数据库

#### 第1步：注册服务器

1. 左侧菜单中，**右键点击 "Servers"** → **"Register"** → **"Server"**

2. **General 标签页：**
   ```
   Name: 本地开发数据库
   ```

3. **Connection 标签页：**
   ```
   Host name/address: 127.0.0.1
   Port: 5432
   Maintenance database: postgres
   Username: pg
   Password: postgresql
   ```

4. **勾选 "Save password"**（保存密码）

5. **点击 "Save"**

#### 第2步：浏览数据

连接成功后，在左侧树形菜单中展开：

```
Servers
  └─ 本地开发数据库
      └─ Databases
          └─ knowledge_shop  ← 你的数据库
              └─ Schemas
                  └─ public
                      ├─ Tables  ← 所有数据表
                      ├─ Views
                      ├─ Functions
                      └─ Sequences
```

#### 第3步：查看表数据

**方法A：查看所有行**
```
Tables → 右键点击表名（如 User）
→ "View/Edit Data" → "All Rows"
```

**方法B：执行 SQL 查询**
```
右键点击数据库 → "Query Tool"
→ 输入 SQL → 点击执行按钮（▶）
```

### pgAdmin 常用功能

**1. 查看表结构：**
```
Tables → User → 右键 → "Properties"
→ 查看 Columns（列）、Constraints（约束）、Indexes（索引）
```

**2. 执行 SQL 查询：**
```sql
-- 查看最新注册的10个用户
SELECT * FROM "User"
ORDER BY "createdAt" DESC
LIMIT 10;

-- 查看所有已支付订单
SELECT * FROM "Order"
WHERE status = 'paid';

-- 统计用户数量
SELECT COUNT(*) FROM "User";
```

**3. 导出数据：**
```
查询结果 → 右键 → "Export" → 选择格式（CSV/Excel）
```

**4. 备份数据库：**
```
右键点击数据库 → "Backup"
→ 选择格式和路径 → "Backup"
```

---

## 方法3：命令行（psql）

psql 是 PostgreSQL 的命令行客户端，快速高效。

### 连接数据库

```bash
# 基本连接
psql -h 127.0.0.1 -U pg -d knowledge_shop

# 或使用完整 URL
psql postgresql://pg:postgresql@127.0.0.1:5432/knowledge_shop
```

### 常用 psql 命令

#### 数据库级别命令

```sql
-- 列出所有数据库
\l

-- 切换数据库
\c knowledge_shop

-- 列出当前数据库的所有表
\dt

-- 查看表结构
\d "User"

-- 查看索引
\di

-- 查看所有 schema
\dn

-- 退出
\q
```

#### 查询数据

```sql
-- 查看用户表所有数据
SELECT * FROM "User";

-- 查看特定用户
SELECT * FROM "User" WHERE email = 'admin@example.com';

-- 查看订单统计
SELECT status, COUNT(*)
FROM "Order"
GROUP BY status;

-- 联表查询：订单及用户信息
SELECT o.id, o."orderNumber", u.email, o."totalAmount"
FROM "Order" o
LEFT JOIN "User" u ON o."userId" = u.id
LIMIT 10;
```

#### 数据修改

```sql
-- 更新数据
UPDATE "User"
SET name = '新管理员'
WHERE email = 'admin@example.com';

-- 插入数据
INSERT INTO "Category" (id, name, description, "sortOrder")
VALUES ('test-id', '测试分类', '测试描述', 99);

-- 删除数据
DELETE FROM "Category" WHERE name = '测试分类';
```

### psql 实用技巧

**1. 美化输出：**
```sql
-- 开启扩展显示（适合宽表）
\x

-- 关闭扩展显示
\x

-- 开启时间显示
\timing
```

**2. 输出到文件：**
```sql
-- 将查询结果输出到文件
\o output.txt
SELECT * FROM "User";
\o

-- 执行 SQL 文件
\i script.sql
```

**3. 查看查询计划（性能分析）：**
```sql
EXPLAIN ANALYZE
SELECT * FROM "Order"
WHERE status = 'paid';
```

---

## 常用数据库操作

### 查看当前数据统计

```bash
# 使用 psql
psql -h 127.0.0.1 -U pg -d knowledge_shop << EOF
SELECT
  '用户总数' as 项目, COUNT(*) as 数量 FROM "User"
UNION ALL
SELECT
  '商品总数', COUNT(*) FROM "Product"
UNION ALL
SELECT
  '订单总数', COUNT(*) FROM "Order"
UNION ALL
SELECT
  '会员方案', COUNT(*) FROM "MembershipPlan";
EOF
```

### 清空数据库并重新初始化

```bash
# 使用项目自带的重置脚本
npm run db:reset
```

这会：
1. 删除所有表数据
2. 重建表结构
3. 创建测试数据（管理员、用户、分类等）

### 备份和恢复

**备份数据库：**
```bash
# 备份整个数据库
pg_dump -h 127.0.0.1 -U pg -d knowledge_shop -F c -f backup.dump

# 备份为 SQL 文本
pg_dump -h 127.0.0.1 -U pg -d knowledge_shop > backup.sql
```

**恢复数据库：**
```bash
# 从 .dump 文件恢复
pg_restore -h 127.0.0.1 -U pg -d knowledge_shop -c backup.dump

# 从 SQL 文件恢复
psql -h 127.0.0.1 -U pg -d knowledge_shop < backup.sql
```

---

## 性能监控

### 查看慢查询

**方法1：Prisma 日志（开发环境）**

编辑 `lib/prisma.ts`：

```typescript
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

// 监控慢查询
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    if (e.duration > 100) {  // 超过100ms
      console.log(`🐢 慢查询 (${e.duration}ms): ${e.query}`)
    }
  })
}
```

**方法2：PostgreSQL 慢查询日志**

```sql
-- 查看当前正在执行的查询
SELECT pid, usename, query, query_start
FROM pg_stat_activity
WHERE state = 'active';

-- 查看表的统计信息
SELECT schemaname, tablename,
       seq_scan, seq_tup_read,
       idx_scan, idx_tup_fetch
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;
```

### 查看表大小

```sql
-- 查看所有表的大小
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 查看索引使用情况

```sql
-- 查看索引使用统计
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

---

## 三种方法对比

| 特性 | Prisma Studio | pgAdmin | psql |
|-----|--------------|---------|------|
| **易用性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **功能丰富度** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **启动速度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **配置难度** | 零配置 | 需要配置 | 零配置 |
| **适合场景** | 日常开发 | 高级管理 | 快速查询 |

**推荐使用：**
- 📊 **日常查看数据**：Prisma Studio
- 🔧 **数据库管理**：pgAdmin
- ⚡ **快速查询/脚本**：psql

---

## 📝 常见问题

### Q1: Prisma Studio 无法启动？

**检查：**
```bash
# 确认 .env 文件中的 DATABASE_URL 正确
cat .env | grep DATABASE_URL

# 确认 PostgreSQL 服务运行中
psql -h 127.0.0.1 -U pg -d knowledge_shop -c "SELECT version();"
```

### Q2: pgAdmin 连接失败？

**检查：**
1. PostgreSQL 服务是否运行
2. 用户名密码是否正确（pg / postgresql）
3. 端口是否正确（5432）
4. 防火墙是否允许连接

### Q3: 如何重置管理员密码？

```bash
# 使用 psql
psql -h 127.0.0.1 -U pg -d knowledge_shop

# 在 psql 中执行
UPDATE "User"
SET password = '$2a$10$...'  -- 使用 bcrypt 加密后的密码
WHERE email = 'admin@example.com';
```

**或者重新运行初始化脚本：**
```bash
npm run db:reset
```

### Q4: 如何查看某个用户的所有订单？

```sql
-- 在 psql 或 pgAdmin 中执行
SELECT
    o.id,
    o."orderNumber",
    o."totalAmount",
    o.status,
    o."createdAt"
FROM "Order" o
WHERE o."userId" = 'user-id-here'
ORDER BY o."createdAt" DESC;
```

---

## 🔗 相关文档

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Prisma Studio 文档](https://www.prisma.io/docs/concepts/components/prisma-studio)
- [pgAdmin 文档](https://www.pgadmin.org/docs/)
- [psql 命令参考](https://www.postgresql.org/docs/current/app-psql.html)

---

## 📞 获取帮助

如果遇到数据库相关问题：

1. 检查 PostgreSQL 日志
2. 使用 `EXPLAIN ANALYZE` 分析查询
3. 查阅 Prisma 文档
4. 查看项目的其他文档

---

**最后更新时间：** 2025-01-22
