# 订单安全防护方案

## 📋 目录

- [安全隐患分析](#安全隐患分析)
- [解决方案对比](#解决方案对比)
- [推荐实施方案](#推荐实施方案)
- [实施指南](#实施指南)
- [参考资料](#参考资料)

---

## 🔍 安全隐患分析

### 问题描述

**匿名用户订单号共享复用风险**

当系统支持匿名用户（无需登录）购买商品时，存在以下安全隐患：

1. **订单号泄露风险**
   - 用户可能将订单号分享给他人
   - 订单号可能在社交媒体、论坛等公开场合暴露
   - 他人获取订单号后可以查看订单详情

2. **隐私信息泄露**
   - 收货地址、联系方式等敏感信息可能被泄露
   - 购买历史和消费习惯可能被分析
   - 可能导致用户隐私受到侵犯

3. **恶意操作风险**
   - 他人可能尝试取消订单
   - 可能申请退款或发起纠纷
   - 可能修改订单信息（如果权限控制不当）

### 当前系统情况

```typescript
// 目前的查询方式（不安全）
const order = await prisma.order.findUnique({
  where: { orderNumber: orderNumber }
})
// ⚠️ 只要知道订单号，任何人都能查看订单详情
```

### 影响范围

- ✅ 登录用户：已有session验证，相对安全
- ⚠️ 匿名用户：仅依赖订单号，存在安全隐患
- ⚠️ 订单查询页面：需要增强验证机制
- ⚠️ 订单管理接口：需要访问控制

---

## 💡 解决方案对比

### 方案1：订单验证码

**概念**：创建订单时生成一个简短的验证码（如6位字母数字组合），用户需要同时提供订单号和验证码才能查看订单。

#### 数据库结构

```prisma
model Order {
  id                 String   @id @default(cuid())
  orderNumber        String   @unique
  verificationCode   String   // 新增：6位验证码
  email              String
  // ... 其他字段
}
```

#### 实现示例

```typescript
// 1. 创建订单时生成验证码
function generateVerificationCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去除易混淆字符
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// 2. 保存订单
const verificationCode = generateVerificationCode()
const order = await prisma.order.create({
  data: {
    orderNumber: generateOrderNumber(),
    verificationCode: verificationCode,
    email: orderData.email,
    // ... 其他数据
  }
})

// 3. 发送确认邮件
await sendEmail({
  to: orderData.email,
  subject: '订单确认',
  html: `
    <h2>订单创建成功</h2>
    <p>订单号：${order.orderNumber}</p>
    <p>验证码：<strong>${verificationCode}</strong></p>
    <p>查询订单时需要同时提供订单号和验证码</p>
  `
})

// 4. 查询订单时验证
const order = await prisma.order.findFirst({
  where: {
    orderNumber: orderNumber,
    verificationCode: verificationCode
  }
})

if (!order) {
  return { error: '订单号或验证码错误' }
}
```

#### 优缺点分析

**优点**：
- ✅ 实现简单，容易理解
- ✅ 用户体验好，验证码简短易记
- ✅ 通过邮件发送，安全性较高
- ✅ 数据库查询简单，性能好

**缺点**：
- ❌ 需要用户额外记住验证码
- ❌ 验证码可能随订单号一起泄露
- ❌ 如果验证码太简单，可能被暴力破解
- ❌ 需要修改数据库结构

**适用场景**：
- 对安全性要求中等的系统
- 用户主要通过邮件访问订单
- 订单查询频率较低

---

### 方案2：订单访问令牌（推荐）

**概念**：为每个订单生成一个唯一的访问令牌（UUID），用户通过邮件中的链接（包含令牌）访问订单，无需额外输入。

#### 数据库结构

```prisma
model Order {
  id                 String    @id @default(cuid())
  orderNumber        String    @unique
  accessToken        String    @unique @default(uuid()) // 访问令牌
  accessTokenExpiry  DateTime? // 令牌过期时间（可选）
  email              String
  // ... 其他字段
}
```

#### 实现示例

```typescript
import { randomUUID } from 'crypto'

// 1. 创建订单时生成访问令牌
const accessToken = randomUUID() // 如: "550e8400-e29b-41d4-a716-446655440000"
const order = await prisma.order.create({
  data: {
    orderNumber: generateOrderNumber(),
    accessToken: accessToken,
    accessTokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天有效
    email: orderData.email,
    // ... 其他数据
  }
})

// 2. 生成订单访问链接
const orderLink = `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order.orderNumber}?token=${accessToken}`

// 3. 发送确认邮件
await sendEmail({
  to: orderData.email,
  subject: '订单确认',
  html: `
    <h2>订单创建成功</h2>
    <p>订单号：${order.orderNumber}</p>
    <p><a href="${orderLink}">点击查看订单详情</a></p>
    <p>或访问：${orderLink}</p>
    <p>此链接30天内有效</p>
  `
})

// 4. 查询订单API
export async function GET(
  req: Request,
  { params }: { params: { orderNumber: string } }
) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: '缺少访问令牌' }, { status: 401 })
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNumber: params.orderNumber,
      accessToken: token,
      OR: [
        { accessTokenExpiry: null }, // 永不过期
        { accessTokenExpiry: { gte: new Date() } } // 未过期
      ]
    },
    include: {
      orderItems: {
        include: { product: true }
      }
    }
  })

  if (!order) {
    return NextResponse.json(
      { error: '订单不存在或访问令牌已过期' },
      { status: 404 }
    )
  }

  return NextResponse.json({ order })
}

// 5. 令牌刷新功能（可选）
async function refreshAccessToken(orderNumber: string, email: string) {
  const order = await prisma.order.findFirst({
    where: { orderNumber, email }
  })

  if (!order) {
    throw new Error('订单不存在')
  }

  const newToken = randomUUID()
  await prisma.order.update({
    where: { id: order.id },
    data: {
      accessToken: newToken,
      accessTokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  })

  return newToken
}
```

#### 优缺点分析

**优点**：
- ✅ 安全性高，UUID几乎不可能被猜测
- ✅ 用户体验极佳，点击链接即可访问
- ✅ 支持令牌过期机制
- ✅ 可以撤销和重新生成令牌
- ✅ 适合移动端和桌面端

**缺点**：
- ❌ 需要修改数据库结构
- ❌ 邮件链接泄露仍有风险
- ❌ 需要额外存储令牌

**适用场景**：
- 对安全性要求较高的系统
- 用户主要通过邮件访问订单
- 需要支持令牌过期和撤销

---

### 方案3：邮箱验证

**概念**：查询订单时要求用户输入购买时使用的邮箱，验证邮箱匹配后才能查看订单。

#### 实现示例

```typescript
// 订单查询API
export async function POST(req: Request) {
  const { orderNumber, email } = await req.json()

  const order = await prisma.order.findFirst({
    where: {
      orderNumber: orderNumber,
      email: email.toLowerCase().trim()
    },
    include: {
      orderItems: {
        include: { product: true }
      }
    }
  })

  if (!order) {
    return NextResponse.json(
      { error: '订单不存在或邮箱不匹配' },
      { status: 404 }
    )
  }

  return NextResponse.json({ order })
}

// 前端页面
export default function OrderQueryPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const response = await fetch('/api/orders/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, email })
    })

    if (response.ok) {
      const { order } = await response.json()
      // 显示订单详情
    } else {
      alert('订单号或邮箱错误')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="订单号"
        value={orderNumber}
        onChange={(e) => setOrderNumber(e.target.value)}
      />
      <input
        type="email"
        placeholder="购买邮箱"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">查询订单</button>
    </form>
  )
}
```

#### 增强版：邮箱 + OTP验证码

```typescript
// 1. 发送验证码
export async function POST(req: Request) {
  const { orderNumber, email } = await req.json()

  const order = await prisma.order.findFirst({
    where: { orderNumber, email }
  })

  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }

  // 生成6位数字验证码
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

  // 保存验证码（使用Redis或数据库，5分钟有效）
  await redis.setex(`otp:${orderNumber}`, 300, otpCode)

  // 发送验证码邮件
  await sendEmail({
    to: email,
    subject: '订单查询验证码',
    html: `您的验证码是：<strong>${otpCode}</strong>，5分钟内有效`
  })

  return NextResponse.json({ message: '验证码已发送' })
}

// 2. 验证OTP并返回订单
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orderNumber = searchParams.get('orderNumber')
  const otpCode = searchParams.get('otp')

  const savedOtp = await redis.get(`otp:${orderNumber}`)

  if (savedOtp !== otpCode) {
    return NextResponse.json({ error: '验证码错误或已过期' }, { status: 401 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { orderItems: { include: { product: true } } }
  })

  // 删除已使用的验证码
  await redis.del(`otp:${orderNumber}`)

  return NextResponse.json({ order })
}
```

#### 优缺点分析

**优点**：
- ✅ 不需要额外数据库字段
- ✅ 用户容易理解和使用
- ✅ 结合OTP后安全性高
- ✅ 防止暴力破解

**缺点**：
- ❌ 如果邮箱也泄露，仍有风险
- ❌ 需要额外的邮件发送成本
- ❌ 用户体验略差（需要额外输入）
- ❌ OTP方案需要Redis等缓存系统

**适用场景**：
- 不想修改现有数据库结构
- 对安全性要求极高
- 愿意增加邮件发送成本

---

### 方案4：JWT签名链接

**概念**：使用JWT技术生成包含订单信息和签名的访问链接，无需额外数据库字段，自带过期和防篡改机制。

#### 实现示例

```typescript
import jwt from 'jsonwebtoken'

// 1. 创建订单后生成JWT令牌
const order = await prisma.order.create({
  data: { /* ... */ }
})

const token = jwt.sign(
  {
    orderId: order.id,
    orderNumber: order.orderNumber,
    email: order.email,
    purpose: 'order_access'
  },
  process.env.JWT_SECRET!,
  { expiresIn: '30d' } // 30天有效
)

const orderLink = `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order.orderNumber}?auth=${token}`

// 2. 发送邮件
await sendEmail({
  to: order.email,
  subject: '订单确认',
  html: `<a href="${orderLink}">查看订单详情</a>`
})

// 3. 验证访问
export async function GET(
  req: Request,
  { params }: { params: { orderNumber: string } }
) {
  const { searchParams } = new URL(req.url)
  const authToken = searchParams.get('auth')

  if (!authToken) {
    return NextResponse.json({ error: '缺少认证令牌' }, { status: 401 })
  }

  try {
    // 验证JWT
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET!) as {
      orderId: string
      orderNumber: string
      email: string
      purpose: string
    }

    // 验证用途
    if (decoded.purpose !== 'order_access') {
      throw new Error('令牌用途不匹配')
    }

    // 验证订单号
    if (decoded.orderNumber !== params.orderNumber) {
      throw new Error('订单号不匹配')
    }

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { id: decoded.orderId },
      include: { orderItems: { include: { product: true } } }
    })

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    return NextResponse.json({ order })

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return NextResponse.json({ error: '访问链接已过期' }, { status: 401 })
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '访问链接无效' }, { status: 401 })
    }
    throw error
  }
}

// 4. 重新生成访问链接（用户丢失邮件时）
export async function POST(req: Request) {
  const { orderNumber, email } = await req.json()

  const order = await prisma.order.findFirst({
    where: { orderNumber, email }
  })

  if (!order) {
    return NextResponse.json({ error: '订单不存在或邮箱不匹配' }, { status: 404 })
  }

  const newToken = jwt.sign(
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      purpose: 'order_access'
    },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' }
  )

  const orderLink = `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order.orderNumber}?auth=${newToken}`

  await sendEmail({
    to: order.email,
    subject: '订单查询链接',
    html: `<a href="${orderLink}">查看订单详情</a>`
  })

  return NextResponse.json({ message: '访问链接已发送到您的邮箱' })
}
```

#### 优缺点分析

**优点**：
- ✅ 无需额外数据库字段
- ✅ 自带过期机制
- ✅ 防止篡改（签名验证）
- ✅ 可以包含额外信息
- ✅ 性能好，无需查询令牌

**缺点**：
- ❌ 无法主动撤销令牌（除非维护黑名单）
- ❌ 令牌较长，URL可能很长
- ❌ 需要管理JWT密钥

**适用场景**：
- 不想增加数据库字段
- 对性能要求高
- 接受无法撤销令牌的限制

---

## 🎯 推荐实施方案

### 混合方案：访问令牌 + 邮箱验证

结合方案2和方案3的优点，提供最佳的安全性和用户体验。

#### 实施策略

```typescript
// 数据库结构
model Order {
  id                 String    @id @default(cuid())
  orderNumber        String    @unique
  accessToken        String    @unique @default(uuid())
  accessTokenExpiry  DateTime?
  email              String
  // ... 其他字段
}

// API设计
export async function GET(
  req: Request,
  { params }: { params: { orderNumber: string } }
) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  // 方式1：通过令牌访问（推荐，用户体验最佳）
  if (token) {
    return await verifyByToken(params.orderNumber, token)
  }

  // 方式2：提示需要邮箱验证
  return NextResponse.json(
    {
      error: '需要验证',
      requireEmail: true,
      message: '请输入购买时使用的邮箱以获取访问链接'
    },
    { status: 401 }
  )
}

// 通过令牌验证
async function verifyByToken(orderNumber: string, token: string) {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      accessToken: token,
      OR: [
        { accessTokenExpiry: null },
        { accessTokenExpiry: { gte: new Date() } }
      ]
    },
    include: { orderItems: { include: { product: true } } }
  })

  if (!order) {
    return NextResponse.json(
      { error: '订单不存在或访问令牌已过期' },
      { status: 404 }
    )
  }

  return NextResponse.json({ order })
}

// 通过邮箱请求访问链接
export async function POST(req: Request) {
  const { orderNumber, email } = await req.json()

  const order = await prisma.order.findFirst({
    where: { orderNumber, email }
  })

  if (!order) {
    return NextResponse.json(
      { error: '订单号或邮箱不匹配' },
      { status: 404 }
    )
  }

  // 生成新令牌（或使用现有令牌）
  let token = order.accessToken
  if (!order.accessTokenExpiry || order.accessTokenExpiry < new Date()) {
    token = randomUUID()
    await prisma.order.update({
      where: { id: order.id },
      data: {
        accessToken: token,
        accessTokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })
  }

  const orderLink = `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${orderNumber}?token=${token}`

  await sendEmail({
    to: email,
    subject: '订单查询链接',
    html: `<a href="${orderLink}">点击查看订单详情</a>`
  })

  return NextResponse.json({
    message: '访问链接已发送到您的邮箱',
    success: true
  })
}
```

#### 前端实现

```typescript
'use client'

export default function OrderDetailPage({
  params
}: {
  params: { orderNumber: string }
}) {
  const [order, setOrder] = useState(null)
  const [requireEmail, setRequireEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    loadOrder()
  }, [])

  const loadOrder = async () => {
    try {
      const url = `/api/orders/${params.orderNumber}${token ? `?token=${token}` : ''}`
      const response = await fetch(url)

      if (response.ok) {
        const data = await response.json()
        setOrder(data.order)
      } else {
        const error = await response.json()
        if (error.requireEmail) {
          setRequireEmail(true)
        }
      }
    } catch (error) {
      console.error('加载订单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const requestAccessLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/orders/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: params.orderNumber,
          email: email
        })
      })

      if (response.ok) {
        alert('访问链接已发送到您的邮箱，请查收')
      } else {
        const error = await response.json()
        alert(error.error || '请求失败')
      }
    } catch (error) {
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>加载中...</div>
  }

  if (requireEmail) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">验证身份</h2>
        <p className="text-gray-600 mb-4">
          请输入购买时使用的邮箱，我们将发送订单查询链接到您的邮箱
        </p>
        <form onSubmit={requestAccessLink}>
          <input
            type="email"
            placeholder="购买邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-md mb-4"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
          >
            {loading ? '发送中...' : '发送访问链接'}
          </button>
        </form>
      </div>
    )
  }

  if (!order) {
    return <div>订单不存在或已过期</div>
  }

  return (
    <div>
      {/* 显示订单详情 */}
    </div>
  )
}
```

---

## 📊 方案对比总结

| 方案 | 安全性 | 用户体验 | 实施难度 | 数据库改动 | 推荐度 |
|------|--------|----------|----------|------------|---------|
| 方案1：验证码 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 需要 | ⭐⭐⭐ |
| 方案2：访问令牌 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 需要 | ⭐⭐⭐⭐⭐ |
| 方案3：邮箱验证 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 不需要 | ⭐⭐⭐ |
| 方案3+：邮箱+OTP | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 不需要 | ⭐⭐⭐⭐ |
| 方案4：JWT签名 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 不需要 | ⭐⭐⭐⭐ |
| 混合方案 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 需要 | ⭐⭐⭐⭐⭐ |

---

## 🚀 实施指南

### 第一阶段：数据库迁移

```bash
# 1. 创建迁移文件
npx prisma migrate dev --name add_order_security_fields

# 2. 更新schema.prisma
model Order {
  id                 String    @id @default(cuid())
  orderNumber        String    @unique
  accessToken        String    @unique @default(uuid())
  accessTokenExpiry  DateTime? @default(dbgenerated("NOW() + INTERVAL '30 days'"))
  email              String
  // ... 其他字段
}

# 3. 为现有订单生成令牌
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function migrateExistingOrders() {
  const orders = await prisma.order.findMany({
    where: { accessToken: null }
  })

  for (const order of orders) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        accessToken: randomUUID(),
        accessTokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })
  }

  console.log(`已为 ${orders.length} 个订单生成访问令牌`)
}

migrateExistingOrders()
```

### 第二阶段：API实现

1. 创建订单查询API：`/app/api/orders/[orderNumber]/route.ts`
2. 创建访问请求API：`/app/api/orders/request-access/route.ts`
3. 更新订单创建逻辑，生成并发送令牌

### 第三阶段：前端更新

1. 更新订单详情页面
2. 添加邮箱验证表单
3. 更新订单确认邮件模板

### 第四阶段：测试

```typescript
// 测试用例
describe('Order Security', () => {
  it('should require token to access order', async () => {
    const response = await fetch(`/api/orders/${orderNumber}`)
    expect(response.status).toBe(401)
  })

  it('should allow access with valid token', async () => {
    const response = await fetch(`/api/orders/${orderNumber}?token=${validToken}`)
    expect(response.status).toBe(200)
  })

  it('should reject expired token', async () => {
    const response = await fetch(`/api/orders/${orderNumber}?token=${expiredToken}`)
    expect(response.status).toBe(401)
  })

  it('should send access link to matching email', async () => {
    const response = await fetch('/api/orders/request-access', {
      method: 'POST',
      body: JSON.stringify({ orderNumber, email })
    })
    expect(response.status).toBe(200)
  })

  it('should reject non-matching email', async () => {
    const response = await fetch('/api/orders/request-access', {
      method: 'POST',
      body: JSON.stringify({ orderNumber, email: 'wrong@email.com' })
    })
    expect(response.status).toBe(404)
  })
})
```

---

## 📚 参考资料

### 相关标准和最佳实践

- [OWASP Top 10 - Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [RFC 6750 - OAuth 2.0 Bearer Token](https://tools.ietf.org/html/rfc6750)
- [RFC 7519 - JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)

### 相关技术文档

- [Prisma Schema](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)

---

## 📝 版本历史

- **v1.0.0** (2025-12-05)
  - 初始版本
  - 记录安全隐患分析
  - 提供4种解决方案
  - 推荐混合实施方案

---

## 🔄 后续计划

1. **短期**（1-2周）
   - 评估各方案的适用性
   - 确定最终实施方案
   - 准备数据库迁移脚本

2. **中期**（1个月）
   - 实施数据库迁移
   - 开发API和前端功能
   - 进行全面测试

3. **长期**（持续）
   - 监控安全指标
   - 收集用户反馈
   - 持续优化改进

---

**文档维护者**: Claude
**创建日期**: 2025-12-05
**最后更新**: 2025-12-05
**状态**: 待评审
