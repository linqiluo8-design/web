# 客服聊天图片功能升级指南

## 📋 升级步骤

本次更新为客服聊天功能添加了图片上传支持，需要更新数据库结构。

### 步骤 1: 应用数据库迁移

选择以下**任一方法**执行：

#### 方法 A: 使用 db push（推荐用于开发环境）

```bash
npx prisma db push
```

这会直接将 schema 的更改同步到数据库，无需创建迁移文件。

#### 方法 B: 使用迁移（推荐用于生产环境）

```bash
npx prisma migrate dev --name add_image_support_to_chat
```

这会创建迁移文件并应用到数据库。

### 步骤 2: 重新生成 Prisma Client

```bash
npx prisma generate
```

### 步骤 3: 重启开发服务器

如果正在运行开发服务器，需要重启：

```bash
# 按 Ctrl+C 停止服务器
# 然后重新启动
npm run dev
```

## 🗂️ 数据库结构变更

在 `ChatMessage` 表中添加了以下字段：

```prisma
model ChatMessage {
  // ... 原有字段
  messageType String   @default("text")  // 新增: text | image
  imageUrl    String?                     // 新增: 图片URL
  imageWidth  Int?                        // 新增: 图片宽度
  imageHeight Int?                        // 新增: 图片高度
}
```

## ✅ 验证升级成功

执行以下命令检查数据库结构：

```bash
# 打开 Prisma Studio
npx prisma studio
```

在 `ChatMessage` 表中应该能看到新增的 `messageType`、`imageUrl`、`imageWidth`、`imageHeight` 字段。

## 🔍 故障排查

### 问题 1: Prisma Client 报错 "Unknown argument"

**症状**：
```
Unknown argument `messageType`. Available options are marked with ?.
```

**解决方案**：
```bash
# 1. 应用数据库迁移
npx prisma db push

# 2. 重新生成 Prisma Client
npx prisma generate

# 3. 重启开发服务器
```

### 问题 2: 无法连接到数据库

**症状**：
```
Can't reach database server at `127.0.0.1:5432`
```

**解决方案**：
- 确保 PostgreSQL 服务正在运行
- 检查 `.env` 文件中的 `DATABASE_URL` 配置

### 问题 3: 迁移冲突

**症状**：
```
Migration conflict detected
```

**解决方案**：
```bash
# 重置数据库（⚠️ 会删除所有数据）
npm run db:reset
```

## 📝 回滚方案

如果需要回滚到之前的版本：

### Git 回滚

```bash
# 查看提交历史
git log --oneline

# 回滚到升级前的提交（替换 <commit-hash>）
git reset --hard <commit-hash>

# 应用旧的数据库结构
npx prisma db push

# 重新生成 Prisma Client
npx prisma generate
```

### 手动回滚数据库

如果只想回滚数据库结构（保留代码更新）：

```sql
-- 连接到数据库
psql -h 127.0.0.1 -U pg -d knowledge_shop

-- 删除新增字段
ALTER TABLE "ChatMessage" DROP COLUMN IF EXISTS "messageType";
ALTER TABLE "ChatMessage" DROP COLUMN IF EXISTS "imageUrl";
ALTER TABLE "ChatMessage" DROP COLUMN IF EXISTS "imageWidth";
ALTER TABLE "ChatMessage" DROP COLUMN IF EXISTS "imageHeight";
```

## 🚀 新功能测试

升级完成后，测试以下功能：

### 1. 发送文本消息
- 打开客服聊天窗口
- 输入文字消息
- 点击发送
- ✅ 消息应正常显示

### 2. 上传图片
- 点击图片上传按钮（📷图标）
- 选择图片文件（JPG/PNG/GIF/WebP，最大5MB）
- 查看预览
- 添加说明（可选）
- 点击发送
- ✅ 图片应正常上传并显示

### 3. 查看图片
- 点击聊天记录中的图片
- ✅ 应在新窗口打开大图

### 4. 验证安全性
- 尝试上传非图片文件（如 .txt, .pdf）
- ✅ 应显示"只支持上传图片格式"错误
- 尝试上传超过5MB的图片
- ✅ 应显示"图片大小不能超过 5MB"错误

## 📞 获取帮助

如果遇到问题：

1. 查看 Next.js 开发服务器的控制台输出
2. 检查浏览器控制台的错误信息
3. 查看 `UPGRADE_CHAT.md` 故障排查部分
4. 查看项目的其他文档

---

**升级完成时间**：升级后记录
**验证人员**：请在升级并验证后签名
