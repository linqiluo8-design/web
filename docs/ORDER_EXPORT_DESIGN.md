# 订单导出功能设计

## 📋 目录

- [功能概述](#功能概述)
- [导出规则](#导出规则)
- [技术方案](#技术方案)
- [数据库设计](#数据库设计)
- [API设计](#api设计)
- [前端实现](#前端实现)
- [实施指南](#实施指南)

---

## 🎯 功能概述

订单导出功能允许用户将订单数据导出为Excel文件，便于离线管理和分析。

### 适用范围

- **商品订单** - 用户购买商品产生的订单
- **会员订单** - 用户购买会员产生的订单

### 核心特性

- ✅ 支持导出已支付订单
- ✅ 非管理员用户有导出次数限制
- ✅ 管理员无限制导出
- ✅ 导出记录追踪
- ✅ 每日重置导出次数

---

## 📜 导出规则

### 1. 权限规则

#### 管理员（ADMIN角色）
```typescript
✅ 无限制导出
✅ 可导出所有状态订单
✅ 无需次数限制
✅ 无需时间限制
```

#### 普通用户
```typescript
⚠️ 每天每个已支付订单最多导出2次
✅ 仅可导出已支付订单（status: 'paid'）
❌ 不可导出待支付订单（status: 'pending'）
❌ 不可导出已取消订单（status: 'cancelled'）
```

### 2. 导出限制详解

| 订单状态 | 是否可导出 | 限制次数 | 说明 |
|---------|-----------|---------|------|
| pending（待支付） | ❌ | - | 订单未完成，不允许导出 |
| paid（已支付） | ✅ | 2次/天 | 主要导出场景 |
| cancelled（已取消） | ❌ | - | 订单已取消，不允许导出 |
| refunded（已退款） | ❌ | - | 订单已退款，不允许导出 |

### 3. 限制规则计算

```typescript
// 导出限制判断逻辑
interface ExportLimit {
  orderId: string          // 订单ID
  userId: string           // 用户ID
  exportDate: Date         // 导出日期（仅保留日期部分）
  exportCount: number      // 当天导出次数
  maxExportsPerDay: 2      // 每天最大导出次数
}

// 判断是否可以导出
function canExport(orderId: string, userId: string): boolean {
  const today = new Date().toDateString()
  const exportRecord = getExportRecord(orderId, userId, today)

  return exportRecord.exportCount < 2
}
```

### 4. 时间重置机制

- 每天 **00:00** 自动重置导出次数
- 使用日期（年-月-日）作为分组依据
- 跨日期后可重新导出

---

## 🛠️ 技术方案

### 方案对比

#### 方案A：数据库记录（推荐）

**优点**：
- ✅ 数据持久化，可追溯
- ✅ 支持统计分析
- ✅ 便于审计
- ✅ 可扩展（如后续添加导出日志）

**缺点**：
- ❌ 需要额外表结构
- ❌ 查询开销

#### 方案B：Redis缓存

**优点**：
- ✅ 查询速度快
- ✅ 自动过期（TTL）
- ✅ 减少数据库压力

**缺点**：
- ❌ 数据不持久
- ❌ 无法追溯历史
- ❌ 需要Redis服务

### 推荐方案：**数据库记录 + Redis缓存**

结合两者优点：
- 使用数据库存储导出记录（持久化）
- 使用Redis缓存当天导出次数（性能）
- Redis数据每天00:00过期

---

## 💾 数据库设计

### 1. Prisma Schema

```prisma
// prisma/schema.prisma

// 订单导出记录表
model OrderExport {
  id          String   @id @default(cuid())
  orderId     String   // 订单ID
  userId      String   // 导出用户ID
  orderType   String   // 订单类型：product（商品）, membership（会员）
  exportDate  DateTime @default(now()) // 导出时间
  exportedAt  DateTime @default(now()) // 导出完成时间
  fileSize    Int?     // 文件大小（字节）
  fileName    String?  // 文件名
  ipAddress   String?  // IP地址
  userAgent   String?  // 浏览器信息

  // 关联
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // 索引
  @@index([orderId, userId, exportDate])
  @@index([userId, exportDate])
  @@index([exportDate])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// 订单表（添加导出相关字段）
model Order {
  id              String   @id @default(cuid())
  // ... 其他字段

  // 导出统计
  exportCount     Int      @default(0) // 总导出次数
  lastExportedAt  DateTime? // 最后导出时间

  // 关联
  exports         OrderExport[]
}
```

### 2. 迁移脚本

```bash
# 创建迁移
npx prisma migrate dev --name add_order_export_tracking

# 迁移SQL（参考）
```

```sql
-- 创建订单导出记录表
CREATE TABLE "OrderExport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderType" TEXT NOT NULL,
  "exportDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fileSize" INTEGER,
  "fileName" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderExport_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderExport_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 创建索引
CREATE INDEX "OrderExport_orderId_userId_exportDate_idx"
  ON "OrderExport"("orderId", "userId", "exportDate");
CREATE INDEX "OrderExport_userId_exportDate_idx"
  ON "OrderExport"("userId", "exportDate");
CREATE INDEX "OrderExport_exportDate_idx"
  ON "OrderExport"("exportDate");

-- 添加订单表字段
ALTER TABLE "Order" ADD COLUMN "exportCount" INTEGER DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "lastExportedAt" TIMESTAMP(3);
```

---

## 🔌 API设计

### 1. 检查导出权限API

**端点**: `GET /api/orders/export/check`

**请求参数**:
```typescript
interface CheckExportRequest {
  orderId: string
}
```

**响应**:
```typescript
interface CheckExportResponse {
  canExport: boolean           // 是否可导出
  reason?: string              // 不可导出原因
  remainingExports?: number    // 剩余导出次数
  todayExports?: number        // 今日已导出次数
  maxExportsPerDay?: number    // 每日最大导出次数
  nextResetTime?: string       // 下次重置时间
}
```

**实现**:
```typescript
// app/api/orders/export/check/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get("orderId")

    if (!orderId) {
      return NextResponse.json({ error: "缺少订单ID" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 })
    }

    // 检查订单所有权（非管理员只能导出自己的订单）
    const isAdmin = user.role === "ADMIN"
    if (!isAdmin && order.userId !== user.id) {
      return NextResponse.json({ error: "无权导出此订单" }, { status: 403 })
    }

    // 检查订单状态
    if (order.status !== "paid") {
      return NextResponse.json({
        canExport: false,
        reason: "仅支持导出已支付订单"
      })
    }

    // 管理员无限制
    if (isAdmin) {
      return NextResponse.json({
        canExport: true,
        remainingExports: -1, // -1表示无限制
        message: "管理员无导出限制"
      })
    }

    // 查询今日导出次数
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayExports = await prisma.orderExport.count({
      where: {
        orderId: orderId,
        userId: user.id,
        exportDate: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    const maxExportsPerDay = 2
    const remainingExports = Math.max(0, maxExportsPerDay - todayExports)

    if (remainingExports === 0) {
      return NextResponse.json({
        canExport: false,
        reason: "今日导出次数已用完",
        todayExports,
        maxExportsPerDay,
        remainingExports: 0,
        nextResetTime: tomorrow.toISOString()
      })
    }

    return NextResponse.json({
      canExport: true,
      todayExports,
      maxExportsPerDay,
      remainingExports,
      nextResetTime: tomorrow.toISOString()
    })

  } catch (error) {
    console.error("检查导出权限失败:", error)
    return NextResponse.json(
      { error: "检查失败，请稍后重试" },
      { status: 500 }
    )
  }
}
```

### 2. 导出订单API

**端点**: `POST /api/orders/export`

**请求体**:
```typescript
interface ExportOrderRequest {
  orderId: string
  format?: 'xlsx' | 'csv'  // 导出格式，默认xlsx
}
```

**响应**:
```typescript
// 返回文件流或下载链接
Response: File Download (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
```

**实现**:
```typescript
// app/api/orders/export/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ExcelJS from 'exceljs'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { orderId, format = 'xlsx' } = await req.json()

    if (!orderId) {
      return NextResponse.json({ error: "缺少订单ID" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 查询订单详情
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 })
    }

    // 权限检查
    const isAdmin = user.role === "ADMIN"
    if (!isAdmin && order.userId !== user.id) {
      return NextResponse.json({ error: "无权导出此订单" }, { status: 403 })
    }

    // 状态检查
    if (order.status !== "paid") {
      return NextResponse.json(
        { error: "仅支持导出已支付订单" },
        { status: 400 }
      )
    }

    // 非管理员检查导出次数
    if (!isAdmin) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const todayExports = await prisma.orderExport.count({
        where: {
          orderId: orderId,
          userId: user.id,
          exportDate: {
            gte: today,
            lt: tomorrow
          }
        }
      })

      if (todayExports >= 2) {
        return NextResponse.json(
          { error: "今日导出次数已用完（每日限2次）" },
          { status: 429 }
        )
      }
    }

    // 生成Excel文件
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('订单详情')

    // 设置列
    worksheet.columns = [
      { header: '订单号', key: 'orderNumber', width: 30 },
      { header: '订单状态', key: 'status', width: 12 },
      { header: '订单金额', key: 'totalAmount', width: 12 },
      { header: '买家姓名', key: 'userName', width: 15 },
      { header: '买家邮箱', key: 'userEmail', width: 25 },
      { header: '收货地址', key: 'shippingAddress', width: 40 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '支付时间', key: 'paidAt', width: 20 },
    ]

    // 添加订单基本信息
    worksheet.addRow({
      orderNumber: order.orderNumber,
      status: getStatusText(order.status),
      totalAmount: order.totalAmount,
      userName: order.user.name,
      userEmail: order.user.email,
      shippingAddress: order.shippingAddress || '-',
      createdAt: new Date(order.createdAt).toLocaleString('zh-CN'),
      paidAt: order.paidAt ? new Date(order.paidAt).toLocaleString('zh-CN') : '-',
    })

    // 添加商品明细
    worksheet.addRow({}) // 空行
    worksheet.addRow({ orderNumber: '商品明细' })

    const itemSheet = workbook.addWorksheet('商品明细')
    itemSheet.columns = [
      { header: '商品名称', key: 'productName', width: 30 },
      { header: '单价', key: 'price', width: 12 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '小计', key: 'subtotal', width: 12 },
    ]

    order.orderItems.forEach(item => {
      itemSheet.addRow({
        productName: item.product.title,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      })
    })

    // 生成文件
    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `订单_${order.orderNumber}_${Date.now()}.xlsx`

    // 记录导出
    await prisma.orderExport.create({
      data: {
        orderId: order.id,
        userId: user.id,
        orderType: 'product', // 或 'membership'
        fileName: fileName,
        fileSize: buffer.byteLength,
        ipAddress: req.headers.get('x-forwarded-for') ||
                   req.headers.get('x-real-ip') ||
                   'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown'
      }
    })

    // 更新订单导出统计
    await prisma.order.update({
      where: { id: order.id },
      data: {
        exportCount: { increment: 1 },
        lastExportedAt: new Date()
      }
    })

    // 返回文件
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': buffer.byteLength.toString()
      }
    })

  } catch (error) {
    console.error("导出订单失败:", error)
    return NextResponse.json(
      { error: "导出失败，请稍后重试" },
      { status: 500 }
    )
  }
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    cancelled: '已取消',
    refunded: '已退款'
  }
  return statusMap[status] || status
}
```

### 3. 导出历史记录API

**端点**: `GET /api/orders/export/history`

**请求参数**:
```typescript
interface ExportHistoryRequest {
  orderId?: string  // 可选，查询特定订单的导出历史
  page?: number
  pageSize?: number
}
```

**响应**:
```typescript
interface ExportHistoryResponse {
  exports: Array<{
    id: string
    orderId: string
    orderNumber: string
    exportDate: string
    fileName: string
    fileSize: number
  }>
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
```

---

## 🎨 前端实现

### 1. 导出按钮组件

```typescript
// components/OrderExportButton.tsx
'use client'

import { useState } from 'react'

interface OrderExportButtonProps {
  orderId: string
  orderNumber: string
}

export default function OrderExportButton({
  orderId,
  orderNumber
}: OrderExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [exportInfo, setExportInfo] = useState<{
    canExport: boolean
    remainingExports?: number
    todayExports?: number
    reason?: string
  } | null>(null)

  // 检查导出权限
  const checkExportPermission = async () => {
    try {
      const response = await fetch(`/api/orders/export/check?orderId=${orderId}`)
      const data = await response.json()
      setExportInfo(data)
      return data.canExport
    } catch (error) {
      console.error('检查导出权限失败:', error)
      return false
    }
  }

  // 导出订单
  const handleExport = async () => {
    setLoading(true)

    try {
      // 先检查权限
      const canExport = await checkExportPermission()
      if (!canExport) {
        alert(exportInfo?.reason || '无法导出订单')
        return
      }

      // 执行导出
      const response = await fetch('/api/orders/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '导出失败')
      }

      // 下载文件
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `订单_${orderNumber}_${Date.now()}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // 刷新导出信息
      await checkExportPermission()

      alert('导出成功！')
    } catch (error) {
      console.error('导出订单失败:', error)
      alert(error instanceof Error ? error.message : '导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            导出中...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出订单
          </>
        )}
      </button>

      {exportInfo && exportInfo.remainingExports !== undefined && exportInfo.remainingExports >= 0 && (
        <span className="text-sm text-gray-600">
          今日剩余: {exportInfo.remainingExports}/2 次
        </span>
      )}
    </div>
  )
}
```

### 2. 在订单详情页使用

```typescript
// app/orders/[id]/page.tsx
import OrderExportButton from '@/components/OrderExportButton'

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  // ... 其他代码

  return (
    <div>
      {/* 订单详情 */}

      {/* 导出按钮 */}
      {order.status === 'paid' && (
        <OrderExportButton
          orderId={order.id}
          orderNumber={order.orderNumber}
        />
      )}
    </div>
  )
}
```

---

## 📊 实施指南

### 第一阶段：数据库准备

```bash
# 1. 更新Prisma Schema
# 添加OrderExport模型和相关字段

# 2. 创建迁移
npx prisma migrate dev --name add_order_export_tracking

# 3. 生成Prisma Client
npx prisma generate
```

### 第二阶段：安装依赖

```bash
# 安装ExcelJS用于生成Excel文件
npm install exceljs
npm install --save-dev @types/exceljs
```

### 第三阶段：API实现

1. 创建导出检查API：`/api/orders/export/check/route.ts`
2. 创建导出执行API：`/api/orders/export/route.ts`
3. 创建导出历史API：`/api/orders/export/history/route.ts`

### 第四阶段：前端实现

1. 创建导出按钮组件：`components/OrderExportButton.tsx`
2. 集成到订单列表页
3. 集成到订单详情页

### 第五阶段：测试

```typescript
// 测试用例
describe('Order Export', () => {
  it('管理员可以无限导出', async () => {
    // 测试管理员导出
  })

  it('普通用户每天最多导出2次', async () => {
    // 测试普通用户导出限制
  })

  it('只能导出已支付订单', async () => {
    // 测试订单状态限制
  })

  it('导出记录正确保存', async () => {
    // 测试导出记录
  })

  it('次日导出次数重置', async () => {
    // 测试次数重置
  })
})
```

---

## 📈 扩展功能

### 1. 批量导出

```typescript
// 支持一次导出多个订单
interface BatchExportRequest {
  orderIds: string[]
  format?: 'xlsx' | 'csv'
}
```

### 2. 自定义导出字段

```typescript
// 允许用户选择导出哪些字段
interface CustomExportRequest {
  orderId: string
  fields: string[]  // ['orderNumber', 'totalAmount', 'status', ...]
}
```

### 3. 定时导出

```typescript
// 支持设置定时导出任务
interface ScheduledExport {
  userId: string
  frequency: 'daily' | 'weekly' | 'monthly'
  filters: {
    status?: string[]
    dateRange?: { start: Date; end: Date }
  }
}
```

### 4. 导出格式扩展

- ✅ Excel (.xlsx)
- ✅ CSV (.csv)
- 📋 PDF (.pdf)
- 📋 JSON (.json)

---

## 🔒 安全考虑

### 1. 防止滥用

```typescript
// 添加IP限制
const ipExports = await prisma.orderExport.count({
  where: {
    ipAddress: clientIp,
    exportDate: { gte: today }
  }
})

if (ipExports > 10) {
  return NextResponse.json(
    { error: '导出过于频繁，请稍后再试' },
    { status: 429 }
  )
}
```

### 2. 文件大小限制

```typescript
// 限制单次导出订单数量
if (orderIds.length > 100) {
  return NextResponse.json(
    { error: '单次最多导出100个订单' },
    { status: 400 }
  )
}
```

### 3. 敏感信息处理

```typescript
// 导出时脱敏处理
function maskSensitiveData(order: Order) {
  return {
    ...order,
    // 手机号脱敏
    phone: order.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
    // 地址部分脱敏
    address: order.address?.replace(/(.{4}).*(.{4})/, '$1****$2')
  }
}
```

---

## 📝 版本历史

- **v1.0.0** (2025-12-05)
  - 初始版本
  - 记录订单导出功能设计
  - 包含完整的技术方案和实施指南

---

## 🔄 后续计划

1. **短期**（1-2周）
   - 实施数据库迁移
   - 开发基础导出API
   - 实现前端导出按钮

2. **中期**（1个月）
   - 添加导出历史记录
   - 实现批量导出
   - 优化导出性能

3. **长期**（持续）
   - 支持更多导出格式
   - 添加定时导出功能
   - 导出数据分析和统计

---

**文档维护者**: Claude
**创建日期**: 2025-12-05
**最后更新**: 2025-12-05
**状态**: 设计阶段
