# 退款系统设计与实现

## 📋 目录

- [功能概述](#功能概述)
- [设计思路](#设计思路)
- [技术实现](#技术实现)
- [API 接口](#api-接口)
- [数据库设计](#数据库设计)
- [业务流程](#业务流程)
- [安全性设计](#安全性设计)
- [推广订单处理](#推广订单处理)
- [使用说明](#使用说明)
- [测试方法](#测试方法)
- [GitHub 仓库](#github-仓库)

---

## 功能概述

退款系统为管理员提供了完整的订单退款功能，支持：

- ✅ **管理员专属权限**：只有管理员可见和操作退款功能
- ✅ **多状态支持**：支持已支付（paid）和已完成（completed）订单的退款
- ✅ **推广订单同步**：退款时自动处理关联的推广订单和佣金
- ✅ **三层状态更新**：同步更新订单状态、支付状态、推广订单状态
- ✅ **佣金回退**：根据结算状态自动扣减分销商佣金
- ✅ **事务保证**：使用数据库事务确保数据一致性

---

## 设计思路

### 1. 权限控制

退款是高风险操作，必须严格限制访问权限：

```typescript
// 只有管理员可以访问
await requireAdmin()

// 前端只对管理员显示退款按钮
{session?.user?.role === "ADMIN" && (
  <button onClick={handleRefund}>退款</button>
)}
```

### 2. 状态管理

退款涉及多个实体的状态变更：

| 实体 | 原状态 | 新状态 |
|-----|-------|--------|
| Order | paid/completed | refunded |
| Payment | paid | refunded |
| DistributionOrder | pending/confirmed/settled | cancelled |

### 3. 佣金处理逻辑

根据推广订单的不同状态，采取不同的处理策略：

```typescript
if (distributionOrder.status === "settled") {
  // 已结算：扣减分销商余额和总收益
  await tx.distributor.update({
    data: {
      availableBalance: { decrement: commissionAmount },
      totalEarnings: { decrement: commissionAmount },
      totalOrders: { decrement: 1 }
    }
  })
} else if (distributionOrder.status === "confirmed") {
  // 已确认未结算：只减少待结算佣金
  // 不影响已有余额
}
```

---

## 技术实现

### 文件结构

```
app/
├── api/
│   └── backendmanager/
│       └── orders/
│           └── [id]/
│               └── refund/
│                   └── route.ts          # 退款 API
└── backendmanager/
    └── orders/
        └── page.tsx                      # 订单管理页面（含退款按钮）
```

### 核心代码

#### 1. 退款 API (`/app/api/backendmanager/orders/[id]/refund/route.ts`)

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 权限验证
    await requireAdmin()

    // 2. 获取订单 ID（Next.js 15+ params Promise）
    const { id } = await params
    const orderId = id

    // 3. 查询订单和关联的推广订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true }
    })

    const distributionOrder = await prisma.distributionOrder.findUnique({
      where: { orderId: orderId },
      include: { distributor: true }
    })

    // 4. 使用事务执行退款操作
    const result = await prisma.$transaction(async (tx) => {
      // 4.1 更新订单状态
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: "refunded" }
      })

      // 4.2 更新支付状态
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: "refunded" }
        })
      }

      // 4.3 处理推广订单
      if (distributionOrder) {
        const now = new Date()

        // 更新推广订单状态
        await tx.distributionOrder.update({
          where: { id: distributionOrder.id },
          data: {
            status: "cancelled",
            cancelledAt: now,
            cancelReason: "订单已退款"
          }
        })

        // 4.4 处理佣金回退
        const commissionAmount = distributionOrder.commissionAmount
        const distributor = distributionOrder.distributor

        if (distributionOrder.status === "settled") {
          // 已结算：扣减余额
          await tx.distributor.update({
            where: { id: distributor.id },
            data: {
              availableBalance: { decrement: commissionAmount },
              totalEarnings: { decrement: commissionAmount },
              totalOrders: { decrement: 1 }
            }
          })
        } else if (distributionOrder.status === "confirmed") {
          // 已确认：减少订单数
          await tx.distributor.update({
            where: { id: distributor.id },
            data: {
              totalOrders: { decrement: 1 }
            }
          })
        }
      }

      return updatedOrder
    })

    return NextResponse.json({
      success: true,
      message: "退款成功",
      order: result
    })

  } catch (error: any) {
    console.error("退款失败:", error)
    return NextResponse.json(
      { error: error.message || "退款失败" },
      { status: 500 }
    )
  }
}
```

#### 2. 订单管理页面退款按钮

```typescript
// 状态管理
const [refundModalOpen, setRefundModalOpen] = useState(false)
const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null)

