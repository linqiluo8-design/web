# 会员系统功能说明

## ✅ 已完成功能

### 1. 会员数据库模型
- **MembershipPlan**: 会员方案表（价格、折扣率、有效期、每日限制等）
- **Membership**: 会员购买记录（会员码、购买时快照、有效期等）
- **MembershipUsage**: 每日使用记录（统计每天使用折扣次数）
- **Order扩展**: 添加membershipId、originalAmount、discount字段

### 2. 初始会员方案
已创建3个默认方案：
- **年度会员**: ¥88 / 1年 / 8折 / 每天10次
- **三年会员**: ¥188 / 3年 / 7折 / 每天8次
- **终身会员**: ¥288 / 终身 / 7折 / 每天8次

### 3. 后台管理
- **会员方案管理**: `/backendmanager/memberships`
  - 查看所有方案
  - 编辑方案（价格、折扣、每日限制等）
  - 启用/停用方案
  - 排序管理
- **注意**: 修改方案不影响已购买会员，他们保留购买时的配置

### 4. 会员购买流程
- **购买页面**: `/membership`
  - 展示所有可用会员方案
  - 清晰显示折扣和每日限制
  - 一键购买
- **API**:
  - `POST /api/memberships/purchase` - 购买会员，生成唯一会员码
  - `POST /api/memberships/verify` - 验证会员码有效性和剩余次数
- **会员码**: SHA256哈希，16位大写字母数字组合

### 5. 导航优化
- ✅ 添加"购买会员"链接到导航栏
- ✅ 首页替换"查询订单"为"购买会员"

### 6. 课程互换功能
- **触发条件**: 商品列表页选择"课程"分类时显示
- **位置**: 标题旁边的绿色按钮
- **功能**: 弹窗提示联系客服进行课程互换或高价回收

## ⏳ 待完成功能

### 会员码验证和折扣应用
需要在以下页面集成会员码功能：

#### 1. 购物车页面 (`app/cart/page.tsx`)
```tsx
// 添加状态
const [membershipCode, setMembershipCode] = useState("")
const [membershipInfo, setMembershipInfo] = useState(null)

// 验证会员码
const verifyMembership = async () => {
  const res = await fetch("/api/memberships/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ membershipCode })
  })
  const data = await res.json()
  if (data.valid) {
    setMembershipInfo(data.membership)
    // 重新计算总价，应用折扣
  }
}

// UI: 添加会员码输入框
<div className="mb-4">
  <label>会员码（可选）</label>
  <input
    value={membershipCode}
    onChange={(e) => setMembershipCode(e.target.value)}
    placeholder="输入会员码享受折扣"
  />
  <button onClick={verifyMembership}>验证</button>
</div>

// 显示折扣信息
{membershipInfo && (
  <div>
    <p>会员折扣: {(membershipInfo.discount * 10)}折</p>
    <p>今日剩余: {membershipInfo.remainingToday}次</p>
    <p>原价: ¥{originalTotal}</p>
    <p>折后价: ¥{discountedTotal}</p>
  </div>
)}
```

#### 2. 订单创建API (`app/api/orders/route.ts`)
```tsx
// 接收membershipCode
const { items, membershipCode } = await request.json()

// 验证会员码
let membership = null
if (membershipCode) {
  const verifyRes = await fetch("http://localhost:3000/api/memberships/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ membershipCode })
  })
  const verifyData = await verifyRes.json()
  if (verifyData.valid && verifyData.membership.remainingToday > 0) {
    membership = verifyData.membership
  }
}

// 计算价格
const originalAmount = totalAmount
let finalAmount = originalAmount
let discount = null

if (membership && items.length <= membership.remainingToday) {
  discount = membership.discount
  finalAmount = originalAmount * discount
}

// 创建订单时保存
const order = await prisma.order.create({
  data: {
    orderNumber,
    totalAmount: finalAmount,
    originalAmount,  // 保存原价
    discount,        // 保存折扣率
    membershipId: membership?.id,
    // ...
  }
})

// 更新会员使用次数
if (membership) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await prisma.membershipUsage.upsert({
    where: {
      membershipId_usageDate: {
        membershipId: membership.id,
        usageDate: today
      }
    },
    update: {
      count: { increment: items.length }
    },
    create: {
      membershipId: membership.id,
      usageDate: today,
      count: items.length
    }
  })
}
```

