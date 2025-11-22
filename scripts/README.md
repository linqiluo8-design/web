# 数据库迁移脚本

本目录包含从 SQLite 迁移到 PostgreSQL 的脚本和工具。

## 📁 文件说明

- `migrate-sqlite-to-postgres.ts` - 完整的数据迁移脚本

## 🚀 快速开始

### 前置要求

1. **PostgreSQL 已安装并运行**
   ```bash
   # 检查 PostgreSQL 是否运行
   psql -V
   ```

2. **已创建目标数据库**
   ```bash
   # 创建数据库
   psql -h 127.0.0.1 -U pg -d postgres -c "CREATE DATABASE knowledge_shop;"
   ```

3. **已安装依赖**
   ```bash
   npm install tsx --save-dev
   ```

### 迁移步骤

#### 步骤 1: 备份现有数据

```bash
# 备份 SQLite 数据库（如果存在）
cp prisma/dev.db prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)
```

#### 步骤 2: 更新配置文件

**编辑 `prisma/schema.prisma`：**
```prisma
datasource db {
  provider = "postgresql"  // 从 "sqlite" 改为 "postgresql"
  url      = env("DATABASE_URL")
}
```

**编辑 `.env`：**
```env
DATABASE_URL="postgresql://pg:postgresql@127.0.0.1:5432/knowledge_shop"
```

#### 步骤 3: 创建 PostgreSQL 表结构

```bash
# 生成并应用迁移
npx prisma migrate dev --name init_postgresql

# 或直接推送 schema（不创建迁移文件）
npx prisma db push
```

#### 步骤 4: 运行数据迁移脚本

```bash
npx tsx scripts/migrate-sqlite-to-postgres.ts
```

迁移脚本会：
- ✅ 从 `prisma/dev.db` 读取所有数据
- ✅ 按正确顺序迁移到 PostgreSQL
- ✅ 保留所有关联关系
- ✅ 显示详细的迁移统计

#### 步骤 5: 验证数据

```bash
# 使用 Prisma Studio 可视化检查
npx prisma studio

# 或使用 psql 检查
psql -h 127.0.0.1 -U pg -d knowledge_shop -c "SELECT COUNT(*) FROM \"User\";"
```

#### 步骤 6: 测试应用

```bash
npm run dev
```

测试所有功能是否正常工作。

## 📊 迁移内容

脚本会迁移以下数据（按顺序）：

1. ✅ 用户、权限、账户、会话
2. ✅ 分类
3. ✅ 商品
4. ✅ 会员方案
5. ✅ 会员购买记录和使用记录
6. ✅ 订单、订单项、支付记录
7. ✅ 购物车
8. ✅ 聊天会话和消息
9. ✅ 轮播图
10. ✅ 系统配置
11. ✅ 页面访问记录
12. ✅ 安全警报
13. ✅ 系统日志
14. ✅ 导出记录

## ⚠️ 注意事项

### 迁移前检查

- [ ] 已备份 SQLite 数据库
- [ ] PostgreSQL 服务正在运行
- [ ] 目标数据库已创建
- [ ] 目标数据库为空（避免主键冲突）
- [ ] 网络连接稳定

### 常见问题

**Q: 报错 "Connection refused"**
```
A: PostgreSQL 服务未启动，运行：
   sudo service postgresql start  # Linux
   brew services start postgresql # macOS
```

**Q: 报错 "database does not exist"**
```
A: 数据库未创建，运行：
   psql -h 127.0.0.1 -U pg -d postgres -c "CREATE DATABASE knowledge_shop;"
```

**Q: 报错 "Foreign key constraint failed"**
```
A: 目标数据库不为空或存在残留数据，请清空后重试：
   psql -h 127.0.0.1 -U pg -d knowledge_shop -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   npx prisma migrate dev --name init_postgresql
```

**Q: 迁移速度慢**
```
A: 正常现象，大量数据需要时间。可以：
   1. 使用批量插入（脚本已实现）
   2. 暂时禁用索引（高级用法）
   3. 增加 PostgreSQL work_mem 配置
```

## 🔄 回滚到 SQLite

如果迁移失败或需要回滚：

```bash
# 1. 恢复 schema.prisma
git checkout prisma/schema.prisma

# 2. 恢复 .env
# DATABASE_URL="file:./dev.db"

# 3. 恢复数据库文件
cp prisma/dev.db.backup prisma/dev.db

# 4. 重新生成 Prisma Client
npx prisma generate

# 5. 重启应用
npm run dev
```

## 📚 详细文档

完整的迁移指南请参考：
- [SQLite 到 PostgreSQL 迁移完整指南](../docs/SQLITE_TO_POSTGRESQL_MIGRATION.md)

## 🆘 获取帮助

如果遇到问题：
1. 检查 [常见问题](../docs/SQLITE_TO_POSTGRESQL_MIGRATION.md#常见问题)
2. 查看 [PostgreSQL 日志](https://www.postgresql.org/docs/current/runtime-config-logging.html)
3. 提交 Issue 到项目仓库

---

**最后更新：** 2025-01-22
