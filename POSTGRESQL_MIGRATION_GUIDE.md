# PostgreSQL 数据库迁移指南

从 SQLite 迁移到 PostgreSQL，提升性能、可靠性和并发处理能力。

---

## 📋 为什么要迁移到 PostgreSQL？

### SQLite 的限制
- ❌ 不支持高并发写入
- ❌ 没有用户权限管理
- ❌ 缺少高级功能（全文搜索、JSON 查询等）
- ❌ 不适合分布式部署
- ❌ 备份和恢复较复杂

### PostgreSQL 的优势
- ✅ 支持高并发（MVCC）
- ✅ 强大的查询优化器
- ✅ 完善的事务支持
- ✅ 丰富的数据类型和扩展
- ✅ 成熟的备份和恢复工具
- ✅ 生产环境最佳选择

---

## 🚀 迁移步骤

### 步骤 1: 安装 PostgreSQL

#### macOS
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Docker（推荐用于开发）
```bash
docker run --name postgres-dev \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=myapp \
  -p 5432:5432 \
  -d postgres:15-alpine
```

### 步骤 2: 创建数据库和用户

```bash
# 连接到 PostgreSQL
sudo -u postgres psql

# 或使用 Docker
docker exec -it postgres-dev psql -U postgres
```

在 PostgreSQL 控制台执行：

```sql
-- 创建数据库
CREATE DATABASE your_app_db;

-- 创建用户
CREATE USER your_app_user WITH ENCRYPTED PASSWORD 'strong_password_here';

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE your_app_db TO your_app_user;

-- 连接到数据库
\c your_app_db

-- 授予 schema 权限（PostgreSQL 15+）
GRANT ALL ON SCHEMA public TO your_app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO your_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO your_app_user;

-- 退出
\q
```

### 步骤 3: 更新 Prisma Schema

修改 `prisma/schema.prisma`:

```prisma
// 之前（SQLite）
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// 之后（PostgreSQL）
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 步骤 4: 更新环境变量

在 `.env` 中更新 `DATABASE_URL`:

```bash
# 之前（SQLite）
# DATABASE_URL="file:./dev.db"

# 之后（PostgreSQL）
# 格式：postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
DATABASE_URL="postgresql://your_app_user:strong_password_here@localhost:5432/your_app_db?schema=public"

# 如果使用 Docker
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/myapp?schema=public"

# 生产环境（云服务商提供的连接字符串）
# DATABASE_URL="postgresql://user:pass@db.example.com:5432/prod_db?schema=public&sslmode=require"
```

**连接字符串格式说明**:
```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?schema=[schema名称]&[其他参数]
```

### 步骤 5: 导出 SQLite 数据

```bash
# 1. 安装 pgloader（数据迁移工具）
# macOS
brew install pgloader

# Ubuntu/Debian
sudo apt install pgloader

# 2. 创建迁移配置文件
cat > migrate.load << 'EOF'
LOAD DATABASE
  FROM sqlite://dev.db
  INTO postgresql://your_app_user:strong_password_here@localhost:5432/your_app_db

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512 MB';
EOF

# 3. 执行迁移
pgloader migrate.load
```

**或者手动迁移**（小数据量）:

```bash
# 1. 导出 SQLite 数据为 SQL
sqlite3 dev.db .dump > backup.sql

# 2. 手动调整 SQL（移除 SQLite 特定语法）
# 需要处理：
# - AUTOINCREMENT -> SERIAL
# - DATETIME 字段
# - 序列创建

# 3. 导入到 PostgreSQL
psql -U your_app_user -d your_app_db -f backup.sql
```

### 步骤 6: 重新生成 Prisma Client

```bash
# 删除旧的 Prisma Client
rm -rf node_modules/.prisma

# 创建新的迁移
npx prisma migrate dev --name init_postgresql

# 或者直接推送 schema（开发环境）
npx prisma db push

# 生成 Prisma Client
npx prisma generate
```

### 步骤 7: 验证迁移

```bash
# 1. 打开 Prisma Studio 检查数据
npx prisma studio

# 2. 运行测试查询
npx prisma db execute --stdin <<'EOF'
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Product";
SELECT COUNT(*) FROM "Order";
EOF

# 3. 检查所有表
psql -U your_app_user -d your_app_db -c "\dt"

