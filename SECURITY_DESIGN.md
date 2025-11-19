# 订单系统安全设计文档

## 📋 目录

- [五大核心安全开发原则](#五大核心安全开发原则)
- [订单系统价格安全设计](#订单系统价格安全设计)
- [多层安全防护](#多层安全防护)
- [安全测试](#安全测试)
- [最佳实践](#最佳实践)

---

## 🛡️ 五大核心安全开发原则

这些原则适用于本项目的所有开发工作，是确保系统安全的基础。**任何新功能开发都必须遵循这些原则。**

### 1️⃣ Never Trust Client Input（永远不信任客户端数据）

**原则定义**：
- 所有来自客户端的数据都可能被篡改
- 关键业务数据（如价格、权限、状态）必须由服务器决定
- 客户端只提供必要的标识符（如ID），服务器查询权威数据

**为什么重要**：
- 客户端代码完全暴露，任何人都可以修改
- 浏览器开发者工具可以轻松修改前端逻辑
- HTTP请求可以被拦截和篡改（Burp Suite、Fiddler等）

**项目中的应用**：

```typescript
// ❌ 错误示例：信任客户端价格
POST /api/orders
{
  "items": [
    {"productId": "123", "quantity": 1, "price": 0.01}  // 攻击者可以篡改！
  ]
}

// ✅ 正确示例：只接受ID，服务器查询价格
POST /api/orders
{
  "items": [
    {"productId": "123", "quantity": 1}  // 只发送必要信息
  ]
}

// 服务器端
const product = await prisma.product.findUnique({ where: { id: "123" } })
const price = product.price  // 使用数据库中的权威价格
```

**检查清单**：
- [ ] 价格、金额等敏感数据是否由服务器查询？
- [ ] 权限、角色等信息是否从数据库/session获取？
- [ ] 订单状态等业务状态是否由服务器控制？
- [ ] 是否只接受客户端的ID/标识符？

---

### 2️⃣ Server-Side Validation（服务器端验证所有关键数据）

**原则定义**：
- 前端验证只是用户体验优化，不能作为安全保障
- 所有输入数据必须在服务器端进行完整验证
- 使用类型安全的验证库（如Zod）

**为什么重要**：
- 前端验证可以被绕过（禁用JavaScript、修改代码）
- 直接调用API可以跳过前端验证
- 服务器端是最后一道防线

**项目中的应用**：

```typescript
// ✅ 使用 Zod 进行服务器端验证
import { z } from "zod"

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive().max(10000),  // 防止异常数量
  })).min(1).max(100),  // 防止超大订单
  membershipCode: z.string().optional(),
})

export async function POST(req: Request) {
  // 验证请求数据
  const body = await req.json()
  const validationResult = orderSchema.safeParse(body)

  if (!validationResult.success) {
    return NextResponse.json(
      { error: "数据格式错误", details: validationResult.error },
      { status: 400 }
    )
  }

  const data = validationResult.data

  // 进一步的业务验证
  for (const item of data.items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId }
    })

    // 验证商品存在性
    if (!product) {
      return NextResponse.json(
        { error: `商品不存在: ${item.productId}` },
        { status: 404 }
      )
    }

    // 验证商品状态
    if (product.status !== 'active') {
      return NextResponse.json(
        { error: `商品已下架: ${product.title}` },
        { status: 400 }
      )
    }
  }

  // ... 继续处理
}
```

**检查清单**：
- [ ] 是否使用 Zod 验证所有API输入？
- [ ] 数据类型、范围、格式是否都验证了？
- [ ] 是否验证了业务规则（如商品存在性、库存）？
- [ ] 错误信息是否友好且不泄露敏感信息？

---

### 3️⃣ Principle of Least Privilege（最小权限原则）

**原则定义**：
- 用户/服务只应拥有完成其任务所需的最小权限
- 默认拒绝，显式授权
- 细粒度的权限控制

**为什么重要**：
- 限制攻击者获得权限后的破坏范围
- 防止内部误操作
- 符合合规要求（如GDPR、SOC2）

**项目中的应用**：

```typescript
// 权限模块定义（lib/permissions.ts）
enum PermissionModule {
  CATEGORIES = 'CATEGORIES',
  MEMBERSHIPS = 'MEMBERSHIPS',
  ORDERS = 'ORDERS',
  PRODUCTS = 'PRODUCTS',
  BANNERS = 'BANNERS',
  SYSTEM_SETTINGS = 'SYSTEM_SETTINGS',
  SECURITY_ALERTS = 'SECURITY_ALERTS',
  CUSTOMER_CHAT = 'CUSTOMER_CHAT',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  ORDER_LOOKUP = 'ORDER_LOOKUP',
  ANALYTICS = 'ANALYTICS',
}

enum PermissionLevel {
  NONE = 'NONE',
  READ = 'READ',    // 只读
  WRITE = 'WRITE',  // 读写
}

// ✅ API 中使用权限验证
export async function GET(req: Request) {
  // 要求订单管理的读权限
  await requireRead('ORDERS')

  // ... 业务逻辑
}

export async function POST(req: Request) {
  // 要求订单管理的写权限
  await requireWrite('ORDERS')

  // ... 业务逻辑
}

export async function DELETE(req: Request) {
  // 只有管理员可以删除
  await requireAdmin()

  // ... 业务逻辑
}
```

**权限矩阵示例**：

| 角色 | 商品管理 | 订单管理 | 用户管理 | 系统设置 |
|------|---------|---------|---------|---------|
| 管理员 | WRITE | WRITE | WRITE | WRITE |
| 运营人员 | WRITE | READ | NONE | NONE |
| 客服人员 | READ | READ | NONE | NONE |
| 财务人员 | NONE | READ | NONE | NONE |
| 普通用户 | NONE | NONE | NONE | NONE |

**检查清单**：
- [ ] 是否每个API都有权限检查？
- [ ] 权限是否细分到模块级别？
- [ ] 是否区分读权限和写权限？
- [ ] 管理员权限是否单独验证？
- [ ] 匿名用户是否只能访问公开资源？

---

### 4️⃣ Defense in Depth（多层防御）

**原则定义**：
- 不依赖单一的安全措施
- 多层防护，即使一层失效也有其他防护
- 纵深防御策略

**为什么重要**：
- 没有完美的安全措施
- 多层防护增加攻击成本
- 一层失效不会导致系统完全失陷

**项目中的应用**：

订单创建的多层防护示例：

```typescript
// 第1层：NextAuth 身份认证
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  // 第2层：Zod Schema 验证
  const orderSchema = z.object({
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive()
    }))
  })

  const body = await req.json()
  const data = orderSchema.parse(body)  // 会抛出异常如果验证失败

  // 第3层：商品存在性验证
  for (const item of data.items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId }
    })

    if (!product) {
      throw new Error("商品不存在")
    }
  }

  // 第4层：价格从服务器数据库查询（不信任客户端）
  const serverPrice = product.price

  // 第5层：异常检测和安全警报
  if (quantity > 10000) {
    await prisma.securityAlert.create({
      data: {
        type: "EXCESSIVE_QUANTITY",
        severity: "HIGH",
        details: `异常订单数量: ${quantity}`,
      }
    })
  }

  if (totalAmount === 0 && !isFreeProduct) {
    await prisma.securityAlert.create({
      data: {
        type: "ZERO_AMOUNT_ORDER",
        severity: "CRITICAL",
        details: "检测到零元订单",
      }
    })
  }

  // 第6层：会员码验证
  if (membershipCode) {
    const membership = await prisma.membership.findUnique({
      where: { membershipCode: hash(membershipCode) }
    })

    if (!membership || membership.status !== 'active') {
      throw new Error("会员码无效")
    }

    // 验证有效期
    if (membership.endDate && new Date() > membership.endDate) {
      throw new Error("会员码已过期")
    }

    // 验证每日使用次数
    const usage = await getMembershipUsage(membership.id)
    if (usage.count >= membership.dailyLimit) {
      throw new Error("今日会员折扣次数已用完")
    }
  }

  // 第7层：订单过期机制
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)  // 15分钟后过期

  // 第8层：数据库事务（确保原子性）
  await prisma.$transaction(async (tx) => {
    // 创建订单
    const order = await tx.order.create({ data: orderData })

    // 创建订单项
    await tx.orderItem.createMany({ data: orderItems })

    // 更新会员使用记录
    if (membership) {
      await tx.membershipUsage.upsert({
        where: { membershipId_date },
        update: { count: { increment: usedCount } },
        create: { membershipId, date, count: usedCount }
      })
    }
  })
}
```

**多层防护总结**：

```
┌─────────────────────────────────────────┐
│  第1层：身份认证 (NextAuth)              │
├─────────────────────────────────────────┤
│  第2层：输入验证 (Zod Schema)            │
├─────────────────────────────────────────┤
│  第3层：业务验证 (商品存在性)             │
├─────────────────────────────────────────┤
│  第4层：服务器查询 (价格来源)             │
├─────────────────────────────────────────┤
│  第5层：异常检测 (安全警报)               │
├─────────────────────────────────────────┤
│  第6层：会员验证 (复杂业务规则)           │
├─────────────────────────────────────────┤
│  第7层：时效控制 (订单过期)               │
├─────────────────────────────────────────┤
│  第8层：数据完整性 (数据库事务)           │
└─────────────────────────────────────────┘
```

**检查清单**：
- [ ] 是否有身份认证层？
- [ ] 是否有输入验证层？
- [ ] 是否有业务逻辑验证层？
- [ ] 是否有异常检测和监控？
- [ ] 是否使用数据库事务保证一致性？

---

### 5️⃣ Security by Design（安全设计优先）

**原则定义**：
- 在设计阶段就考虑安全性，而不是后期补救
- 安全是功能需求，不是可选项
- 使用安全的默认配置

**为什么重要**：
- 后期修复安全问题成本高昂
- 架构层面的安全问题难以修复
- 安全应该是系统的固有属性

**项目中的应用**：

#### 1. 管理后台路径设计

```typescript
// ❌ 不安全设计：使用常见路径
/admin/users        // 容易被扫描工具发现
/api/admin/orders   // 容易被暴力攻击

// ✅ 安全设计：使用不常见路径
/backendmanager/users        // 降低被发现概率
/api/backendmanager/orders   // 提高攻击成本
```

#### 2. 会员码哈希存储

```typescript
// ❌ 不安全设计：明文存储会员码
model Membership {
  membershipCode String @unique  // 明文，泄露后可直接使用
}

// ✅ 安全设计：哈希存储
model Membership {
  membershipCode String @unique  // 存储哈希值
}

// 生成会员码时
const code = generateRandomCode()  // 原始码给用户
const hashedCode = hash(code)      // 哈希值存数据库

// 验证会员码时
const hashedInput = hash(userInput)
const membership = await prisma.membership.findUnique({
  where: { membershipCode: hashedInput }
})
```

#### 3. 安全的默认配置

```typescript
// ✅ 用户默认状态：待审核
model User {
  accountStatus AccountStatus @default(PENDING)  // 默认待审核，不是APPROVED
  role          UserRole      @default(USER)     // 默认普通用户，不是ADMIN
}

// ✅ 订单默认过期时间
model Order {
  expiresAt DateTime?  // 默认15分钟后过期，防止恶意占用
}

// ✅ 权限默认值：无权限
getUserPermission(module) {
  const permission = await prisma.permission.findFirst({
    where: { userId, module }
  })

  return permission?.level || 'NONE'  // 默认无权限，显式授权
}
```

#### 4. 导出功能安全设计

```typescript
// ✅ 导出前必须先清理的安全机制
export async function POST(req: Request) {
  await requireWrite('ORDERS')

  const { cleanupConfig } = await req.json()

  // 检查是否已导出相同配置的数据
  if (!hasExportedSameConfig(cleanupConfig)) {
    return NextResponse.json(
      { error: "请先导出当前配置的订单数据！" },
      { status: 403 }
    )
  }

  // 执行清理...
}
```

**检查清单**：
- [ ] 新功能设计时是否优先考虑安全性？
- [ ] 是否使用安全的默认配置（默认拒绝）？
- [ ] 敏感数据是否加密/哈希存储？
- [ ] 是否避免使用常见的攻击目标路径？
- [ ] 危险操作是否有二次确认机制？

---

## 🎯 安全开发检查清单（每个功能开发时使用）

在开发任何新功能时，请使用此检查清单确保安全性：

### 数据输入

- [ ] 所有API输入都使用Zod验证了吗？
- [ ] 关键业务数据（价格、权限等）由服务器决定吗？
- [ ] 是否验证了数据类型、范围、格式？
- [ ] 是否处理了异常输入（空值、超大值、特殊字符）？

### 身份认证和授权

- [ ] API是否需要登录？是否使用了 `requireAuth`？
- [ ] 是否检查了用户权限？使用了 `requireRead/requireWrite`？
- [ ] 匿名用户是否只能访问公开资源？
- [ ] 是否防止了水平越权（用户A访问用户B的数据）？

### 业务逻辑安全

- [ ] 价格等敏感数据从数据库查询吗？
- [ ] 是否有异常检测和安全警报？
- [ ] 订单/交易是否使用了数据库事务？
- [ ] 是否有防重放机制（如订单号唯一性）？

### 数据存储

- [ ] 密码/会员码等敏感数据是否哈希存储？
- [ ] 是否避免了敏感信息泄露（如完整的会员码）？
- [ ] 删除操作是否需要管理员权限？
- [ ] 导出功能是否有权限控制？

### 错误处理

- [ ] 错误信息是否避免泄露敏感信息？
- [ ] 是否正确返回HTTP状态码（401/403/404/500）？
- [ ] 是否记录了安全相关的错误日志？

### 代码质量

- [ ] 代码中是否有TODO注释未处理？
- [ ] 是否添加了必要的注释说明安全逻辑？
- [ ] 是否遵循了项目的代码规范？

---

## 📚 订单系统价格安全设计

### ⚠️ 永远不信任客户端

**关键改进**: 客户端**不再发送商品价格**，所有价格完全由服务器从数据库查询决定。

## 安全设计对比

### 修复前（有安全隐患）

```typescript
// ❌ 客户端 API 请求
{
  "items": [
    {"productId": "xxx", "quantity": 1, "price": 100}  // 接受客户端价格
  ]
}

// ❌ 服务器端验证
const product = await db.product.findUnique({...})
if (product.price !== item.price) {
  return error("价格已变更")  // 需要验证价格
}
```

**问题**:
- ❌ 为什么要接受客户端传来的价格？
- ❌ 增加了攻击面和验证复杂度
- ❌ 违反了"不信任客户端"原则

---

### 修复后（安全）

```typescript
// ✅ 客户端 API 请求
{
  "items": [
    {"productId": "xxx", "quantity": 1}  // 只发送 ID 和数量
  ]
}

// ✅ 服务器端直接查询价格
const product = await db.product.findUnique({...})
const price = product.price  // 完全由服务器决定
```

**优势**:
- ✅ 客户端无法篡改价格
- ✅ 不需要价格验证逻辑
- ✅ 更简洁、更安全的设计

## API 变更

### 订单创建 API

**端点**: `POST /api/orders`

**修复前的请求体**:
```json
{
  "items": [
    {
      "productId": "product-1",
      "quantity": 2,
      "price": 100  // ❌ 不应该由客户端提供
    }
  ],
  "membershipCode": "MEMBER123"
}
```

**修复后的请求体**:
```json
{
  "items": [
    {
      "productId": "product-1",
      "quantity": 2  // ✅ 只提供必要信息
    }
  ],
  "membershipCode": "MEMBER123"
}
```

## 多层安全防护

系统仍然保持多层防护：

```
1. Zod Schema 验证
   └─> 验证：数据格式、类型正确性
   └─> 拦截：无效数据结构

2. 商品存在性检查
   └─> 验证：商品是否存在、是否已上架
   └─> 拦截：不存在或已下架的商品

3. 服务器价格查询
   └─> 使用：数据库中的实际价格
   └─> 防止：客户端价格篡改（根本无法篡改）

4. 价格异常检测 (保留)
   └─> 区分：合法0元商品 vs 异常折扣
   └─> 检测：通过超额折扣导致的0元订单
```

## 为什么无法篡改价格？

### 攻击场景分析

**场景1: 尝试在浏览器控制台修改价格**

```javascript
// 攻击者尝试发送篡改的价格
fetch('/api/orders', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    items: [{productId: 'expensive-item', quantity: 1, price: 0}]
  })
})
```

**结果**: ❌ **无效！**

- API 不接受 `price` 字段
- 即使发送了，服务器也会忽略
- 价格完全从数据库查询

---

**场景2: 尝试通过 HTTP 拦截修改请求**

攻击者使用 Burp Suite 等工具拦截并修改请求：

```json
// 修改前
{"items": [{"productId": "xxx", "quantity": 1}]}

// 攻击者添加 price 字段
{"items": [{"productId": "xxx", "quantity": 1, "price": 0}]}
```

**结果**: ❌ **无效！**

- Zod schema 只接受 `productId` 和 `quantity`
- `price` 字段会被忽略
- 服务器使用自己查询的价格

---

**场景3: 尝试通过超大折扣变成0元**

```json
{
  "items": [{"productId": "100yuan-item", "quantity": 1}],
  "membershipCode": "FAKE-999%-OFF"  // 伪造的超大折扣会员码
}
```

**结果**: ❌ **被拦截！**

- 会员码必须在数据库中存在
- 折扣率由数据库记录决定
- 如果通过异常折扣变成0元，会触发安全检测

## 代码改动摘要

###订单 API (`app/api/orders/route.ts`)

**Schema 变更**:
```typescript
// 修复前
items: z.array(z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().positive()  // ❌ 移除
}))

// 修复后
items: z.array(z.object({
  productId: z.string(),
  quantity: z.number().int().positive()  // ✅ 只验证必要字段
}))
```

**逻辑变更**:
```typescript
// 修复前
for (const item of data.items) {
  const product = await prisma.product.findUnique({...})

  // ❌ 需要验证价格匹配
  if (Math.abs(product.price - item.price) > 0.01) {
    return error("价格已变更")
  }

  originalAmount += item.price * item.quantity  // ❌ 使用客户端价格
}

// 修复后
const validatedItems = []
for (const item of data.items) {
  const product = await prisma.product.findUnique({...})

  const serverPrice = product.price  // ✅ 使用服务器价格
  validatedItems.push({
    productId: item.productId,
    quantity: item.quantity,
    price: serverPrice  // ✅ 保存服务器价格
  })

  originalAmount += serverPrice * item.quantity  // ✅ 使用服务器价格
}

// 创建订单时也使用 validatedItems
```

### 前端代码变更

**商品详情页** (`app/products/[id]/page.tsx`):
```typescript
// 修复前
const orderData = {
  items: [{
    productId: product.id,
    quantity: quantity,
    price: product.price  // ❌ 移除
  }]
}

// 修复后
const orderData = {
  items: [{
    productId: product.id,
    quantity: quantity  // ✅ 不发送价格
  }]
}
```

**购物车页面** (`app/cart/page.tsx`):
```typescript
// 修复前
const orderData = {
  items: cart.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    price: item.price  // ❌ 移除
  }))
}

// 修复后
const orderData = {
  items: cart.map(item => ({
    productId: item.productId,
    quantity: item.quantity  // ✅ 不发送价格
  }))
}
```

## 测试

### 正常订单创建
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "test-100", "quantity": 1}]
  }'
```

**期望**: ✅ 状态码 201，订单创建成功，使用数据库价格

### 0元商品订单
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "test-free", "quantity": 1}]
  }'
```

**期望**: ✅ 状态码 201，订单创建成功，不触发安全警报

### 尝试发送价格（应被忽略）
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "test-100", "quantity": 1, "price": 0}]
  }'
