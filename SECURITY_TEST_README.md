# 价格篡改安全测试指南

本指南提供了测试价格篡改检测功能的完整流程。

## 测试目的

验证系统能够：
1. ✅ 允许管理员上架的合法0元商品正常购买
2. ❌ 拦截将正价商品篡改成0元的攻击
3. 🚨 触发相应的安全警报

## 准备工作

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 创建测试商品

在数据库中创建测试商品：

```bash
sqlite3 prisma/dev.db << 'EOF'
INSERT OR REPLACE INTO Product (id, title, description, price, status, createdAt, updatedAt)
VALUES
  ('test-100', '测试商品-100元', '用于价格篡改测试', 100, 'active', datetime('now'), datetime('now')),
  ('test-50', '测试商品-50元', '用于价格篡改测试', 50, 'active', datetime('now'), datetime('now')),
  ('test-free', '免费测试商品', '合法的0元商品', 0, 'active', datetime('now'), datetime('now'));
EOF
```

或者通过管理后台手动创建这些商品。

## 测试方法

### 方法1: 自动化测试脚本 (推荐)

使用 TypeScript 完整测试脚本：

```bash
npx tsx scripts/test-price-security.ts
```

**特点**：
- ✅ 自动创建和清理测试数据
- ✅ 完整的测试场景覆盖
- ✅ 详细的测试报告
- ✅ 自动验证结果

### 方法2: 交互式 Shell 脚本

使用 curl 命令进行交互式测试：

```bash
./scripts/test-examples.sh
```

**特点**：
- ✅ 分步执行，便于观察
- ✅ 使用 curl 直接调用 API
- ✅ 可以手动修改参数
- ✅ 适合调试和学习

### 方法3: Node.js 测试脚本

```bash
node scripts/test-price-manipulation.js
```

**特点**：
- ✅ 多场景测试
- ✅ 彩色输出
- ✅ 详细说明

### 方法4: 手动 curl 测试

#### 测试1: 正常购买
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "test-100", "quantity": 1, "price": 100}]
  }'
```

**期望结果**: 状态码 201，订单创建成功

---

#### 测试2: 购买合法0元商品
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "test-free", "quantity": 1, "price": 0}]
  }'
```

**期望结果**: 状态码 201，订单创建成功，**不触发安全警报**

---

#### 测试3: 价格篡改攻击 (100元改成0元)
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "test-100", "quantity": 1, "price": 0}]
  }'
```

**期望结果**: 状态码 400，错误信息 "商品价格已变更"

**说明**: 在价格验证阶段就被拦截，因为商品实际价格是100元，但请求价格是0元

---

#### 测试4: 价格篡改攻击 (极小价格)
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "test-50", "quantity": 1, "price": 0.001}]
  }'
```

**期望结果**: 状态码 400

---

#### 测试5: 负数价格攻击
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "test-100", "quantity": 1, "price": -50}]
  }'
```

**期望结果**: 状态码 400，Zod 验证错误 (price 必须是正数)

## 测试场景说明

### 场景矩阵

| 场景 | 商品实际价格 | 请求价格 | 是否攻击 | 期望结果 |
|------|-------------|---------|---------|---------|
| 1 | 100元 | 100元 | ❌ | ✅ 创建成功 |
| 2 | 0元 | 0元 | ❌ | ✅ 创建成功 |
| 3 | 100元 | 0元 | ✅ | ❌ 拦截 (价格验证) |
| 4 | 50元 | 0.001元 | ✅ | ❌ 拦截 (价格验证) |
| 5 | 100元 | -50元 | ✅ | ❌ 拦截 (Zod验证) |
| 6 | 多商品正常 | 正确 | ❌ | ✅ 创建成功 |

### 安全检查层级

系统有多层安全检查：

```
1. Zod Schema 验证
   └─> 拦截：负数价格、无效数据格式

2. 商品存在性检查
   └─> 拦截：不存在的商品、已下架的商品

3. 价格匹配验证 (route.ts:127-133)
   └─> 拦截：客户端价格 ≠ 数据库价格
   └─> 防止：前端篡改价格

4. 价格篡改检测 (route.ts:234) ⭐ 本次修复
   └─> 区分：合法0元商品 vs 价格篡改
   └─> 逻辑：if (原价 > 0 && 折后价 = 0) → 拦截
```

## 查看安全警报

### 方法1: 命令行查询

```bash
sqlite3 prisma/dev.db \
  'SELECT type, severity, description, createdAt
   FROM SecurityAlert
   ORDER BY createdAt DESC
   LIMIT 10;'
```

### 方法2: 管理后台

访问: http://localhost:3000/backendmanager/security-alerts

可以查看：
- 所有安全警报
- 警报类型和严重程度
- 详细元数据
- 处理状态

## 关键修复点

### 修复前 (有缺陷)

```typescript
if (totalAmount <= 0.01) {
  // 问题：拦截所有0元订单，包括合法的免费商品
  触发警报 ZERO_AMOUNT_ORDER
}
```

### 修复后 (正确)

```typescript
if (originalAmount > 0.01 && totalAmount <= 0.01) {
  // 只拦截价格篡改：原价 > 0 但折后价 = 0
  触发警报 PRICE_MANIPULATION
}
// 如果原价 = 0，说明是合法0元商品，允许通过
```

## 清理测试数据

测试完成后，删除测试商品：

```bash
sqlite3 prisma/dev.db << 'EOF'
DELETE FROM OrderItem WHERE productId IN ('test-100', 'test-50', 'test-free');
DELETE FROM Order WHERE orderNumber LIKE 'TEST-%';
DELETE FROM Product WHERE id IN ('test-100', 'test-50', 'test-free');
DELETE FROM SecurityAlert WHERE userAgent = 'security-test-script';
EOF
```

或使用自动化脚本会自动清理。

## 故障排查

### 问题1: "商品不存在"

**原因**: 未创建测试商品

**解决**: 运行准备工作中的创建商品命令

---

### 问题2: 所有请求都返回 401

**原因**: API 可能需要认证

**解决**: 这是匿名订单 API，不应该需要认证。检查 `requireAuth` 的调用

---

### 问题3: 安全警报没有触发

**原因**:
1. 价格验证在安全检查之前就拦截了请求
2. 这是正常的，说明多层防护在工作

**说明**:
- 价格篡改会先被价格验证拦截 (route.ts:128)
- 只有通过价格验证但金额异常的情况才会到达安全检查层
- 要测试安全检查层，需要确保商品价格和请求价格一致但使用了异常折扣

---

### 问题4: TypeScript 脚本报错

**原因**: 可能缺少 tsx 或类型定义

**解决**:
```bash
npm install -D tsx @types/node
```

## 最佳实践

1. **定期运行测试**: 每次修改订单相关代码后都应运行完整测试
2. **监控安全警报**: 定期检查生产环境的安全警报
3. **保持多层防护**: 不要只依赖一层安全检查
4. **记录所有异常**: 即使拦截了攻击，也要记录日志

## 相关文件

- `app/api/orders/route.ts`: 订单创建 API (包含安全检查)
- `prisma/schema.prisma`: 数据库 Schema (SecurityAlert 模型)
- `app/backendmanager/security-alerts/page.tsx`: 安全警报管理页面
- `scripts/test-price-security.ts`: 自动化测试脚本
- `scripts/test-examples.sh`: 交互式测试脚本
