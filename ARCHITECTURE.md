# 架构设计文档

## 核心设计原则

### 1. 用户分类系统

本平台采用**二元用户分类**架构，所有功能开发必须严格区分以下两种用户类型：

#### 1.1 已登录用户（管理员和管理员团队成员）
- **定义**：通过 NextAuth.js 认证的用户，拥有有效的 session
- **识别方式**：`session?.user` 存在
- **权限特征**：
  - 管理员：`session.user.role === 'ADMIN'`
  - 团队成员：拥有特定模块权限（通过 `permissions` API 检查）
- **功能特权**：
  - 无限制访问所有已授权的功能
  - 不受导出次数、操作频率等限制
  - 可管理系统配置和数据

#### 1.2 匿名用户
- **定义**：未登录或未认证的访客
- **识别方式**：`!session?.user` 或 `session` 为 null
- **标识机制**：使用 localStorage 持久化的 `visitorId`
- **功能限制**：
  - 受导出次数限制（基于已支付订单数）
  - 只能访问自己的订单（通过 localStorage 中的订单号）
  - 部分功能需要满足前置条件（如：必须有已支付订单才能导出）

### 2. 开发规范

#### 2.1 **禁止耦合原则**

**❌ 错误示例：耦合的逻辑**
```typescript
// BAD: 将已登录用户和匿名用户的逻辑混在一起
export async function checkLimit(userId?: string, visitorId?: string) {
  if (userId) {
    // 已登录用户逻辑
    const user = await getUser(userId)
    if (user.role === 'ADMIN') {
      return { allowed: true }
    }
    // ... 复杂的权限检查
  } else if (visitorId) {
    // 匿名用户逻辑
    // ... 限制检查
  }
  // ... 更多耦合逻辑
}
```

**✅ 正确示例：清晰分离**
```typescript
// GOOD: 在入口处就分离两种用户类型
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  // 已登录用户：直接放行，无限制
  if (session?.user) {
    return handleAuthenticatedUser(session)
  }

  // 匿名用户：执行限制检查
  return handleAnonymousUser(req)
}

async function handleAuthenticatedUser(session: Session) {
  // 已登录用户的完整逻辑，不涉及限制检查
  const data = await fetchAllData()
  return NextResponse.json(data)
}

async function handleAnonymousUser(req: Request) {
  // 匿名用户的完整逻辑，包含限制检查
  const visitorId = getVisitorId()
  const limitCheck = await checkAnonymousLimit(visitorId)

  if (!limitCheck.allowed) {
    return NextResponse.json({ error: limitCheck.reason }, { status: 403 })
  }

  const data = await fetchLimitedData()
  return NextResponse.json(data)
}
```

#### 2.2 **分支优先原则**

在所有 API 路由和业务逻辑中，**优先检查用户类型并分支处理**：

```typescript
// 标准模式
export async function someAPI(req: Request) {
  const session = await getServerSession(authOptions)

  // 第一步：分类
  if (session?.user) {
    // 已登录用户分支
    return handleLoggedInUser(session, req)
  }

  // 第二步：匿名用户分支
  return handleAnonymousUser(req)
}
```

#### 2.3 **数据访问原则**

| 用户类型 | 数据访问范围 | 识别方式 |
|---------|------------|---------|
| 已登录用户 | 全部数据（根据权限） | `session.user.id` + 权限检查 |
| 匿名用户 | 仅自己的数据 | `visitorId` + localStorage 中的记录 |

**示例：订单导出功能**
```typescript
// 已登录用户：可导出所有订单（根据筛选条件）
if (session?.user) {
  const orders = await prisma.order.findMany({
    where: buildWhereClause(filters)  // 无限制
  })
}

// 匿名用户：只能导出自己的订单
else {
  const orderNumbers = getOrderNumbersFromStorage()  // 从 localStorage 读取
  const orders = await prisma.order.findMany({
    where: {
      orderNumber: { in: orderNumbers },  // 限制范围
      status: 'paid'  // 额外限制
    }
  })
}
```