```

**期望**: ✅ 状态码 201，`price: 0` 被忽略，使用数据库的实际价格

## 安全性提升

| 方面 | 修复前 | 修复后 |
|------|-------|-------|
| 价格来源 | 客户端提供，服务器验证 | 服务器直接查询 |
| 攻击面 | 可尝试篡改价格 | 无法篡改价格 |
| 代码复杂度 | 需要价格验证逻辑 | 更简洁 |
| 安全性 | 依赖验证逻辑 | 从根本上杜绝篡改 |
| 性能 | 需要额外验证步骤 | 更高效 |

## 最佳实践

1. **永远不信任客户端** - 关键业务数据（如价格）必须由服务器决定
2. **最小化攻击面** - 不接受不必要的客户端输入
3. **深度防御** - 保持多层安全检查
4. **安全第一** - 设计API时优先考虑安全性

## 相关文件

- `app/api/orders/route.ts` - 订单 API (已移除价格参数)
- `app/products/[id]/page.tsx` - 商品详情页 (已移除价格发送)
- `app/cart/page.tsx` - 购物车页面 (已移除价格发送)
- `scripts/test-price-security.ts` - 测试脚本 (已更新)
- `SECURITY_DESIGN.md` - 本文档

## 总结

通过完全移除客户端价格参数，我们：

- ✅ **从根本上杜绝了价格篡改攻击**
- ✅ **简化了代码逻辑**
- ✅ **提高了系统安全性**
- ✅ **遵循了"不信任客户端"的安全原则**

这是一个**正确的安全设计**，而不仅仅是验证层的修复。
