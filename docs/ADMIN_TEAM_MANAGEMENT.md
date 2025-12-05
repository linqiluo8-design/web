# 管理员团队授权指南

## 📋 概述

本文档说明如何为特定用户授予管理员权限，组建管理员团队。

您的系统支持两种权限管理方式：
1. **角色权限（RBAC）** - 简单的 ADMIN/USER 角色
2. **模块权限（PBAC）** - 细粒度的模块级权限控制

---

## 🔑 当前权限系统架构

### 用户角色（UserRole）

```typescript
enum UserRole {
  USER    // 普通用户
  ADMIN   // 管理员（拥有所有权限）
}
```

**管理员特权**：
- ✅ 无限制导出订单
- ✅ 跳过账号审核流程
- ✅ 访问所有后台管理功能
- ✅ 查看所有订单、用户数据
- ✅ 管理商品、分类、会员方案

### 模块权限（PermissionModule）

细粒度权限控制，支持以下模块：

| 模块 | 说明 |
|------|------|
| `CATEGORIES` | 分类管理 |
| `MEMBERSHIPS` | 会员管理 |
| `ORDERS` | 订单数据管理 |
| `PRODUCTS` | 商品管理 |
| `BANNERS` | 轮播图管理 |
| `SYSTEM_SETTINGS` | 系统设置 |
| `SECURITY_ALERTS` | 安全警报 |
| `CUSTOMER_CHAT` | 客服聊天 |
| `USER_MANAGEMENT` | 用户管理 |
| `ORDER_LOOKUP` | 订单查询 |
| `ANALYTICS` | 浏览量统计 |
| `SYSTEM_LOGS` | 系统日志管理 |
| `DISTRIBUTION` | 分销管理 |

### 权限级别（PermissionLevel）

```typescript
enum PermissionLevel {
  NONE   // 无权限
  READ   // 只读
  WRITE  // 读写
}
```

---

## 🚀 方法一：直接授予 ADMIN 角色（推荐）

### 1. 使用数据库命令（最简单）

#### PostgreSQL / MySQL

```sql
-- 通过邮箱授予管理员权限
UPDATE "User"
SET role = 'ADMIN', "accountStatus" = 'APPROVED'
WHERE email = 'user@example.com';

-- 批量授予多个用户
UPDATE "User"
SET role = 'ADMIN', "accountStatus" = 'APPROVED'
WHERE email IN (
  'admin1@example.com',
  'admin2@example.com',
  'admin3@example.com'
);

-- 查看所有管理员
SELECT id, name, email, role, "accountStatus", "createdAt"
FROM "User"
WHERE role = 'ADMIN'
ORDER BY "createdAt" DESC;
```

#### 使用 Prisma Studio（可视化界面）

```bash
# 启动 Prisma Studio
npx prisma studio
```

1. 打开浏览器访问 `http://localhost:5555`
2. 选择 `User` 表
3. 找到目标用户
4. 将 `role` 字段改为 `ADMIN`
5. 将 `accountStatus` 改为 `APPROVED`
6. 保存更改

### 2. 使用脚本（自动化）

创建管理员授权脚本 `scripts/grant-admin.ts`：

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function grantAdmin(email: string) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: {
        role: 'ADMIN',
        accountStatus: 'APPROVED'
      }
    })

    console.log(`✅ 成功授予 ${email} 管理员权限`)
    console.log(`用户ID: ${user.id}`)
    console.log(`用户名: ${user.name || '未设置'}`)
  } catch (error) {
    console.error(`❌ 授权失败:`, error)
  }
}

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('请提供用户邮箱')
    console.log('使用方法: npx tsx scripts/grant-admin.ts user@example.com')
    process.exit(1)
  }

  await grantAdmin(email)
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error)
    prisma.$disconnect()
    process.exit(1)
  })
```

**使用方法**：

```bash
# 安装 tsx（如果还没安装）
npm install -D tsx

# 授予管理员权限
npx tsx scripts/grant-admin.ts admin@example.com
```

---

## 🎯 方法二：使用细粒度模块权限

如果您需要更精细的权限控制（例如：某些管理员只能管理商品，不能管理用户），可以使用 Permission 系统。

### 授予特定模块权限

```typescript
// scripts/grant-permissions.ts
import { PrismaClient, PermissionModule, PermissionLevel } from '@prisma/client'

const prisma = new PrismaClient()

async function grantPermissions(
  email: string,
  modules: Array<{ module: PermissionModule; level: PermissionLevel }>
) {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    throw new Error(`用户 ${email} 不存在`)
  }

  // 批量创建权限
  for (const { module, level } of modules) {
    await prisma.permission.upsert({
      where: {
        userId_module: {
          userId: user.id,
          module
        }
      },
      update: { level },
      create: {
        userId: user.id,
        module,
        level
      }
    })
  }

  console.log(`✅ 成功为 ${email} 授予权限`)
}