#### 2.4 **限制检查原则**

- **已登录用户**：❌ 不进行任何限制检查
- **匿名用户**：✅ 必须进行限制检查

```typescript
// 正确的限制检查位置
if (!session?.user) {
  // 只对匿名用户检查
  const limitResult = await checkLimit(visitorId, orderNumbers)

  if (!limitResult.allowed) {
    return error(limitResult.reason)
  }
}

// 已登录用户直接跳过，继续执行业务逻辑
```

### 3. 实际应用示例

#### 3.1 订单导出功能

**文件**: `app/api/backendmanager/orders/export/route.ts`

```typescript
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  // 分支 1: 已登录用户 - 无限制
  if (session?.user) {
    // 不检查限制，不记录导出次数
    const orders = await fetchAllOrders(filters)
    return exportFile(orders)
  }

  // 分支 2: 匿名用户 - 受限制
  const visitorId = getVisitorId()
  const orderNumbers = getOrderNumbers()

  // 检查导出限制
  const limitCheck = await checkOrderExportLimit(visitorId, orderNumbers)
  if (!limitCheck.allowed) {
    return error403(limitCheck.reason)
  }

  // 只导出自己的已支付订单
  const orders = await fetchUserOrders(orderNumbers, 'paid')

  // 记录导出次数
  await recordExport(visitorId)

  return exportFile(orders)
}
```

#### 3.2 导出限制检查

**文件**: `lib/export-limiter.ts`

```typescript
export async function checkOrderExportLimit(
  visitorId?: string,
  orderNumbers?: string[]
): Promise<ExportLimitResult> {
  const session = await getServerSession(authOptions)

  // 已登录用户：直接放行
  if (session?.user) {
    return { allowed: true }
  }

  // 以下全是匿名用户的逻辑
  if (!visitorId) {
    return { allowed: false, reason: '无法识别访客身份' }
  }

  if (!orderNumbers?.length) {
    return { allowed: false, reason: '只有已支付订单支持导出' }
  }

  // 检查已支付订单数
  const paidOrderCount = await countPaidOrders(orderNumbers)

  if (paidOrderCount === 0) {
    return { allowed: false, reason: '只有已支付订单支持导出' }
  }

  // 检查今日导出次数
  const usedExports = await getTodayExports(visitorId)
  const totalAllowed = paidOrderCount * 2  // 每个订单2次

  if (usedExports >= totalAllowed) {
    return {
      allowed: false,
      reason: '抱歉，只支持每个已支付订单导出2次，请妥善保管好订单信息，谢谢'
    }
  }

  return { allowed: true, remainingExports: totalAllowed - usedExports }
}
```

### 4. 前端开发规范

#### 4.1 UI 显示原则

- **已登录用户**：不显示任何限制提示
- **匿名用户**：显示剩余次数、限制规则等提示

**示例**:
```tsx
{/* 只对匿名用户显示限制提示 */}
{exportInfo && exportInfo.totalAllowed > 0 && (
  <div className="bg-blue-50 border border-blue-200">
    <p>已支付订单数：{exportInfo.paidOrderCount}</p>
    <p>今日已导出：{exportInfo.usedExports} 次</p>
    <p>剩余次数：{exportInfo.remainingExports} 次</p>
    <p>提示：每个已支付订单最多可导出2次</p>
  </div>
)}
```

#### 4.2 访客 ID 管理

**文件**: `lib/visitor-id.ts`

```typescript
const VISITOR_ID_KEY = 'visitor_id'

export function getVisitorId(): string {
  if (typeof window === 'undefined') return ''

  let visitorId = localStorage.getItem(VISITOR_ID_KEY)

  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36)}`
    localStorage.setItem(VISITOR_ID_KEY, visitorId)
  }

  return visitorId
}
```

### 5. 数据库设计规范

#### 5.1 用户关联字段

所有需要区分用户的表，必须同时支持两种标识：

```prisma
model Order {
  id          String   @id @default(cuid())
  userId      String?  // 已登录用户的 ID（可为空）
  // ... 其他字段

  user        User?    @relation(fields: [userId], references: [id])

  @@index([userId])
}