#### 3. 商品详情"立即购买" (`app/products/[id]/page.tsx`)
- 同样添加会员码输入框
- 验证后显示折扣价格
- 传递会员码到订单创建API

## 📋 使用流程

### 用户购买会员
1. 访问 `/membership` 查看会员方案
2. 选择方案点击"立即购买"
3. 支付成功后获得唯一会员码
4. 妥善保管会员码

### 用户使用会员折扣
1. 购买商品时输入会员码
2. 系统验证会员码有效性
3. 检查今日剩余使用次数
4. 自动应用折扣
5. 如果超出每日限制，按原价购买

### 管理员管理会员
1. 访问 `/backendmanager/memberships`
2. 可以调整会员价格、折扣、每日限制
3. 已购买会员不受影响（使用购买时快照）

## 🔒 安全性

- ✅ 会员码使用SHA256哈希，不可逆
- ✅ 购买时保存方案快照，防止后续修改影响已购会员
- ✅ 每日使用次数限制，防止滥用
- ✅ 过期自动失效
- ✅ 匿名购买，保护隐私

## 📸 数据快照设计理念（核心设计）

### 设计原则：历史数据独立性
**会员订单信息是独立的，不受新设置的会员套餐数据影响。历史是历史，新是新的。**

### 为什么需要数据快照？
会员套餐会因为促销活动、运营策略调整而频繁修改（如价格调整、折扣变化）。如果历史订单引用套餐数据，会导致：
1. ❌ 用户购买时是88元，后期套餐改为199元，历史订单显示错误
2. ❌ 用户购买时享受8折，后期改为9折，影响用户权益
3. ❌ 无法追溯用户真实购买时的套餐配置

### 技术实现：数据快照机制

#### 1. 购买时保存完整快照
在 `app/api/memberships/purchase/route.ts` 中实现：

```typescript
// 保存方案快照（第43-50行）
const planSnapshot = JSON.stringify({
  name: plan.name,        // 套餐名称
  price: plan.price,      // 购买时价格
  duration: plan.duration,// 购买时有效期
  discount: plan.discount,// 购买时折扣率
  dailyLimit: plan.dailyLimit // 购买时每日限制
})

// 创建会员记录（第52-67行）
const membership = await prisma.membership.create({
  data: {
    userId,
    membershipCode,
    planId: plan.id,        // 关联套餐ID（仅用于查询）
    planSnapshot,           // 🔑 完整快照JSON
    purchasePrice: plan.price,    // 🔑 独立字段：购买价格
    discount: plan.discount,      // 🔑 独立字段：折扣率
    dailyLimit: plan.dailyLimit,  // 🔑 独立字段：每日限制
    duration: plan.duration,      // 🔑 独立字段：有效期
    startDate: new Date(),
    endDate: endDate,
    status: "active",
    paymentStatus: "pending"
  }
})
```

#### 2. 数据独立性保证
| 字段 | 数据来源 | 是否独立 | 说明 |
|------|---------|---------|------|
| `planId` | 关联套餐表 | ❌ | 仅用于显示套餐名称，不影响权益 |
| `planSnapshot` | 购买时快照 | ✅ | JSON完整记录，永久保存 |
| `purchasePrice` | 购买时价格 | ✅ | 独立字段，永不改变 |
| `discount` | 购买时折扣 | ✅ | 独立字段，永不改变 |
| `dailyLimit` | 购买时限制 | ✅ | 独立字段，永不改变 |
| `duration` | 购买时天数 | ✅ | 独立字段，永不改变 |
| `endDate` | 计算值 | ✅ | 购买时计算，永不改变 |

#### 3. 实际案例说明

**场景：双十一促销**
```
2024年10月：年度会员套餐
├─ 价格：¥88
├─ 折扣：8折
└─ 每日限制：10次

用户A在10月20日购买 ✅
├─ 订单记录：¥88 / 8折 / 每日10次
└─ 保存快照：{"price": 88, "discount": 0.8, "dailyLimit": 10}

2024年11月：双十一促销，套餐修改
├─ 价格：¥58 (降价促销)
├─ 折扣：7折 (加大力度)
└─ 每日限制：15次 (放宽限制)

用户B在11月11日购买 ✅
├─ 订单记录：¥58 / 7折 / 每日15次
└─ 保存快照：{"price": 58, "discount": 0.7, "dailyLimit": 15}

2024年12月：促销结束，套餐恢复
├─ 价格：¥99 (涨价)
├─ 折扣：8.5折
└─ 每日限制：8次

查看历史订单：
├─ 用户A订单：依然显示 ¥88 / 8折 / 每日10次 ✅ 不受影响
├─ 用户B订单：依然显示 ¥58 / 7折 / 每日15次 ✅ 不受影响
└─ 新用户C购买：¥99 / 8.5折 / 每日8次 ✅ 使用新价格
```

