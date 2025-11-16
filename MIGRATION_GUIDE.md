# 数据库迁移指南

本指南将帮助你安全地迁移数据库，同时保留所有现有数据。

## 📋 迁移步骤

### 步骤1：备份现有数据

**停止开发服务器**（如果正在运行），然后执行：

```bash
# 备份数据库文件（物理备份）
copy dev.db dev.db.backup

# 导出数据到JSON（逻辑备份）
npm run db:backup
```

这将在 `backup/` 目录下创建一个JSON备份文件，包含所有重要数据。

**预期输出：**
```
📦 开始备份数据...

👤 备份用户数据...
   ✓ 导出 X 个用户
📁 备份分类数据...
   ✓ 导出 X 个分类
📦 备份商品数据...
   ✓ 导出 X 个商品
🛒 备份订单数据...
   ✓ 导出 X 个订单
💎 备份会员方案数据...
   ✓ 导出 X 个会员方案
🎫 备份会员数据...
   ✓ 导出 X 个会员

✅ 备份完成！
📄 备份文件: backup/backup-2024-XX-XX.json
```

### 步骤2：重置数据库并应用新schema

```bash
# 重置数据库（会删除所有数据）
npx prisma migrate reset

# 确认提示后，Prisma会：
# 1. 删除旧数据库
# 2. 创建新数据库
# 3. 应用所有迁移（包括新的networkDiskLink字段）
```

**重要：** 当提示 "Are you sure you want to reset your database?" 时，输入 `y` 确认。

### 步骤3：恢复数据

```bash
# 恢复备份的数据
npm run db:restore
```

这将把备份的数据导入到新数据库中，并自动为Product表的新字段设置默认值。

**预期输出：**
```
📥 开始恢复数据...

📄 使用备份文件: backup-2024-XX-XX.json

👤 恢复用户数据...
   ✓ 恢复 X 个用户
📁 恢复分类数据...
   ✓ 恢复 X 个分类
📦 恢复商品数据...
   ✓ 恢复 X 个商品（新增networkDiskLink字段）
🛒 恢复订单数据...
   ✓ 恢复 X 个订单
💎 恢复会员方案数据...
   ✓ 恢复 X 个会员方案
🎫 恢复会员数据...
   ✓ 恢复 X 个会员

✅ 数据恢复完成！
```

### 步骤4：生成Prisma客户端

```bash
npx prisma generate
```

### 步骤5：重启开发服务器

```bash
npm run dev
```

---

## ✅ 验证迁移成功

访问以下页面确认数据正常：

1. **商品列表** - http://localhost:3000/products
   - 确认所有商品都显示正常

2. **后台管理** - http://localhost:3000/backendmanager
   - 检查商品、分类、会员方案

3. **我的订单** - http://localhost:3000/my-orders
   - 确认历史订单都在

4. **测试创建订单**
   - 添加商品到购物车
   - 使用会员码
   - 完成支付流程

---

## 🔧 故障排除

### 问题1：备份失败

**错误信息：**
```
The column `main.Product.networkDiskLink` does not exist
```

**解决方案：**
这是正常的！这正是我们要添加的新字段。继续执行步骤2（reset）。

### 问题2：恢复时出现唯一约束错误

**错误信息：**
```
Unique constraint failed on the fields: (email)
```

**解决方案：**
数据库可能没有完全清空。再次运行：
```bash
npx prisma migrate reset
npm run db:restore
```

### 问题3：找不到备份文件

**错误信息：**
```
备份目录不存在！
```

**解决方案：**
确保先运行了备份命令：
```bash
npm run db:backup
```

---

## 📦 备份文件位置

所有备份文件保存在：
```
/backup/backup-YYYY-MM-DD.json
```

**建议：** 定期备份此文件到安全位置（云存储、外部硬盘等）

---

## 🎯 新增功能说明

迁移完成后，Product表新增了以下字段：

- **networkDiskLink** (String?, 可选)
  - 用途：存储课程资源的网盘链接
  - 默认值：null
  - 用法：在后台商品管理中可以为商品添加网盘链接
  - 购买成功后会显示给客户

---

## 📞 需要帮助？

如果遇到任何问题：

1. 检查 `backup/` 目录是否有备份文件
2. 查看完整的错误信息
3. 确保已安装所有依赖：`npm install`

---

## 🔄 快速命令参考

```bash
# 完整迁移流程
npm run db:backup          # 1. 备份数据
npx prisma migrate reset   # 2. 重置数据库
npm run db:restore         # 3. 恢复数据
npx prisma generate        # 4. 生成客户端
npm run dev                # 5. 启动服务器

# 查看迁移状态
npx prisma migrate status

# 查看数据库
npx prisma studio
```