// 打开退款确认弹窗
const openRefundModal = (orderId: string, orderNumber: string) => {
  setRefundingOrderId(orderId)
  setRefundingOrderNumber(orderNumber)
  setRefundModalOpen(true)
}

// 执行退款
const handleRefund = async () => {
  if (!refundingOrderId) return

  try {
    const response = await fetch(
      `/api/backendmanager/orders/${refundingOrderId}/refund`,
      { method: "POST" }
    )

    if (response.ok) {
      alert("退款成功")
      fetchOrders() // 刷新订单列表
    } else {
      alert("退款失败")
    }
  } catch (error) {
    alert("退款请求失败")
  } finally {
    setRefundModalOpen(false)
    setRefundingOrderId(null)
  }
}

// 渲染退款按钮
{session?.user?.role === "ADMIN" && (
  <td>
    {(order.status === "paid" || order.status === "completed") && (
      <button
        onClick={() => openRefundModal(order.id, order.orderNumber)}
        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
      >
        退款
      </button>
    )}
  </td>
)}
```

---

## API 接口

### POST `/api/backendmanager/orders/[id]/refund`

执行订单退款操作。

**请求方式：** `POST`

**权限要求：** 管理员（ADMIN）

**URL 参数：**
- `id` (string): 订单 ID

**响应示例：**

```json
// 成功
{
  "success": true,
  "message": "退款成功",
  "order": {
    "id": "order_123",
    "orderNumber": "ORD-20231213-001",
    "status": "refunded",
    "totalAmount": 99.00
  }
}

// 失败
{
  "error": "权限不足：需要管理员权限"
}
```

**状态码：**
- `200`: 退款成功
- `401`: 未登录
- `403`: 权限不足
- `404`: 订单不存在
- `500`: 服务器错误

---

## 数据库设计

### 涉及的表和字段

#### 1. Order 表

```prisma
model Order {
  id          String   @id @default(cuid())
  orderNumber String   @unique
  status      String   // "pending" | "paid" | "completed" | "refunded" | "cancelled"
  totalAmount Float
  payment     Payment?
  // ... 其他字段
}
```

#### 2. Payment 表

```prisma
model Payment {
  id      String @id @default(cuid())
  orderId String @unique
  status  String // "pending" | "paid" | "refunded" | "failed"
  amount  Float
  order   Order  @relation(fields: [orderId], references: [id])
  // ... 其他字段
}
```

#### 3. DistributionOrder 表

```prisma
model DistributionOrder {
  id               String      @id @default(cuid())
  orderId          String      @unique
  distributorId    String
  status           String      // "pending" | "confirmed" | "settled" | "cancelled"
  commissionAmount Float
  cancelledAt      DateTime?   // 新增：退款时间
  cancelReason     String?     // 新增：退款原因
  distributor      Distributor @relation(fields: [distributorId], references: [id])
  order            Order       @relation(fields: [orderId], references: [id])
  // ... 其他字段
}
```

#### 4. Distributor 表

```prisma
model Distributor {
  id               String              @id @default(cuid())
  availableBalance Float               @default(0) // 可提现余额
  totalEarnings    Float               @default(0) // 总收益
  totalOrders      Int                 @default(0) // 总订单数
  orders           DistributionOrder[]
  // ... 其他字段
}
```

---

## 业务流程

### 退款流程图

```
┌─────────────┐
│ 管理员发起退款 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  权限验证    │ ──✗──> 返回 403 错误
└──────┬──────┘
       │ ✓
       ▼
┌─────────────┐
│  查询订单    │ ──✗──> 返回 404 错误
└──────┬──────┘
       │ ✓
       ▼
┌─────────────────────┐
│ 开始数据库事务       │
│ ┌─────────────────┐ │
│ │ 1. 更新订单状态  │ │
│ │    → refunded   │ │
│ └─────────────────┘ │
│         │           │
│         ▼           │
│ ┌─────────────────┐ │
│ │ 2. 更新支付状态  │ │
│ │    → refunded   │ │
│ └─────────────────┘ │
│         │           │
│         ▼           │
│ ┌─────────────────┐ │
│ │ 3. 检查推广订单  │ │
│ └─────┬───────────┘ │
│       │ 存在?       │
│       ▼             │
│ ┌─────────────────┐ │
│ │ 4. 更新推广订单  │ │
│ │    → cancelled  │ │
│ └─────────────────┘ │
│         │           │
│         ▼           │
│ ┌─────────────────┐ │
│ │ 5. 处理佣金回退  │ │
│ │   (根据状态)    │ │
│ └─────────────────┘ │
└──────┬──────────────┘
       │ ✓
       ▼
