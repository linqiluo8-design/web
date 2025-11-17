# 订单系统安全设计文档

## 核心安全原则

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