model OrderExportRecord {
  id          String   @id @default(cuid())
  userId      String?  // 已登录用户 ID（不记录，仅用于关联）
  visitorId   String?  // 匿名用户的访客 ID
  exportDate  DateTime
  count       Int      @default(1)

  @@unique([userId, exportDate])
  @@unique([visitorId, exportDate])
  @@index([userId, visitorId, exportDate])
}
```

**规则**:
- `userId` 存在 → 已登录用户
- `userId` 为 null 且 `visitorId` 存在 → 匿名用户

### 6. 常见错误和修复

#### 6.1 ❌ 错误：对已登录用户也应用限制

```typescript
// BAD
const limitResult = await checkOrderExportLimit(visitorId)
if (!limitResult.allowed) {
  return error403()
}
```

**修复**:
```typescript
// GOOD
if (!session?.user) {
  const limitResult = await checkOrderExportLimit(visitorId)
  if (!limitResult.allowed) {
    return error403()
  }
}
```

#### 6.2 ❌ 错误：混合查询所有匿名用户的数据

```typescript
// BAD: 查询所有匿名订单
const paidOrderCount = await prisma.order.count({
  where: {
    userId: null,  // 错误：这会统计所有匿名用户的订单
    status: 'paid'
  }
})
```

**修复**:
```typescript
// GOOD: 只查询当前访客的订单
const paidOrderCount = await prisma.order.count({
  where: {
    orderNumber: { in: orderNumbers },  // 限制为当前访客的订单
    status: 'paid'
  }
})
```

#### 6.3 ❌ 错误：为已登录用户记录操作次数

```typescript
// BAD
await recordOrderExport(visitorId, session?.user?.id)
```

**修复**:
```typescript
// GOOD: 只为匿名用户记录
if (!session?.user) {
  await recordOrderExport(visitorId)
}
```

### 7. 测试规范

所有功能必须分别测试两种用户类型：

```typescript
describe('订单导出功能', () => {
  describe('已登录用户', () => {
    it('应该允许无限次导出', async () => {
      const session = { user: { id: 'user1', role: 'ADMIN' } }
      // 测试逻辑
    })

    it('应该能导出所有订单', async () => {
      // 测试逻辑
    })
  })

  describe('匿名用户', () => {
    it('应该限制导出次数', async () => {
      const visitorId = 'visitor_123'
      // 测试逻辑
    })

    it('应该只能导出自己的订单', async () => {
      // 测试逻辑
    })

    it('应该只能导出已支付订单', async () => {
      // 测试逻辑
    })
  })
})
```

### 8. 代码审查清单

在实现新功能或审查代码时，检查以下项目：

- [ ] 是否在入口处就分离了两种用户类型？
- [ ] 已登录用户分支是否没有任何限制检查？
- [ ] 匿名用户分支是否正确识别了 visitorId？
- [ ] 匿名用户的数据查询是否限制在其自己的记录范围？
- [ ] 限制检查逻辑是否只对匿名用户执行？
- [ ] 操作记录（如导出次数）是否只针对匿名用户？
- [ ] 前端 UI 是否正确显示/隐藏限制提示？
- [ ] 数据库设计是否同时支持 userId 和 visitorId？

### 9. 总结

**核心原则**：
1. 🔑 **二元分类**：只有已登录用户和匿名用户两种
2. 🚫 **禁止耦合**：两种用户的逻辑必须清晰分离
3. ✅ **分支优先**：在入口处就分类，避免后续混乱
4. 🔒 **限制明确**：只对匿名用户应用限制
5. 📊 **数据隔离**：匿名用户只能访问自己的数据

**记住**：耦合在一起麻烦很大，保持清晰的架构分离是长期维护的关键！
