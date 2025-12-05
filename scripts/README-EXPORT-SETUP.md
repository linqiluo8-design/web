# 订单导出功能实施指南

## 📋 快速开始

### 方法一：使用一键安装脚本（推荐）

```bash
# 在项目根目录执行
bash scripts/implement-order-export.sh
```

此脚本会自动完成：
- ✅ 备份数据库
- ✅ 安装依赖（exceljs）
- ✅ 更新数据库结构
- ✅ 生成 Prisma Client

### 方法二：仅修复迁移错误

如果只是遇到 P3006 迁移错误：

```bash
bash scripts/fix-migration-error.sh
```

此脚本提供三种修复方法：
1. **db push**（推荐） - 不丢失数据，快速同步
2. **重置迁移历史** - 保留数据，重建迁移
3. **完全重置** - 清空所有数据，重新开始

---

## 🔧 手动实施步骤

### 步骤1：修复迁移错误

**使用 db push（最简单）**

```bash
# 跳过迁移，直接同步数据库结构
npx prisma db push --skip-generate

# 生成 Prisma Client
npx prisma generate
```

**优点**：
- ✅ 不会触发 shadow database 错误
- ✅ 保留所有现有数据
- ✅ 快速执行

**缺点**：
- ❌ 不创建迁移历史
- ❌ 不适合生产环境

---

### 步骤2：更新 Prisma Schema

打开 `prisma/schema.prisma`，参考 `scripts/schema-updates.prisma` 添加：

#### 2.1 添加 OrderExport 模型

```prisma
model OrderExport {
  id          String   @id @default(cuid())
  orderId     String
  userId      String
  orderType   String
  exportDate  DateTime @default(now())
  exportedAt  DateTime @default(now())
  fileSize    Int?
  fileName    String?
  ipAddress   String?
  userAgent   String?

  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([orderId, userId, exportDate])
  @@index([userId, exportDate])
  @@index([exportDate])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### 2.2 更新 Order 模型

在 Order 模型中添加：

```prisma
model Order {
  // ... 现有字段 ...

  exportCount     Int           @default(0)
  lastExportedAt  DateTime?
  exports         OrderExport[]
}
```

#### 2.3 更新 User 模型

在 User 模型中添加：

```prisma
model User {
  // ... 现有字段 ...

  orderExports    OrderExport[]
}
```

---

### 步骤3：同步数据库

```bash
# 应用 schema 更新
npx prisma db push

# 生成 Prisma Client
npx prisma generate
```

---

### 步骤4：安装依赖

```bash
# 安装 ExcelJS（用于生成 Excel 文件）
npm install exceljs

# 安装类型定义
npm install --save-dev @types/exceljs
```

---

### 步骤5：创建 API 路由

参考 `docs/ORDER_EXPORT_DESIGN.md` 创建以下文件：

```
app/api/orders/export/
├── check/
│   └── route.ts          # 检查导出权限
├── route.ts              # 执行导出
└── history/
    └── route.ts          # 导出历史记录
```

---

### 步骤6：创建前端组件

创建 `components/OrderExportButton.tsx`

参考设计文档中的完整代码示例。

---

## 🐛 常见错误及解决方案

### 错误1: P3006 Migration failed

**错误信息**：
```
Migration `xxx` failed to apply cleanly to the shadow database.
```

**解决方案**：

**选项A：使用 db push（推荐）**
```bash
npx prisma db push --skip-generate
npx prisma generate
```

**选项B：重置迁移历史**
```bash
# 1. 备份迁移目录
mv prisma/migrations prisma/migrations_backup

# 2. 同步数据库
npx prisma db push

# 3. 创建新基线
npx prisma migrate dev --name baseline --create-only
npx prisma migrate resolve --applied baseline
```

**选项C：完全重置（⚠️ 会丢失数据）**
```bash
npx prisma migrate reset --force
```

---

### 错误2: Cannot find module 'exceljs'

**解决方案**：
```bash
npm install exceljs
npm install --save-dev @types/exceljs
```

---

### 错误3: Relation fields missing

**错误信息**：
```
Error: Missing relation field
```

**解决方案**：
确保在 Order 和 User 模型中都添加了对应的关联字段：

```prisma
// Order 模型
exports OrderExport[]

// User 模型
orderExports OrderExport[]
```

---

## 📊 验证安装

### 1. 检查数据库结构

```bash
# 打开 Prisma Studio
npx prisma studio
```

在浏览器中检查是否有 `OrderExport` 表。

### 2. 检查依赖

```bash
# 检查 exceljs 是否安装
npm list exceljs
```

### 3. 测试 API

创建测试文件 `test-export.http`：

```http
### 检查导出权限
GET http://localhost:3000/api/orders/export/check?orderId=xxx
```

---

## 🚀 生产环境部署

### 使用迁移（推荐）

```bash
# 1. 本地创建迁移
npx prisma migrate dev --name add_order_export

# 2. 提交迁移文件到 Git
git add prisma/migrations
git commit -m "feat: add order export feature"

# 3. 生产环境应用迁移
npx prisma migrate deploy
```

### 使用 db push（不推荐）

```bash
# 直接在生产环境执行
npx prisma db push
```

⚠️ **注意**：生产环境建议使用迁移而非 db push。

---

## 📚 相关文档

- **功能设计**: `docs/ORDER_EXPORT_DESIGN.md`
- **Schema 参考**: `scripts/schema-updates.prisma`
- **一键安装脚本**: `scripts/implement-order-export.sh`
- **错误修复脚本**: `scripts/fix-migration-error.sh`

---

## 💡 最佳实践

### 开发环境

```bash
# 使用 db push 快速迭代
npx prisma db push
```

### 生产环境

```bash
# 使用迁移保持版本控制
npx prisma migrate deploy
```

### 数据备份

```bash
# PostgreSQL
pg_dump $DATABASE_URL > backup.sql

# SQLite
cp prisma/dev.db prisma/dev.db.backup
```

---

## 🆘 获取帮助

如果遇到问题：

1. 查看错误日志
2. 参考 `docs/ORDER_EXPORT_DESIGN.md`
3. 运行 `scripts/fix-migration-error.sh`
4. 检查 Prisma 官方文档

---

**最后更新**: 2025-12-05
**作者**: Claude
**状态**: Ready for Implementation