# 4. 检查数据完整性
psql -U your_app_user -d your_app_db << 'EOF'
SELECT
  table_name,
  (xpath('/row/count/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT
    table_name,
    table_schema,
    query_to_xml(
      format('SELECT COUNT(*) AS count FROM %I.%I', table_schema, table_name),
      false,
      true,
      ''
    ) as xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
) t;
EOF
```

---

## 🔧 常见问题和解决方案

### 问题 1: 迁移后序列不正确

```sql
-- 查看序列
SELECT * FROM information_schema.sequences;

-- 重置序列到最大值
SELECT setval(
  pg_get_serial_sequence('User', 'id'),
  COALESCE((SELECT MAX(id) FROM "User"), 1),
  true
);

-- 对所有表执行
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('
      SELECT setval(
        pg_get_serial_sequence(%L, ''id''),
        COALESCE((SELECT MAX(id) FROM %I), 1),
        true
      )', table_name, table_name);
  END LOOP;
END $$;
```

### 问题 2: 时区问题

```sql
-- 设置时区
SET TIMEZONE='UTC';

-- 在连接字符串中指定
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public&timezone=UTC"
```

### 问题 3: 连接池配置

在 `prisma/schema.prisma` 中配置:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // 连接池配置
  connection_limit = 10
  pool_timeout     = 30
}
```

或在连接字符串中:

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public&connection_limit=10&pool_timeout=30"
```

### 问题 4: SSL 连接要求

生产环境通常需要 SSL:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&sslmode=require"

# 或禁用 SSL（仅开发环境）
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public&sslmode=disable"
```

---

## 🎯 生产环境最佳实践

### 1. 连接池配置

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 2. 数据库备份

```bash
#!/bin/bash
# backup-postgres.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="your_app_db"
DB_USER="your_app_user"

# 创建备份
pg_dump -U $DB_USER -F c -b -v -f "$BACKUP_DIR/backup_$DATE.dump" $DB_NAME

# 压缩备份
gzip "$BACKUP_DIR/backup_$DATE.dump"

# 删除 7 天前的备份
find $BACKUP_DIR -name "backup_*.dump.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.dump.gz"
```

添加到 crontab（每天凌晨 2 点）:

```bash
0 2 * * * /path/to/backup-postgres.sh
```

### 3. 恢复数据库

```bash
# 从备份恢复
pg_restore -U your_app_user -d your_app_db -v backup_20250121.dump

# 或从 SQL 文件
psql -U your_app_user -d your_app_db -f backup.sql
```

### 4. 性能优化

```sql
-- 分析表统计信息
ANALYZE;

-- 为常用查询创建索引
CREATE INDEX idx_orders_user_id ON "Order"("userId");
CREATE INDEX idx_orders_status ON "Order"("status");
CREATE INDEX idx_orders_created_at ON "Order"("createdAt");

-- 查看慢查询
SELECT
  mean_exec_time,
  calls,
  query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 5. 监控和维护

```sql
-- 检查数据库大小
SELECT
  pg_size_pretty(pg_database_size('your_app_db')) as db_size;

-- 检查表大小
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 检查活动连接
SELECT
  count(*) as active_connections,
  datname
FROM pg_stat_activity
WHERE datname = 'your_app_db'
GROUP BY datname;

-- 清理死行（VACUUM）
VACUUM ANALYZE;
```

---

## ☁️ 云服务商配置

### Vercel Postgres

```bash
# 1. 在 Vercel 项目中添加 Postgres 数据库
# 2. 自动获取 DATABASE_URL

# 3. 本地开发拉取环境变量
vercel env pull .env.local

# 4. 运行迁移
npx prisma migrate deploy
```

### Supabase

```bash
# 1. 创建 Supabase 项目
# 2. 获取连接字符串（Settings > Database > Connection String）

DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public"

# 3. 运行迁移
npx prisma db push
```

### Railway

```bash
# 1. 安装 Railway CLI
npm install -g @railway/cli

# 2. 登录
railway login

# 3. 添加 Postgres 插件
railway add

# 4. 拉取环境变量
railway run printenv | grep DATABASE_URL

# 5. 运行迁移
railway run npx prisma migrate deploy
```

### AWS RDS

```bash
# 连接字符串格式
DATABASE_URL="postgresql://username:password@your-db.region.rds.amazonaws.com:5432/dbname?schema=public&sslmode=require"

# 注意：
# - 确保安全组允许入站连接（端口 5432）
# - 使用 SSL 连接（sslmode=require）
# - 配置 VPC 和子网
```

---

## 🔒 安全建议

1. **使用强密码**
   ```bash
   # 生成安全密码
   openssl rand -base64 32
   ```

2. **限制连接来源**
   ```sql
   -- pg_hba.conf
   host  all  all  0.0.0.0/0  md5           # ❌ 不安全
   host  all  all  10.0.0.0/8  md5           # ✅ 限制内网
   hostssl  all  all  0.0.0.0/0  md5         # ✅ 要求 SSL
   ```

3. **定期更新密码**
   ```sql
   ALTER USER your_app_user WITH PASSWORD 'new_strong_password';
   ```

4. **使用只读用户（报表等）**
   ```sql
   CREATE USER readonly_user WITH PASSWORD 'password';
   GRANT CONNECT ON DATABASE your_app_db TO readonly_user;
   GRANT USAGE ON SCHEMA public TO readonly_user;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
   ```

---

## 📊 迁移检查清单

### 迁移前
- [ ] 备份 SQLite 数据库
- [ ] 记录当前数据量
- [ ] 准备 PostgreSQL 服务器
- [ ] 测试连接

### 迁移中
- [ ] 更新 schema.prisma
- [ ] 更新环境变量
- [ ] 运行数据迁移
- [ ] 生成 Prisma Client
- [ ] 重置序列

### 迁移后
- [ ] 验证数据完整性
- [ ] 测试所有 API 功能
- [ ] 检查性能指标
- [ ] 配置备份计划
- [ ] 更新部署文档

---

## 🎉 完成！

迁移完成后，你的应用将拥有：
✅ 更高的并发能力
✅ 更好的性能
✅ 完善的备份机制
✅ 生产级数据库
✅ 更多高级功能

**预计迁移时间**: 1-2 小时（取决于数据量）

---

## 📚 更多资源

- Prisma 迁移文档: https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate
- PostgreSQL 官方文档: https://www.postgresql.org/docs/
- pgloader 文档: https://pgloader.readthedocs.io/
