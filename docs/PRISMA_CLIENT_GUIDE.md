# Prisma Client 使用指南

## 📌 项目环境信息

### 数据库版本
- **PostgreSQL**: 18.x
- **连接地址**: 127.0.0.1:5432
- **数据库名**: knowledge_shop

### Prisma 版本
- **@prisma/client**: ^6.19.0
- **prisma**: ^6.19.0

---

## 🔧 什么是 `npx prisma generate`？

### 作用说明

`npx prisma generate` 是 Prisma 的核心命令之一，它的作用是：

**根据 `prisma/schema.prisma` 文件生成类型安全的数据库客户端代码**

具体来说，这个命令会：

1. **读取 schema 文件**：分析 `prisma/schema.prisma` 中定义的所有数据模型
2. **生成 TypeScript 类型**：为每个模型、字段、关系生成完整的类型定义
3. **创建查询方法**：生成 `prisma.user.findMany()`、`prisma.order.create()` 等所有数据库操作方法
4. **输出到 node_modules**：将生成的代码放到 `node_modules/@prisma/client` 目录

### 生成内容示例

假设 `schema.prisma` 中有：

```prisma
model Distributor {
  id                  String   @id @default(cuid())
  totalEarnings       Float    @default(0)
  pendingCommission   Float    @default(0)  // ← 新增字段
  availableBalance    Float    @default(0)
}
```

生成后，你就可以在代码中使用：

```typescript
// TypeScript 会自动识别所有字段
const distributor = await prisma.distributor.update({
  where: { id: "xxx" },
  data: {
    pendingCommission: { decrement: 100 },  // ← 新字段可用
    availableBalance: { increment: 100 }
  }
})
```

---

## ⚠️ 重要警告：跨平台开发的陷阱

### 问题场景

**症状：**
```
Invalid argument pendingCommission. Available options are marked with ?.
```

**原因：**
当你在 **Linux/WSL 环境** 中修改了 `schema.prisma` 并生成了 Prisma Client，但后来在 **Windows 环境** 中运行项目时，会出现这个错误。

这是因为：
- ✅ Linux 环境的 `node_modules/@prisma/client` 已更新（包含新字段）
- ❌ Windows 环境的 `node_modules/@prisma/client` 还是旧版本（不包含新字段）
- ❌ Next.js 在 Windows 上运行时，使用的是 Windows 环境的 node_modules

### 解决方案

**在每个运行环境中都执行一次 `npx prisma generate`：**

#### Linux/WSL 环境
```bash
cd /home/user/web
npx prisma generate
```

#### Windows 环境
```powershell
cd "D:\bussiness web\web"
npx prisma generate
```

---

## 📋 什么时候需要执行 `npx prisma generate`？

### 必须执行的场景

| 场景 | 说明 | 示例 |
|------|------|------|
| **修改了 schema.prisma** | 添加、删除、修改了模型或字段 | 添加 `pendingCommission` 字段 |
| **首次克隆项目** | 新环境没有生成过 Prisma Client | `git clone` 后首次启动 |
| **切换运行环境** | 从 Linux 切换到 Windows，或反之 | WSL → Windows 本地运行 |
| **更新 Prisma 版本** | 升级 `@prisma/client` 或 `prisma` | `npm update prisma` 后 |
| **删除了 node_modules** | 重新安装依赖后 | `npm install` 后 |

### 不需要执行的场景

| 场景 | 说明 |
|------|------|
| **仅修改业务代码** | TypeScript/React 代码变更 |
| **修改配置文件** | `.env`、`next.config.js` 等 |
| **同环境重启服务** | 没有修改 schema，只是重启开发服务器 |

---

## 🔄 完整工作流程

### 场景1：添加新字段到数据库

```bash
# 1. 修改 schema.prisma
vim prisma/schema.prisma
# 添加新字段：pendingCommission Float @default(0)

# 2. 在数据库中添加字段（两种方式任选其一）

## 方式A：使用 Prisma Migrate
npx prisma migrate dev --name add_pending_commission

## 方式B：手动执行 SQL
# 在 PostgreSQL 客户端中执行：
ALTER TABLE "Distributor" ADD COLUMN "pendingCommission" DOUBLE PRECISION NOT NULL DEFAULT 0;

# 3. 生成 Prisma Client（重要！）
npx prisma generate

# 4. 重启开发服务器
npm run dev
```