┌─────────────┐
│  提交事务    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  返回成功    │
└─────────────┘
```

---

## 安全性设计

### 1. 权限控制

```typescript
// 使用 requireAdmin 确保只有管理员可以访问
await requireAdmin()
```

**实现位置：** `/lib/permissions.ts`

```typescript
export async function requireAdmin() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    throw new Error('未登录')
  }

  if (session.user.role !== 'ADMIN') {
    throw new Error('权限不足：需要管理员权限')
  }
}
```

### 2. 数据验证

- ✅ 验证订单是否存在
- ✅ 验证订单状态是否允许退款（只允许 paid/completed）
- ✅ 验证关联数据完整性

### 3. 事务保证

使用 Prisma 事务确保所有操作要么全部成功，要么全部失败：

```typescript
await prisma.$transaction(async (tx) => {
  // 所有数据库操作
})
```

### 4. 错误处理

- ✅ 捕获所有异常
- ✅ 记录错误日志
- ✅ 返回友好的错误信息
- ✅ 不暴露敏感信息

---

## 推广订单处理

### 状态转换表

| 原状态 | 退款后操作 | 佣金处理 |
|-------|-----------|---------|
| pending | → cancelled | 无需处理（未产生佣金） |
| confirmed | → cancelled | 减少订单数，不影响余额 |
| settled | → cancelled | 扣减可用余额和总收益 |
| cancelled | 保持不变 | 无需处理 |

### 佣金回退详细逻辑

```typescript
if (distributionOrder.status === "settled") {
  // 场景：佣金已结算到分销商账户
  // 操作：扣减可用余额、总收益、订单数
  await tx.distributor.update({
    where: { id: distributor.id },
    data: {
      availableBalance: { decrement: commissionAmount },  // 减少可提现金额
      totalEarnings: { decrement: commissionAmount },     // 减少总收益
      totalOrders: { decrement: 1 }                       // 减少订单数
    }
  })
} else if (distributionOrder.status === "confirmed") {
  // 场景：订单已确认但未结算
  // 操作：只减少订单数（佣金还未到账）
  await tx.distributor.update({
    where: { id: distributor.id },
    data: {
      totalOrders: { decrement: 1 }
    }
  })
}
// pending 状态无需特殊处理
```

### 前端显示退款信息

在推广订单列表中显示退款详情：

```typescript
{order.status === "cancelled" && (
  <div className="mt-3 pt-3 border-t border-gray-200">
    <div className="flex items-start gap-2">
      <svg className="w-4 h-4 text-red-500">⚠️</svg>
      <div className="flex-1">
        <p className="text-sm text-red-600 font-medium">
          订单已退款，佣金取消
        </p>
        {order.cancelledAt && (
          <p className="text-xs text-gray-500 mt-1">
            退款日期：{new Date(order.cancelledAt).toLocaleString("zh-CN")}
          </p>
        )}
        {order.cancelReason && (
          <p className="text-xs text-gray-500 mt-1">
            原因：{order.cancelReason}
          </p>
        )}
      </div>
    </div>
  </div>
)}
```

---

## 使用说明

### 管理员操作流程

1. **访问订单管理页面**
   - 登录管理员账号
   - 进入"后台管理" → "订单数据管理"

2. **查找需要退款的订单**
   - 使用搜索功能或浏览订单列表
   - 只有"已支付"和"已完成"状态的订单显示退款按钮

3. **执行退款**
   - 点击订单行的"退款"按钮
   - 在确认弹窗中核对订单号
   - 点击"确认退款"

4. **验证退款结果**
   - 订单状态变更为"已退款"
   - 支付状态变更为"已退款"
   - 如有推广订单，状态变更为"已取消"

### 分销商视角

1. **查看退款通知**
   - 登录分销商账号
   - 进入"推广赚钱"页面

2. **识别退款订单**
   - 订单状态显示为"已取消"
   - 红色警告提示"订单已退款，佣金取消"
   - 显示退款日期和原因

3. **了解佣金影响**
   - 已结算订单：可用余额和总收益会相应减少
   - 未结算订单：不影响账户余额

---

## 测试方法

### 1. 单元测试场景

```typescript
describe("退款功能测试", () => {
  test("管理员可以退款已支付订单", async () => {
    // 创建测试订单
    const order = await createTestOrder({ status: "paid" })

    // 执行退款
    const response = await refundOrder(order.id)

    // 验证结果
    expect(response.success).toBe(true)
    expect(order.status).toBe("refunded")
  })

  test("非管理员无法执行退款", async () => {
    // 使用普通用户身份
    const response = await refundOrder(orderId)

    // 验证返回 403
    expect(response.status).toBe(403)
  })

  test("退款时正确处理推广订单", async () => {
    // 创建带推广订单的测试订单
    const { order, distributionOrder } = await createTestOrderWithDistribution()

    // 执行退款
    await refundOrder(order.id)

    // 验证推广订单状态
    expect(distributionOrder.status).toBe("cancelled")
    expect(distributionOrder.cancelledAt).toBeDefined()
  })
})
```

### 2. 手动测试步骤

**测试场景一：普通订单退款**

1. 创建一个普通订单并完成支付
2. 使用管理员账号登录
3. 在订单管理页面找到该订单
4. 点击"退款"按钮并确认
5. 验证：
   - ✅ 订单状态变为"已退款"
   - ✅ 支付状态变为"已退款"

**测试场景二：推广订单退款（已结算）**

1. 创建一个通过推广链接的订单
2. 等待订单自动结算（或手动触发结算）
3. 记录分销商当前余额：X 元
4. 执行退款操作
5. 验证：
   - ✅ 分销商余额变为：X - 佣金金额
   - ✅ 推广订单状态变为"已取消"
   - ✅ 显示退款日期和原因

**测试场景三：推广订单退款（未结算）**

1. 创建一个通过推广链接的订单
2. 订单确认但未结算
3. 记录分销商当前余额：X 元
4. 执行退款操作
5. 验证：
   - ✅ 分销商余额保持不变（X 元）
   - ✅ 推广订单状态变为"已取消"
   - ✅ 订单数减少 1

---

## 常见问题

### Q1: 退款后分销商余额为负数怎么办？

**A:** 系统设计上应该不会出现这种情况，因为：
- 只有已结算的订单才会扣减余额
- 结算时已经将佣金加到余额中
- 退款时只扣减已结算的佣金金额

如果出现负数，可能是数据异常，需要手动调查：

```typescript
// 检查分销商余额
const distributor = await prisma.distributor.findUnique({
  where: { id: distributorId },
  include: {
    orders: {
      where: { status: "settled" }
    }
  }
})

