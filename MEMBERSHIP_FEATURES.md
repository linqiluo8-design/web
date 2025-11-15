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