// 使用示例
async function main() {
  // 示例：授予商品管理和订单查看权限
  await grantPermissions('manager@example.com', [
    { module: 'PRODUCTS', level: 'WRITE' },      // 商品管理（读写）
    { module: 'ORDERS', level: 'READ' },         // 订单查看（只读）
    { module: 'CUSTOMER_CHAT', level: 'WRITE' }  // 客服聊天（读写）
  ])

  // 示例：授予完整后台管理权限（但不是ADMIN角色）
  await grantPermissions('super-manager@example.com', [
    { module: 'CATEGORIES', level: 'WRITE' },
    { module: 'PRODUCTS', level: 'WRITE' },
    { module: 'ORDERS', level: 'WRITE' },
    { module: 'MEMBERSHIPS', level: 'WRITE' },
    { module: 'BANNERS', level: 'WRITE' },
    { module: 'CUSTOMER_CHAT', level: 'WRITE' },
    { module: 'ANALYTICS', level: 'READ' }
  ])
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error)
    prisma.$disconnect()
    process.exit(1)
  })
```

---

## 🖥️ 方法三：创建用户管理界面（推荐用于生产环境）

### 创建 API 路由

**app/api/admin/users/[userId]/role/route.ts**

```typescript
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * 修改用户角色（仅超级管理员）
 * PUT /api/admin/users/:userId/role
 */
export async function PUT(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // 检查是否是管理员
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "权限不足" },
        { status: 403 }
      )
    }

    const { role, accountStatus } = await req.json()

    // 验证角色
    if (role && !['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: "无效的角色" },
        { status: 400 }
      )
    }

    // 验证账号状态
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED']
    if (accountStatus && !validStatuses.includes(accountStatus)) {
      return NextResponse.json(
        { error: "无效的账号状态" },
        { status: 400 }
      )
    }

    // 更新用户角色和状态
    const user = await prisma.user.update({
      where: { id: params.userId },
      data: {
        ...(role && { role }),
        ...(accountStatus && { accountStatus })
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      success: true,
      user
    })

  } catch (error: any) {
    console.error("修改用户角色失败:", error)
    return NextResponse.json(
      { error: error.message || "修改失败" },
      { status: 500 }
    )
  }
}
```

**app/api/admin/users/route.ts**

```typescript
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * 获取所有用户列表（仅管理员）
 * GET /api/admin/users
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    // 检查是否是管理员
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "权限不足" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")
    const roleFilter = searchParams.get("role") // 'ADMIN' | 'USER'
    const statusFilter = searchParams.get("status")
    const search = searchParams.get("search") || ""

    const skip = (page - 1) * pageSize

    // 构建查询条件
    const where: any = {}

    if (roleFilter) {
      where.role = roleFilter
    }

    if (statusFilter) {
      where.accountStatus = statusFilter
    }

    if (search.trim()) {
      where.OR = [
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { name: { contains: search.trim(), mode: 'insensitive' } }
      ]
    }

    // 查询用户
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          accountStatus: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              orders: true,
              permissions: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.user.count({ where })
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })

  } catch (error: any) {
    console.error("获取用户列表失败:", error)
    return NextResponse.json(
      { error: error.message || "获取失败" },
      { status: 500 }
    )
  }
}
```

### 创建前端管理界面

**app/admin/users/page.tsx**

```typescript
"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  name: string | null
  email: string
  role: 'USER' | 'ADMIN'
  accountStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  _count: {
    orders: number
    permissions: number
  }
}

