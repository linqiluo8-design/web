# 课程分销系统使用指南

## 📋 目录
- [功能概述](#功能概述)
- [数据库迁移](#数据库迁移)
- [配置说明](#配置说明)
- [使用流程](#使用流程)
- [API 文档](#api-文档)
- [待完成功能](#待完成功能)

## 功能概述

本系统为知识付费平台提供完整的课程分销功能，支持：

- ✅ 分销商申请和审核
- ✅ 专属分销链接和推广码
- ✅ 实时订单和收益追踪
- ✅ 灵活的佣金比例设置
- ✅ 佣金提现管理
- ✅ 点击转化率统计
- ✅ 完整的权限控制

## 数据库迁移

### 1. 运行迁移

```bash
# 生成 Prisma Client
npx prisma generate

# 创建数据库迁移
npx prisma migrate dev --name add_distribution_system

# 或直接推送schema到数据库（开发环境）
npx prisma db push
```

### 2. 新增的数据库表

- **Distributor** - 分销商表
- **DistributionOrder** - 分销订单记录表
- **DistributionClick** - 点击追踪表
- **CommissionWithdrawal** - 提现记录表

### 3. 修改的数据库表

- **Order** 表新增字段：`distributorId`（可选，分销商ID）
- **User** 表新增关系：`distributor`（一对一关系）
- **PermissionModule** 枚举新增：`DISTRIBUTION`

## 配置说明

### 1. 佣金设置

在 `/app/api/distribution/apply/route.ts` 中配置默认佣金比例：

```typescript
commissionRate: 0.1  // 默认10%佣金，可在审核时调整
```

### 2. 提现设置

在 `/app/api/distribution/withdrawals/route.ts` 中配置：

```typescript
const minWithdrawal = 100        // 最低提现金额（元）
const feeRate = 0.02            // 提现手续费比例（2%）
```

### 3. Cookie 有效期

在 `/app/api/distribution/track/route.ts` 中配置分销码 Cookie 有效期：

```typescript
maxAge: 7 * 24 * 60 * 60  // 7天
```

## 使用流程

### 用户端流程

1. **申请成为分销商**
   - 访问 `/distribution` 页面
   - 填写申请表单（姓名、电话、邮箱、银行信息）
   - 提交申请，等待审核

2. **审核通过后**
   - 获得专属分销码（8位字母数字）
   - 查看收益统计（总收益、可提现余额、待结算佣金）
   - 生成推广链接

3. **推广和收益**
   - 使用格式：`https://your-domain.com/products?dist=YOUR_CODE`
   - 或在任何产品页面添加：`?dist=YOUR_CODE`
   - 用户通过链接购买后，自动记录佣金

4. **申请提现**
   - 达到最低提现金额（默认100元）
   - 填写银行信息
   - 提交提现申请
   - 等待管理员处理

### 管理员端流程

1. **审核分销商申请**
   - 访问 `/api/backendmanager/distribution/distributors`
   - 查看待审核申请（status=pending）
   - 审核通过：POST `/api/backendmanager/distribution/distributors/[id]/approve`
   - 拒绝申请：POST `/api/backendmanager/distribution/distributors/[id]/reject`

2. **管理分销商**
   - 查看分销商列表
   - 支持按状态筛选（pending/active/suspended/rejected）
   - 支持搜索（姓名、邮箱、电话、分销码）
   - 可调整佣金比例

3. **处理提现申请**
   - 查看提现申请列表
   - 审核和处理提现
   - 标记为完成或拒绝

## API 文档

### 分销商端 API

#### 1. 申请成为分销商
```
POST /api/distribution/apply
Content-Type: application/json

{
  "contactName": "张三",
  "contactPhone": "13800138000",
  "contactEmail": "zhangsan@example.com",
  "bankName": "中国工商银行",          // 可选
  "bankAccount": "6222000000000000",  // 可选
  "bankAccountName": "张三"            // 可选
}

Response:
{
  "success": true,
  "message": "申请已提交，等待审核",
  "distributor": {
    "id": "...",
    "code": "ABCD1234",
    "status": "pending",
    "appliedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 2. 获取分销商信息
```
GET /api/distribution/info

Response:
{
  "distributor": {
    "id": "...",
    "code": "ABCD1234",
    "status": "active",
    "commissionRate": 0.1,
    "totalEarnings": 1000.50,
    "availableBalance": 500.00,
    "withdrawnAmount": 500.50,
    "pendingCommission": 200.00,
    "totalOrders": 50,
    "totalClicks": 200,
    // ... 其他字段
  }
}
```

#### 3. 更新分销商信息
```
PUT /api/distribution/info
Content-Type: application/json

{
  "contactPhone": "13900139000",
  "bankName": "中国建设银行"
  // 只更新提供的字段
}
```

#### 4. 获取统计数据
```
GET /api/distribution/stats?type=overview
GET /api/distribution/stats?type=orders&page=1&pageSize=20
GET /api/distribution/stats?type=clicks&days=30

Response (type=overview):
{
  "overview": {
    "totalOrders": 50,
    "pendingOrders": 5,
    "confirmedOrders": 40,
    "settledOrders": 5,
    "totalCommission": 1000.00,
    "pendingCommission": 200.00,
    "settledCommission": 800.00,
    "availableBalance": 500.00,
    "withdrawnAmount": 300.00
  },
  "recentOrders": [...]
}
```

#### 5. 分销链接追踪
```
POST /api/distribution/track
Content-Type: application/json

{
  "code": "ABCD1234",
  "productId": "prod_123",  // 可选
  "visitorId": "visitor_456"
}

Response:
{
  "success": true,
  "distributorCode": "ABCD1234"
}
```

#### 6. 查询提现记录
```
GET /api/distribution/withdrawals?page=1&pageSize=20

Response:
{
  "withdrawals": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 10,
    "totalPages": 1
  }
}
```

#### 7. 申请提现
```
POST /api/distribution/withdrawals
Content-Type: application/json

{
  "amount": 500.00,
  "bankName": "中国工商银行",
  "bankAccount": "6222000000000000",
  "bankAccountName": "张三"
}

Response:
{
  "success": true,
  "message": "提现申请已提交，等待审核",
  "withdrawal": {
    "id": "...",
    "amount": 500.00,
    "fee": 10.00,
    "actualAmount": 490.00,
    "status": "pending",
    "createdAt": "..."
  }
}
```

### 后台管理 API

#### 1. 获取分销商列表
```
GET /api/backendmanager/distribution/distributors
GET /api/backendmanager/distribution/distributors?status=pending
GET /api/backendmanager/distribution/distributors?search=张三

Response:
{
  "distributors": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### 2. 审核通过
```
POST /api/backendmanager/distribution/distributors/[id]/approve
Content-Type: application/json

{
  "commissionRate": 0.15  // 可选，自定义佣金比例
}

Response:
{
  "success": true,
  "message": "审核通过",
  "distributor": {...}
}
```

#### 3. 拒绝申请
```
POST /api/backendmanager/distribution/distributors/[id]/reject
Content-Type: application/json

{
  "reason": "不符合分销商要求"
}

Response:
{
  "success": true,
  "message": "已拒绝申请",
  "distributor": {...}
}
```

## 待完成功能

以下功能需要进一步开发：

### 1. 订单支付回调集成
在订单支付成功后，需要自动创建分销订单记录。

**在 `/app/api/payment/callback/route.ts` 中添加：**

```typescript
// 检查是否有分销码
const distCode = cookies().get("dist_code")?.value

if (distCode) {
  const distributor = await prisma.distributor.findUnique({
    where: { code: distCode, status: "active" }
  })

  if (distributor) {
    // 创建分销订单记录
    await prisma.distributionOrder.create({
      data: {
        orderId: order.id,
        distributorId: distributor.id,
        orderAmount: order.totalAmount,
        commissionAmount: order.totalAmount * distributor.commissionRate,
        commissionRate: distributor.commissionRate,
        status: "confirmed"
      }
    })

    // 更新分销商统计
    await prisma.distributor.update({
      where: { id: distributor.id },
      data: {
        totalOrders: { increment: 1 },
        totalEarnings: { increment: order.totalAmount * distributor.commissionRate }
      }
    })

    // 标记点击为已转化
    await prisma.distributionClick.updateMany({
      where: {
        distributorId: distributor.id,
        visitorId: visitorId,
        converted: false
      },
      data: {
        converted: true,
        orderId: order.id
      }
    })
  }
}
```

### 2. 佣金自动结算
创建定时任务，自动将已确认的佣金结算到可提现余额。

**创建 `/app/api/cron/settle-commissions/route.ts`：**

```typescript
export async function GET(req: Request) {
  // 验证 cron 密钥
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 查找待结算的佣金（7天后自动结算）
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const orders = await prisma.distributionOrder.findMany({
    where: {
      status: "confirmed",
      confirmedAt: { lte: sevenDaysAgo }
    }
  })

  for (const order of orders) {
    await prisma.$transaction([
      // 更新订单状态为已结算
      prisma.distributionOrder.update({
        where: { id: order.id },
        data: {
          status: "settled",
          settledAt: new Date()
        }
      }),
      // 增加分销商可提现余额
      prisma.distributor.update({
        where: { id: order.distributorId },
        data: {
          availableBalance: { increment: order.commissionAmount }
        }
      })
    ])
  }

  return NextResponse.json({
    success: true,
    settledCount: orders.length
  })
}
```

在 `vercel.json` 中配置定时任务：
```json
{
  "crons": [{
    "path": "/api/cron/settle-commissions",
    "schedule": "0 0 * * *"
  }]
}
```

### 3. 后台管理页面
创建 `/app/backendmanager/distribution/page.tsx` 用于管理分销商和处理提现。

### 4. 订单详情页面
创建 `/app/distribution/orders/page.tsx` 显示详细的分销订单列表。

### 5. 提现管理页面
创建 `/app/distribution/withdrawals/page.tsx` 显示提现记录和申请界面。

### 6. 数据导出功能
为分销商和管理员提供数据导出功能（CSV/Excel）。

## 权限配置

确保在数据库中为需要管理分销功能的用户添加权限：

```sql
INSERT INTO "Permission" ("userId", "module", "level")
VALUES ('user_id_here', 'DISTRIBUTION', 'WRITE');
```

或通过后台用户管理界面分配 DISTRIBUTION 权限。

## 安全建议

1. **验证分销链接**：确保分销码有效且分销商处于激活状态
2. **防止刷单**：监控异常订单模式（同一IP/设备短时间内多次购买）
3. **提现审核**：所有提现申请需要人工审核
4. **佣金保护期**：订单确认后7天才能提现，防止退款纠纷
5. **Cookie 安全**：使用 HttpOnly 和 Secure 标志保护分销码 Cookie

## 技术栈

- Next.js 16
- Prisma ORM
- PostgreSQL
- TypeScript
- Tailwind CSS
- NextAuth.js

## 联系和支持

如有问题或建议，请联系开发团队或提交 Issue。
