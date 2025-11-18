# 数据库更新指南

## 问题
添加了新的权限模块（USER_MANAGEMENT 和 ORDER_LOOKUP），需要更新数据库。

## 解决方案

### Windows 环境
在项目根目录下运行：

```bash
# 方法1: 使用 db push (推荐用于开发环境)
DATABASE_URL="file:./dev.db" npx prisma db push

# 如果上面的命令不工作，试试这个：
npx prisma db push
```

### 说明

`prisma db push` 会：
1. 直接将 schema 的变更推送到数据库
2. 不创建迁移文件（适合开发环境）
3. 保留现有数据
4. 自动处理 SQLite 的枚举类型更新

## 验证

更新后，重启开发服务器，然后：
1. 登录管理员账号
2. 进入"后台管理" → "用户管理"
3. 选择一个用户，点击"设置权限"
4. 尝试授予"用户管理"或"订单查询"权限
5. 点击"保存"，应该成功保存

## 如果遇到问题

如果 `db push` 失败，可以：

```bash
# 重置数据库并重新生成（⚠️ 会删除所有数据）
DATABASE_URL="file:./dev.db" npx prisma migrate reset

# 或者删除数据库文件重新开始
rm prisma/dev.db
DATABASE_URL="file:./dev.db" npx prisma migrate dev
```

## 生产环境

对于生产环境，应该创建迁移：

```bash
# 创建迁移
npx prisma migrate dev --name add_user_management_order_lookup_permissions

# 应用到生产数据库
npx prisma migrate deploy
```
