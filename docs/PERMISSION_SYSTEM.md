# 权限管理系统使用说明

## 概述

系统实现了细粒度的权限管理，支持对不同用户分配不同模块的访问权限，提高了系统的安全性和管理灵活性。

## 权限模块

系统支持以下8个权限模块：

| 模块代码 | 中文名称 | 说明 |
|---------|---------|------|
| `CATEGORIES` | 分类管理 | 管理商品分类 |
| `MEMBERSHIPS` | 会员管理 | 管理会员方案 |
| `ORDERS` | 订单数据 | 查看和管理订单 |
| `PRODUCTS` | 商品管理 | 管理商品信息 |
| `BANNERS` | 轮播图管理 | 管理首页轮播图 |
| `SYSTEM_SETTINGS` | 系统设置 | 配置系统参数 |
| `SECURITY_ALERTS` | 安全警报 | 查看安全警报和审计日志 |
| `CUSTOMER_CHAT` | 客服聊天 | 访问客服聊天系统 |

## 权限级别

每个模块支持3种权限级别：

- **NONE** (无权限): 用户无法访问该模块
- **READ** (只读): 用户只能查看，不能修改
- **WRITE** (读写): 用户可以查看和修改

## 权限设置

### 管理员操作步骤

1. **访问用户管理**
   - 登录管理员账号
   - 进入「后台管理」→「用户管理」
   - 找到需要设置权限的用户

2. **分配权限**
   - 点击用户的「管理权限」按钮
   - 为每个模块选择权限级别：
     - 无权限：用户完全无法访问
     - 只读：用户可以查看但不能修改
     - 读写：用户可以完全管理该模块
   - 点击「保存」

3. **权限组合示例**

   **客服人员**:
   - 客服聊天: 读写 (可以回复客户消息)
   - 商品管理: 只读 (可以查看商品信息)
   - 订单数据: 只读 (可以查看订单)
   - 其他模块: 无权限

   **内容编辑**:
   - 商品管理: 读写 (可以编辑商品)
   - 分类管理: 读写 (可以管理分类)
   - 轮播图管理: 读写 (可以更新轮播图)
   - 其他模块: 无权限

   **运营人员**:
   - 商品管理: 读写
   - 分类管理: 读写
   - 轮播图管理: 读写
   - 订单数据: 只读
   - 系统设置: 无权限 (避免误操作)

## 特殊说明

### ADMIN 角色
- ADMIN 角色自动拥有所有模块的写权限
- 无需单独配置权限
- ADMIN 用户在权限管理界面显示「全部权限」

### 权限验证
- 每个 API 端点都会验证用户权限
- 权限不足时返回 403 Forbidden
- 前端界面也会根据权限显示/隐藏功能

## API 权限映射

| API 路径 | 需要权限 | 级别 |
|---------|---------|------|
| `GET /api/backendmanager/banners` | BANNERS | READ |
| `POST /api/backendmanager/banners` | BANNERS | WRITE |
| `PATCH /api/backendmanager/banners/[id]` | BANNERS | WRITE |
| `DELETE /api/backendmanager/banners/[id]` | BANNERS | WRITE |
| `GET /api/backendmanager/system-config` | SYSTEM_SETTINGS | READ |
| `POST /api/backendmanager/system-config` | SYSTEM_SETTINGS | WRITE |
| `PUT /api/backendmanager/system-config` | SYSTEM_SETTINGS | WRITE |
| `GET /api/backendmanager/security-alerts` | SECURITY_ALERTS | READ |
| `GET /api/backendmanager/chat` | CUSTOMER_CHAT | READ |

## 开发人员指南

### 添加新权限模块

1. **更新 Schema**
   ```prisma
   enum PermissionModule {
     // ...现有模块
     NEW_MODULE  // 新模块
   }
   ```

2. **更新权限工具**
   ```typescript
   // lib/permissions.ts
   export type PermissionModule =
     | 'CATEGORIES'
     // ...
     | 'NEW_MODULE'

   // 添加模块名称映射
   const names: Record<PermissionModule, string> = {
     // ...
     NEW_MODULE: '新模块名称',
   }
   ```

3. **更新 API Schema**
   ```typescript
   // app/api/backendmanager/users/[id]/permissions/route.ts
   const permissionSchema = z.object({
     permissions: z.array(
       z.object({
         module: z.enum([
           // ...
           'NEW_MODULE'
         ]),
         // ...
       })
     ),
   })
   ```

4. **更新前端界面**
   ```typescript
   // app/backendmanager/users/page.tsx
   type PermissionModule =
     | 'CATEGORIES'
     // ...
     | 'NEW_MODULE'

   const MODULE_NAMES: Record<PermissionModule, string> = {
     // ...
     NEW_MODULE: '新模块名称',
   }
   ```

5. **在 API 中使用权限**
   ```typescript
   import { requireRead, requireWrite } from '@/lib/permissions'

   export async function GET() {
     await requireRead('NEW_MODULE')
     // ...
   }

   export async function POST() {
     await requireWrite('NEW_MODULE')
     // ...
   }
   ```

### 权限检查函数

```typescript
// 检查是否有读权限
await canRead('PRODUCTS', userId)  // 返回 boolean

// 检查是否有写权限
await canWrite('PRODUCTS', userId)  // 返回 boolean

// 要求读权限（无权限时抛出错误）
await requireRead('PRODUCTS')  // 抛出错误或返回用户对象

// 要求写权限（无权限时抛出错误）
await requireWrite('PRODUCTS')  // 抛出错误或返回用户对象

// 要求管理员权限
await requireAdmin()  // 抛出错误或返回用户对象
```

## 安全建议

1. **最小权限原则**
   - 只授予用户完成工作所需的最小权限
   - 优先使用 READ 权限，必要时才授予 WRITE

2. **定期审计**
   - 定期检查用户权限设置
   - 及时撤销离职员工的权限
   - 检查安全警报中的异常访问

3. **敏感操作**
   - 系统设置应该限制给极少数人
   - 安全警报权限应该分配给安全负责人
   - 避免过多人拥有全部权限

## 故障排查

### 用户报告无法访问某功能

1. 检查用户账号状态是否为「已批准」
2. 检查用户在该模块的权限级别
3. 检查 API 响应的错误信息
4. 查看浏览器控制台是否有权限错误

### 权限更新不生效

1. 让用户重新登录（刷新 session）
2. 检查权限是否正确保存到数据库
3. 检查 API 是否正确验证权限

### 批量设置权限失败

1. 检查请求数据格式是否正确
2. 确认用户不是 ADMIN 角色（ADMIN 无需设置权限）
3. 查看服务器日志的详细错误信息

## 更新历史

- **2025-11-17**: 初始版本
  - 添加 8 个权限模块
  - 支持 NONE/READ/WRITE 三种权限级别
  - 实现前后端权限验证
