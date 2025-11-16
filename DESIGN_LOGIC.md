# 知识付费系统 - 设计逻辑文档

> 📌 本文档记录系统的核心设计逻辑、关键决策和实现方案，方便后续开发追溯

---

## 📋 目录

- [用户认证与权限](#用户认证与权限)
- [会员系统](#会员系统)
- [商品管理](#商品管理)
- [订单与支付](#订单与支付)
- [安全设计](#安全设计)
- [API 路由规范](#api-路由规范)

---

## 🔐 用户认证与权限

### 用户审核机制

**设计决策**（2025-11）：
- 所有新注册用户默认状态为 `PENDING`（待审核）
- 只有管理员批准（`APPROVED`）后才能登录系统
- 三种账号状态：
  - `PENDING` - 待审核（注册后默认状态）
  - `APPROVED` - 已批准（可登录）
  - `REJECTED` - 已拒绝（无法登录）

**实现位置**：
- Schema: `prisma/schema.prisma` - `User.accountStatus`
- 注册逻辑: `app/api/auth/register/route.ts`
- 登录验证: `lib/auth.ts` - `authorize` 函数
- 审核管理: `app/backendmanager/users/page.tsx`

### 细粒度权限控制

**权限模块**：
1. `CATEGORIES` - 分类管理
2. `MEMBERSHIPS` - 会员管理
3. `ORDERS` - 订单数据管理
4. `PRODUCTS` - 商品管理

**权限级别**：
- `NONE` - 无权限
- `READ` - 只读权限
- `WRITE` - 读写权限

**特殊规则**：
- 管理员（`role=ADMIN`）自动拥有所有权限
- 普通用户需要单独授权

**实现位置**：
- Schema: `prisma/schema.prisma` - `Permission` 模型
- 权限工具: `lib/permissions.ts`
- 权限管理 API: `app/api/backendmanager/users/[id]/permissions/route.ts`

---

## 💳 会员系统

### 会员方案设计

**核心字段**：
```typescript
{
  name: string        // 会员名称（如"年度会员"）
  price: number       // 价格
  duration: number    // 有效期天数（-1=终身）
  discount: number    // 折扣率（0.8=8折）
  dailyLimit: number  // 每日折扣使用次数
  status: string      // active | inactive
  sortOrder: number   // 显示排序
}
```

**设计决策**：
- 会员方案独立管理，使用专用脚本 `scripts/init-membership-plans.ts`
- 测试数据脚本 `scripts/create-test-data.js` 不创建会员方案，避免覆盖自定义配置
- 会员码采用哈希存储，确保唯一性

**使用流程**：
1. 用户购买会员方案
2. 系统生成唯一会员码
3. 用户在购物车/立即购买时输入会员码
4. 系统验证并应用折扣
5. 记录每日使用次数

**实现位置**：
- Schema: `prisma/schema.prisma` - `MembershipPlan`, `Membership`, `MembershipUsage`
- 购买页面: `app/membership/page.tsx`
- 成功页面: `app/membership/success/page.tsx`
- 验证 API: `app/api/memberships/verify/route.ts`

### 会员购买跳转优化

**设计方案**（2025-11）：
- 购物车页面跳转会员购买时，URL 带参数 `?from=cart`
- 购买成功后根据来源显示不同按钮：
  - 从购物车来：显示"返回购物车" + "继续购物"
  - 其他来源：显示"立即购物" + "查看会员方案"

**实现位置**：
- 购物车链接: `app/cart/page.tsx:308` - `href="/membership?from=cart"`
- 成功页面: `app/membership/success/page.tsx` - `fromCart` 状态判断

---

## 🛍️ 商品管理

### 商品图片配置

**图片来源**：
- 开发环境使用 `picsum.photos` 提供测试图片
- 需在 `next.config.ts` 中配置允许的图片域名

**配置示例**：
```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'picsum.photos',
      pathname: '/**',
    },
  ],
}
```

**实现位置**：
- 配置: `next.config.ts`
- 测试数据: `scripts/create-test-data.js` - 商品 coverImage

---

## 💰 订单与支付

### 会员码优惠处理

**适用场景**：
1. 购物车批量结算
2. 单商品立即购买（2025-11 新增）

**折扣计算逻辑**：
```javascript
原价 * 会员折扣率 = 折后价
```

**注意事项**：
- 需检查会员码有效期
- 需检查每日使用限制
- 折扣信息记录到订单中（`originalAmount`, `discount`）

**立即购买会员码支持**（2025-11）：
- 点击"立即购买"按钮时弹出会员码输入对话框
- 支持实时验证会员码
- 显示折扣后的价格预览
- 可选择性使用会员码（跳过输入直接购买）
- 与购物车的会员码验证逻辑保持一致

**实现位置**：
- 购物车验证: `app/cart/page.tsx` - `verifyMembership`
- 立即购买验证: `app/products/page.tsx` - `verifyMembership`
- 订单创建: `app/api/orders/route.ts`

### 支付方式

支持三种支付方式：
1. **支付宝** - `alipay`
2. **微信支付** - `wechat`
3. **PayPal** - `paypal`

**实现位置**：
- 支付服务: `lib/payment/`
  - `lib/payment/alipay.ts`
  - `lib/payment/wechat.ts`
  - `lib/payment/paypal.ts`
- 支付创建: `app/api/payment/create/route.ts`
- 支付回调: `app/api/payment/callback/`

### 订单数据管理安全机制

**设计决策**（2025-11）：
- 清理订单数据前**必须先导出**相同配置的订单数据
- 导出功能**不强绑定**清理功能，可独立使用

**安全流程**：
1. **导出阶段**：
   - 配置导出参数（日期范围、订单状态）
   - 执行导出操作
   - 导出成功后，系统记录导出配置

2. **清理阶段**：
   - 配置清理参数（日期范围、订单状态）
   - 系统自动验证清理配置是否与最近的导出配置一致
   - 如果配置不匹配，阻止清理操作并提示先导出
   - 如果配置匹配，允许执行清理
   - 清理成功后，清除导出记录（需要重新导出才能再次清理）

**配置匹配规则**：
- 开始日期必须一致
- 结束日期必须一致
- 订单状态必须一致

**UI 提示**：
- 未导出时：显示黄色警告提示"请先导出要清理的订单数据"
- 已导出时：显示绿色成功提示"已导出数据：[日期范围] ([状态])"
- 尝试清理未导出的配置时：弹出警告对话框阻止操作

**实现位置**：
- 后台订单管理: `app/backendmanager/orders/page.tsx`
- 清理 API: `app/api/backendmanager/orders/cleanup/route.ts`
- 导出 API: `app/api/backendmanager/orders/export/route.ts`

---

## 🔒 安全设计

### 管理后台路径

**设计决策**（2025-11）：
- ❌ 不使用常见的 `/admin` 路径（易被攻击）
- ✅ 使用 `/backendmanager` 路径（提高安全性）

**路径映射**：
```
旧路径                              → 新路径
/admin/users                       → /backendmanager/users
/api/admin/users                   → /api/backendmanager/users
/api/admin/products                → /api/backendmanager/products
/api/admin/orders                  → /api/backendmanager/orders
```

**实现位置**：
- 页面: `app/backendmanager/`
- API: `app/api/backendmanager/`
- 导航: `components/Navbar.tsx`

### 权限验证

**API 权限保护**：
```typescript
import { requireAdmin, requireRead, requireWrite } from '@/lib/permissions'

// 要求管理员权限
export async function DELETE(req: Request) {
  await requireAdmin()
  // ...
}

// 要求读权限
export async function GET(req: Request) {
  await requireRead('PRODUCTS')
  // ...
}

// 要求写权限
export async function POST(req: Request) {
  await requireWrite('CATEGORIES')
  // ...
}
```

---

## 🌐 API 路由规范

### 命名规则

1. **资源命名**：使用复数形式
   - ✅ `/api/products`
   - ❌ `/api/product`

2. **动作命名**：使用动词
   - ✅ `/api/memberships/verify`
   - ✅ `/api/orders/export`

3. **管理接口**：统一前缀 `/api/backendmanager/`
   - ✅ `/api/backendmanager/users`
   - ✅ `/api/backendmanager/products`

### HTTP 方法规范

- `GET` - 查询数据
- `POST` - 创建资源
- `PUT` - 更新整个资源
- `PATCH` - 部分更新
- `DELETE` - 删除资源

---

## 📦 数据库迁移

### 重要脚本

1. **测试数据创建**：
   ```bash
   node scripts/create-test-data.js
   ```
   创建：管理员、测试用户、分类、商品（不含会员方案）

2. **会员方案初始化**：
   ```bash
   npx tsx scripts/init-membership-plans.ts
   ```
   创建：会员方案配置

3. **现有用户批准**：
   ```bash
   npx tsx scripts/update-existing-users.ts
   ```
   批准所有现有用户（添加审核功能后运行一次）

### 数据库更新流程

```bash
# 1. 生成 Prisma Client
npx prisma generate

# 2. 创建迁移
npx prisma migrate dev --name your_migration_name

# 3. 重置数据库（仅开发环境）
npx prisma migrate reset

# 4. 重新创建测试数据
node scripts/create-test-data.js
npx tsx scripts/init-membership-plans.ts
```

---

## 📄 分页与搜索优化

### 订单展示优化（2025-11）

**设计决策**：
- 所有订单展示页面支持分页和搜索功能
- 提供灵活的每页数量配置和页码跳转功能

**功能细节**：

1. **匿名用户订单（`/my-orders`）**：
   - 默认展示最近10条订单记录
   - 支持手动配置每页显示数量（10/15/20/30/50条）
   - 支持翻页/分页预览所有订单
   - 支持手动跳转到指定页码
   - 支持通过订单号搜索特定订单
   - 订单数据从 localStorage 读取，客户端分页

2. **会员用户订单（`/orders`）**：
   - 默认展示最近10条订单记录
   - 支持手动配置每页显示数量（10/15/20/30/50条）
   - 支持翻页/分页预览所有订单
   - 支持手动跳转到指定页码
   - 支持通过订单号搜索特定订单
   - 支持按状态筛选（全部、待支付、已支付、已完成、已取消、已退款）

3. **后台管理员订单（`/backendmanager/orders`）**：
   - 默认展示最近10条订单记录
   - 支持手动配置每页显示数量（10/15/20/30/50条）
   - 支持翻页/分页预览所有订单
   - 支持手动跳转到指定页码
   - 支持通过订单号搜索特定订单
   - 支持按状态筛选
   - 支持按日期范围筛选
   - 显示用户信息（注册用户显示姓名和邮箱，匿名用户标记为"匿名用户"）

**实现位置**：
- 匿名用户订单: `app/my-orders/page.tsx`
- 会员用户订单: `app/orders/page.tsx`
- 后台订单管理: `app/backendmanager/orders/page.tsx`

### 商品列表优化（2025-11）

**设计决策**：
- 商品列表默认每页展示15件商品
- 支持灵活的每页数量配置和页码跳转

**功能细节**：
- 默认展示15件商品（调整自之前的12件）
- 支持手动配置每页显示数量（10/15/20/30/50件）
- 支持翻页/分页预览所有商品
- 支持手动跳转到指定页码
- 支持通过商品标题或描述搜索
- 支持多分类筛选（多选）
- 支持"其他"分类筛选

**实现位置**：
- 商品列表: `app/products/page.tsx`
- API 路由: `app/api/products/route.ts`

**分页组件设计**：
```typescript
// 每页数量选择器
[10, 15, 20, 30, 50].map((num) => (
  <button onClick={() => handleLimitChange(num)}>
    {num}
  </button>
))

// 跳转到指定页
<input type="number" min="1" max={totalPages} />
<button onClick={handleJumpToPage}>跳转</button>
```

---

## 🎨 UI/UX 优化

### 弹窗倒计时

**设计方案**（2025-11）：

1. **复制会员码弹窗**：
   - 5秒自动关闭
   - 实时显示倒计时：`{countdown}秒后自动退出`
   - 支持手动点击"确定"关闭

2. **添加购物车成功**（待实现）：
   - 3秒自动关闭
   - 实时显示倒计时：`{countdown}秒后自动关闭`
   - 支持手动点击"确定"关闭

**实现方式**：
```typescript
const [countdown, setCountdown] = useState(5)

useEffect(() => {
  if (!showDialog) return

  if (countdown > 0) {
    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)
    return () => clearTimeout(timer)
  } else {
    setShowDialog(false)
  }
}, [showDialog, countdown])
```

---

## 📝 待办事项

### 已完成 ✅
- [x] 用户审核系统
- [x] 细粒度权限管理
- [x] 管理后台路径安全优化
- [x] 会员购买跳转优化
- [x] 复制会员码倒计时
- [x] 商品列表分页和搜索优化（默认15件/页）
- [x] 用户订单分页和搜索优化（默认10条/页）
- [x] 后台订单管理分页和搜索优化（默认10条/页）
- [x] 匿名用户订单分页和搜索优化（默认10条/页）
- [x] 订单数据清理安全机制（必须先导出才能清理）
- [x] 立即购买会员码优惠逻辑

### 进行中 🔄
- [ ] 添加购物车成功弹窗优化
- [ ] 订单支付创建失败修复
- [ ] 购物车会员码结算闪现问题

### 待优化 📋
- [ ] 客服聊天功能更换
- [ ] 添加更多支付方式
- [ ] 订单导出优化
- [ ] 邮件通知功能

---

## 🔗 相关文档

- [README.md](./README.md) - 项目简介和快速开始
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署文档
- [MEMBERSHIP_FEATURES.md](./MEMBERSHIP_FEATURES.md) - 会员功能详解
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - 数据迁移指南

---

**最后更新**: 2025-11-16
**维护者**: Claude AI Assistant