### 场景2：从 Linux 切换到 Windows 运行

```bash
# === 在 Linux/WSL 环境 ===
git add .
git commit -m "feat: 添加 pendingCommission 字段"
git push

# === 切换到 Windows PowerShell ===
cd "D:\bussiness web\web"
git pull

# ⚠️ 关键步骤：重新生成 Prisma Client
npx prisma generate

# 启动服务器
npm run dev
```

---

## 🐛 常见错误排查

### 错误1：字段不存在

**错误信息：**
```
Invalid argument pendingCommission. Available options are marked with ?.
```

**解决方案：**
```bash
npx prisma generate
```

### 错误2：生成失败（数据库连接问题）

**错误信息：**
```
Can't reach database server at `127.0.0.1:5432`
```

**解决方案：**
1. 确认 PostgreSQL 服务正在运行
2. 检查 `.env` 文件中的 `DATABASE_URL`
3. 确认防火墙没有阻止 5432 端口

**注意：** `prisma generate` 本身不需要连接数据库，但如果配置有误会报警告。

### 错误3：版本不匹配

**错误信息：**
```
@prisma/client version mismatch
```

**解决方案：**
```bash
npm install @prisma/client@latest
npx prisma generate
```

---

## 💡 最佳实践

### 1. 开发流程标准化

```bash
# 修改 schema 后的标准流程
vim prisma/schema.prisma     # 1. 修改 schema
npx prisma migrate dev       # 2. 同步到数据库
npx prisma generate          # 3. 生成 Client（自动）
npm run dev                  # 4. 启动服务
```

> 💡 **提示：** `prisma migrate dev` 会自动执行 `prisma generate`，通常不需要手动执行。

### 2. 多环境开发

在 `package.json` 中添加快捷命令：

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:reset": "prisma migrate reset && prisma generate",
    "postinstall": "prisma generate"
  }
}
```

**`postinstall` 的作用：**
- 每次 `npm install` 后自动生成 Prisma Client
- 团队成员克隆项目后自动完成设置

### 3. 持续集成（CI/CD）

在 CI 配置中添加：

```yaml
# .github/workflows/ci.yml
- name: Install dependencies
  run: npm ci

- name: Generate Prisma Client
  run: npx prisma generate

- name: Run tests
  run: npm test
```

---

## 📊 本次问题回顾

### 问题描述

在实现 `test001@example.com` 和 `test002@example.com` 的 0 天冷静期功能时：

1. ✅ 在 Linux 环境中修改了 `schema.prisma`，添加 `pendingCommission` 字段
2. ✅ 在 Linux 环境中执行 SQL 添加了数据库字段
3. ✅ 在 Linux 环境中执行了 `npx prisma generate`
4. ❌ 切换到 Windows 环境运行时，报错字段不存在

### 解决过程

```powershell
# 在 Windows PowerShell 中执行
cd "D:\bussiness web\web"

# 停止开发服务器（Ctrl+C）

# 重新生成 Prisma Client
npx prisma generate

# 重启服务器
npm run dev

# 测试结算 API
curl http://localhost:3000/api/cron/settle-commissions
```

### 结果

✅ **成功结算 5 个订单**
- test001@example.com 的订单立即结算（0天冷静期）
- 佣金从 `pendingCommission` 转移到 `availableBalance`
- 订单状态从 `confirmed` 更新为 `settled`

---

## 📚 相关文档

- [Prisma Client 官方文档](https://www.prisma.io/docs/concepts/components/prisma-client)
- [Prisma Generate 命令](https://www.prisma.io/docs/reference/api-reference/command-reference#generate)
- [数据库迁移指南](./SQLITE_TO_POSTGRESQL_MIGRATION.md)
- [佣金结算冷静期设计](./commission-settlement-cooldown.md)

---

**文档创建时间**: 2025-12-04
**最后更新时间**: 2025-12-04
**维护者**: Claude Code Assistant