#### 4. 使用会员权益时的数据来源
当用户在购物车使用会员码时，系统读取的是 **Membership 表中的独立字段**，而不是 MembershipPlan 表：

```typescript
// app/api/orders/[id]/apply-membership/route.ts
const membership = await prisma.membership.findUnique({
  where: { membershipCode: code }
})

// 使用的是购买时保存的字段，不是套餐表的字段
const discount = membership.discount      // ✅ 用户购买时的折扣
const dailyLimit = membership.dailyLimit  // ✅ 用户购买时的限制
// 而不是 membership.plan.discount 或 membership.plan.dailyLimit
```

### 数据一致性检查

#### 关系图
```
MembershipPlan (套餐表 - 可修改)
    ↓ planId (弱关联，仅用于显示)
Membership (会员记录 - 不可修改)
    ├─ planSnapshot (快照)
    ├─ purchasePrice (独立)
    ├─ discount (独立)
    ├─ dailyLimit (独立)
    └─ duration (独立)
    ↓
MembershipUsage (使用记录)
Order (订单)
```

#### 核心规则
1. ✅ **购买时**：从 MembershipPlan 读取数据，保存到 Membership 独立字段
2. ✅ **使用时**：从 Membership 独立字段读取，不再查询 MembershipPlan
3. ✅ **展示时**：显示 Membership 中保存的数据，确保历史准确
4. ✅ **修改套餐**：只影响新购买用户，不影响已购买用户

### 在代码中的体现

#### 会员订单展示页面 (`app/membership-orders/page.tsx`)
```typescript
// 第257行：显示购买时的套餐信息
<p className="text-sm font-semibold">
  {getDurationDisplay(order.duration)} •  {/* 购买时的天数 */}
  {(order.discount * 10).toFixed(1)}折 •  {/* 购买时的折扣 */}
  每日{order.dailyLimit}次              {/* 购买时的限制 */}
</p>
```

#### 管理员订单管理页面 (`app/backendmanager/membership-records/page.tsx`)
```typescript
// 第368-372行：显示购买时的价格
<div className="text-sm">
  <div className="font-medium text-gray-900">{record.plan.name}</div>
  <div className="text-gray-500">¥{record.purchasePrice.toFixed(2)}</div>
  {/* 使用 purchasePrice 而不是 plan.price */}
</div>
```

### 总结
✅ **完全隔离**：历史订单数据与套餐表完全隔离
✅ **永久保存**：购买时的配置永久保存，不会因套餐修改而改变
✅ **权益保障**：用户购买时的权益得到保障，不受后续运营调整影响
✅ **审计追溯**：可以准确追溯任何时间点的购买记录和配置

## 📊 数据库表结构

```sql
-- 会员方案
MembershipPlan {
  id, name, price, duration, discount, dailyLimit, status, sortOrder
}

-- 会员记录
Membership {
  id, membershipCode, planId, planSnapshot,
  purchasePrice, discount, dailyLimit, duration,
  startDate, endDate, status
}

-- 使用记录
MembershipUsage {
  id, membershipId, usageDate, count
}
```

## 🎯 下一步建议

1. ✅ 已完成会员购买页面
2. ✅ 已完成会员验证API
3. ⏳ 集成会员码到购物车（需要修改UI和逻辑）
4. ⏳ 集成会员码到订单创建（需要修改API）
5. ⏳ 添加会员支付页面（类似商品支付）
6. ⏳ 添加"我的会员"页面查询会员状态
7. ⏳ 后台添加会员购买记录查询

## 运行说明

1. 同步数据库：`npx prisma db push`
2. 初始化会员方案：`npx tsx scripts/init-membership-plans.ts`
3. 启动项目：`npm run dev`
4. 访问会员购买：http://localhost:3000/membership
5. 访问会员管理：http://localhost:3000/backendmanager/memberships