export default function UserManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [roleFilter, setRoleFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [search, setSearch] = useState("")

  // 权限检查
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    } else if (session?.user?.role !== 'ADMIN') {
      router.push("/")
    }
  }, [status, session, router])

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20"
      })

      if (roleFilter) params.append("role", roleFilter)
      if (statusFilter) params.append("status", statusFilter)
      if (search) params.append("search", search)

      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()

      if (res.ok) {
        setUsers(data.users)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error("获取用户列表失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchUsers()
    }
  }, [session, page, roleFilter, statusFilter])

  // 修改用户角色
  const updateUserRole = async (userId: string, role: 'USER' | 'ADMIN') => {
    if (!confirm(`确认要将此用户设为${role === 'ADMIN' ? '管理员' : '普通用户'}吗？`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          accountStatus: role === 'ADMIN' ? 'APPROVED' : undefined
        })
      })

      if (res.ok) {
        alert("修改成功")
        fetchUsers()
      } else {
        const data = await res.json()
        alert(`修改失败: ${data.error}`)
      }
    } catch (error) {
      alert("修改失败")
      console.error(error)
    }
  }

  // 修改账号状态
  const updateAccountStatus = async (
    userId: string,
    accountStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  ) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus })
      })

      if (res.ok) {
        alert("修改成功")
        fetchUsers()
      } else {
        const data = await res.json()
        alert(`修改失败: ${data.error}`)
      }
    } catch (error) {
      alert("修改失败")
      console.error(error)
    }
  }

  if (loading) return <div className="p-8">加载中...</div>

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">用户管理</h1>

      {/* 筛选器 */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="搜索邮箱或姓名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
          className="border px-4 py-2 rounded"
        />

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border px-4 py-2 rounded"
        >
          <option value="">所有角色</option>
          <option value="ADMIN">管理员</option>
          <option value="USER">普通用户</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border px-4 py-2 rounded"
        >
          <option value="">所有状态</option>
          <option value="PENDING">待审核</option>
          <option value="APPROVED">已批准</option>
          <option value="REJECTED">已拒绝</option>
        </select>

        <button
          onClick={fetchUsers}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
        >
          搜索
        </button>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">邮箱</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 text-sm">{user.email}</td>
                <td className="px-6 py-4 text-sm">{user.name || '-'}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.role === 'ADMIN'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.role === 'ADMIN' ? '管理员' : '普通用户'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.accountStatus === 'APPROVED'
                      ? 'bg-green-100 text-green-800'
                      : user.accountStatus === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.accountStatus === 'APPROVED' ? '已批准' :
                     user.accountStatus === 'PENDING' ? '待审核' : '已拒绝'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{user._count.orders}</td>
                <td className="px-6 py-4 text-sm space-x-2">
                  {user.role !== 'ADMIN' ? (
                    <button
                      onClick={() => updateUserRole(user.id, 'ADMIN')}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      设为管理员
                    </button>
                  ) : (
                    <button
                      onClick={() => updateUserRole(user.id, 'USER')}
                      className="text-gray-600 hover:text-gray-800 font-medium"
                    >
                      取消管理员
                    </button>
                  )}

                  {user.accountStatus === 'PENDING' && (
                    <>
                      <button
                        onClick={() => updateAccountStatus(user.id, 'APPROVED')}
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        批准
                      </button>
                      <button
                        onClick={() => updateAccountStatus(user.id, 'REJECTED')}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        拒绝
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="mt-4 flex justify-between items-center">
        <div>共 {total} 个用户</div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <span className="px-4 py-2">第 {page} 页</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={users.length < 20}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## 📝 最佳实践

### 1. 安全建议

- ⚠️ **谨慎授予管理员权限** - 管理员拥有系统最高权限
- 🔒 **定期审查管理员列表** - 及时移除离职人员权限
- 📊 **记录权限变更** - 可以在 SystemLog 表中记录授权操作
- 🔐 **使用强密码** - 管理员账号必须使用复杂密码
- 🚨 **启用审计日志** - 记录所有管理员操作

### 2. 权限层级建议

```
超级管理员（ADMIN 角色）
  ├─ 拥有所有权限
  ├─ 可以授予其他用户管理员权限
  └─ 无限制导出订单

高级管理员（USER 角色 + 多模块 WRITE 权限）
  ├─ 商品管理
  ├─ 订单管理
  ├─ 会员管理
  └─ 客服管理

普通管理员（USER 角色 + 特定模块 WRITE 权限）
  ├─ 客服人员：CUSTOMER_CHAT (WRITE)
  ├─ 内容编辑：PRODUCTS (WRITE), BANNERS (WRITE)
  └─ 数据分析：ANALYTICS (READ), ORDERS (READ)
```

### 3. 批量授权模板

```sql
-- 授予客服团队权限（使用邮箱批量授予）
UPDATE "User"
SET "accountStatus" = 'APPROVED'
WHERE email LIKE '%@customer-service.company.com';

-- 为特定部门的用户授予管理员权限
UPDATE "User"
SET role = 'ADMIN', "accountStatus" = 'APPROVED'
WHERE email IN (
  SELECT email FROM "User"
  WHERE email LIKE '%@admin.company.com'
);
```

---

## 🔍 查询和监控

### 查看所有管理员

```sql
SELECT
  u.id,
  u.name,
  u.email,
  u.role,
  u."accountStatus",
  u."createdAt",
  COUNT(DISTINCT o.id) as order_count,
  COUNT(DISTINCT p.id) as permission_count
FROM "User" u
LEFT JOIN "Order" o ON o."userId" = u.id
LEFT JOIN "Permission" p ON p."userId" = u.id
WHERE u.role = 'ADMIN'
GROUP BY u.id
ORDER BY u."createdAt" DESC;
```

### 查看用户的细粒度权限

```sql
SELECT
  u.email,
  u.name,
  u.role,
  p.module,
  p.level,
  p."createdAt"
FROM "User" u
LEFT JOIN "Permission" p ON p."userId" = u.id
WHERE u.email = 'user@example.com'
ORDER BY p.module;
```

---

## 🚀 快速操作

### 创建第一个管理员

```bash
# 方式1: 使用 Prisma Studio
npx prisma studio

# 方式2: 使用 SQL
psql $DATABASE_URL -c "UPDATE \"User\" SET role = 'ADMIN', \"accountStatus\" = 'APPROVED' WHERE email = 'your-email@example.com';"
```

### 查看当前管理员列表

```bash
# 使用 Prisma Studio
npx prisma studio

# 使用 SQL
psql $DATABASE_URL -c "SELECT id, email, name, role FROM \"User\" WHERE role = 'ADMIN';"
```

---

## 📚 相关文档

- **订单导出设计**: `docs/ORDER_EXPORT_DESIGN.md`
- **订单安全方案**: `docs/ORDER_SECURITY.md`
- **Prisma Schema**: `prisma/schema.prisma`
- **认证配置**: `lib/auth.ts`

---

**最后更新**: 2025-12-05
**作者**: Claude
**状态**: Ready for Implementation