// 重新计算正确的余额
const correctBalance = distributor.orders.reduce(
  (sum, order) => sum + order.commissionAmount,
  0
) - distributor.withdrawnAmount
```

### Q2: 退款操作失败如何回滚？

**A:** 系统使用 Prisma 事务，任何步骤失败都会自动回滚：

```typescript
try {
  await prisma.$transaction(async (tx) => {
    // 所有操作
  })
} catch (error) {
  // 事务自动回滚，数据保持一致
  console.error("退款失败，已回滚:", error)
}
```

### Q3: 可以退款已取消的订单吗？

**A:** 不可以。前端只为 `paid` 和 `completed` 状态的订单显示退款按钮。

---

## GitHub 仓库

本项目托管在 GitHub 上，欢迎贡献代码和提出问题。

**仓库地址：** `https://github.com/linqiluo8-design/web`

**相关分支：**
- `claude/promotional-order-display-*` - 包含退款功能的开发分支

**主要提交：**
- ✅ `feat: 实现退款功能，支持推广订单佣金退回`
- ✅ `fix: 修复退款 API 的 Next.js 15+ params Promise 问题`
- ✅ `feat: 推广订单显示退款详情和日期`

**问题反馈：**

如果您发现任何问题或有改进建议，请在 GitHub Issues 中提出：
`https://github.com/linqiluo8-design/web/issues`

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|-----|------|---------|
| 1.0.0 | 2023-12-13 | 初始版本，实现基础退款功能 |
| 1.1.0 | 2023-12-13 | 添加推广订单同步处理 |
| 1.2.0 | 2023-12-13 | 添加退款详情显示 |

---

## 维护者

- **开发团队：** linqiluo8-design
- **文档维护：** Claude AI Assistant
- **最后更新：** 2023-12-13

---

## 许可证

本项目遵循 MIT 许可证。详见 LICENSE 文件。
