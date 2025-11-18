# 📋 模拟支付切换到真实支付 - 完整指南

## 一、概述

当前系统已经实现了完整的支付框架，支持**支付宝、微信支付、PayPal**三种支付方式，并且支持**模拟支付**和**真实支付**两种模式的动态切换。

---

## 二、需要准备的资料

### 1. 支付宝（推荐国内用户）
- **支付宝应用 APPID**（在支付宝开放平台创建应用后获取）
- **应用私钥**（RSA2048 私钥）
- **支付宝公钥**（从支付宝平台获取）
- **商户PID**（可选）

**申请地址**：https://open.alipay.com/

### 2. 微信支付
- **微信 AppID**（公众号/小程序/APP的AppID）
- **商户号 MchID**
- **API密钥 APIv3 Key**
- **API证书序列号**
- **商户证书文件**（可选，用于退款等操作）

**申请地址**：https://pay.weixin.qq.com/

### 3. PayPal（推荐国际用户）
- **Client ID**
- **Client Secret**
- **选择环境**：Sandbox（测试）或 Live（生产）

**申请地址**：https://developer.paypal.com/

---

## 三、切换步骤（共5步）

### ✅ 步骤1：配置环境变量

创建或修改 `.env` 文件（如果还没有的话）：

```bash
# 数据库配置（必须）
DATABASE_URL="your_database_url"

# === 支付宝配置 ===
ALIPAY_APP_ID="2021001234567890"
ALIPAY_PRIVATE_KEY="MIIEvQIBADANBgkqhkiG9w0BAQEF..."  # 完整的私钥字符串
ALIPAY_PUBLIC_KEY="MIIBIjANBgkqhkiG9w0BAQEFAAO..."   # 支付宝公钥

# === 微信支付配置 ===
WECHAT_APP_ID="wx1234567890abcdef"
WECHAT_MCH_ID="1234567890"
WECHAT_API_KEY="your_32_character_api_key_here_xxx"
WECHAT_SERIAL_NO="1234567890ABCDEF1234567890ABCDEF12345678"

# === PayPal配置 ===
PAYPAL_CLIENT_ID="AYourPayPalClientID123456789"
PAYPAL_CLIENT_SECRET="EYourPayPalClientSecret123456"
PAYPAL_MODE="live"  # 生产环境用 "live"，测试用 "sandbox"

# === 网站域名（用于回调地址） ===
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"
```

**注意事项**：
- 私钥需要去掉 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----` 以及所有换行符，或者保留完整格式都可以（代码会自动处理）
- 生产环境务必使用 HTTPS 域名，否则支付回调会失败

---

### ✅ 步骤2：更新数据库配置

你需要在数据库的 `SystemConfig` 表中添加/修改以下配置：

```sql
-- 1. 切换支付模式为真实支付
UPDATE "SystemConfig"
SET value = 'real'
WHERE key = 'payment_mode';

-- 如果记录不存在，则插入
INSERT INTO "SystemConfig" (id, key, value, type, category, description)
VALUES (
  gen_random_uuid()::text,  -- 或使用 cuid()
  'payment_mode',
  'real',
  'string',
  'payment',
  '支付模式：mock=模拟支付，real=真实支付'
);

-- 2. 启用需要的支付方式
UPDATE "SystemConfig" SET value = 'true' WHERE key = 'payment_alipay_enabled';
UPDATE "SystemConfig" SET value = 'true' WHERE key = 'payment_wechat_enabled';
UPDATE "SystemConfig" SET value = 'false' WHERE key = 'payment_paypal_enabled';  -- 不用的可以设为false
```

**或者使用 Prisma Studio**：
```bash
npx prisma studio
```
然后在浏览器中修改 `SystemConfig` 表的数据。

---

### ✅ 步骤3：配置支付回调URL

你需要在各个支付平台的后台配置回调地址：

#### 支付宝回调配置

登录支付宝开放平台 → 进入应用 → 接口加签方式 → 配置：

```
异步通知地址：https://yourdomain.com/api/payment/callback/alipay
同步跳转地址：https://yourdomain.com/api/payment/callback/alipay
```

#### 微信支付回调配置

登录微信商户平台 → 产品中心 → 开发配置 → 设置：

```
支付通知URL：https://yourdomain.com/api/payment/callback/wechat
```

#### PayPal回调配置

PayPal的回调URL在代码中动态传递，不需要在平台配置。但需要在应用设置中添加：

```
Return URL：https://yourdomain.com/payment/success
Cancel URL：https://yourdomain.com/payment/[orderId]
```

---

### ✅ 步骤4：修改代码（检查回调URL）

检查以下文件，确保回调URL配置正确：

**1. 支付宝配置** - `lib/payment/alipay.ts`

检查第30-31行左右的回调URL是否使用了正确的域名：

```typescript
notify_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/callback/alipay`,
return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/callback/alipay`,
```

**2. 微信支付配置** - `lib/payment/wechat.ts`

检查第40行左右：

```typescript
notify_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/callback/wechat`,
```

**3. PayPal配置** - `lib/payment/paypal.ts`

检查第45-50行左右：

```typescript
return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/callback/paypal?orderId=${orderId}`,
cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/${orderId}`,
```

---

### ✅ 步骤5：部署和测试

#### 5.1 部署到生产环境

```bash
# 1. 构建项目
npm run build

# 2. 启动生产服务
npm run start

# 或使用 PM2
pm2 start npm --name "your-app" -- start
```

#### 5.2 测试流程

**测试支付宝支付**：
1. 创建一个测试订单
2. 选择支付宝支付
3. 跳转到支付宝页面（真实环境）
4. 使用支付宝账号完成支付
5. 验证是否跳转回成功页面
6. 检查订单状态是否更新为"已支付"

**测试微信支付**：
1. 创建测试订单
2. 选择微信支付
3. 扫描二维码或H5支付
4. 完成支付后等待回调
5. 验证订单状态

**测试PayPal支付**：
1. 创建测试订单
2. 选择PayPal支付
3. 登录PayPal账户完成支付
4. 验证订单状态

---

## 四、需要修改的文件清单

根据你的具体情况，**可能需要修改**以下文件：

| 文件路径 | 是否必须修改 | 修改内容 |
|---------|-------------|---------|
| `.env` | ✅ **必须** | 添加支付平台的商户信息 |
| `lib/payment/alipay.ts` | ⚠️ 可能需要 | 检查回调URL是否正确 |
| `lib/payment/wechat.ts` | ⚠️ 可能需要 | 检查回调URL是否正确 |
| `lib/payment/paypal.ts` | ⚠️ 可能需要 | 检查回调URL是否正确 |
| `app/api/payment/create/route.ts` | ❌ 无需修改 | 已支持动态切换 |
| 数据库 `SystemConfig` 表 | ✅ **必须** | 将 `payment_mode` 改为 `real` |

**大部分情况下，你只需要修改2个地方：**
1. ✅ `.env` 文件（添加商户信息）
2. ✅ 数据库 `SystemConfig` 表（切换支付模式）

---

## 五、常见问题

### Q1: 支付回调没有收到怎么办？

**可能原因**：
1. 服务器防火墙拦截了回调请求
2. 域名没有配置HTTPS
3. 回调URL配置错误

**解决方法**：
- 确保服务器80/443端口开放
- 使用 HTTPS 域名（HTTP可能被拦截）
- 在支付平台后台检查回调URL配置
- 查看服务器日志，看是否收到回调请求

### Q2: 如何在测试环境先测试？

**建议使用沙箱环境**：
- 支付宝：使用支付宝沙箱环境（https://openhome.alipay.com/dev/workspace）
- 微信：申请微信支付沙箱环境
- PayPal：使用 `PAYPAL_MODE=sandbox`

将环境变量中的配置改为沙箱环境的配置即可。

### Q3: 能否同时支持模拟和真实支付？

**不能同时支持**，但可以通过修改数据库配置快速切换：
```sql
-- 切换为模拟支付
UPDATE "SystemConfig" SET value = 'mock' WHERE key = 'payment_mode';

-- 切换为真实支付
UPDATE "SystemConfig" SET value = 'real' WHERE key = 'payment_mode';
```

无需重启服务器，配置会立即生效（代码会动态读取）。

### Q4: 如何验证配置是否正确？

1. 启动项目后查看日志，确保没有配置错误
2. 创建测试订单，检查是否能正常跳转到支付页面
3. 查看支付平台的商户后台，看是否有订单记录

---

## 六、安全建议

1. **敏感信息保护**：
   - 不要将 `.env` 文件提交到 Git
   - 使用环境变量或加密存储私钥
   - 定期更换 API 密钥

2. **HTTPS必须**：
   - 生产环境务必使用 HTTPS
   - 申请SSL证书（可用 Let's Encrypt 免费证书）

3. **签名验证**：
   - 代码已实现签名验证（在回调API中）
   - 不要跳过签名验证步骤

4. **日志记录**：
   - 保留支付日志以便排查问题
   - 不要在日志中记录完整的私钥

---

## 七、相关文件说明

### 核心支付库（3个文件）
1. `/lib/payment/alipay.ts` - 支付宝支付实现
2. `/lib/payment/wechat.ts` - 微信支付实现
3. `/lib/payment/paypal.ts` - PayPal支付实现

### 支付API路由（10个文件）
4. `/app/api/payment/create/route.ts` - 创建订单支付
5. `/app/api/payment/mock/route.ts` - 模拟支付页面
6. `/app/api/payment/create-membership/route.ts` - 创建会员支付
7. `/app/api/payment/mock-membership/route.ts` - 模拟会员支付页面
8. `/app/api/payment/callback/route.ts` - 通用支付回调
9. `/app/api/payment/membership-callback/route.ts` - 会员支付回调
10. `/app/api/payment/callback/alipay/route.ts` - 支付宝回调
11. `/app/api/payment/callback/wechat/route.ts` - 微信回调
12. `/app/api/payment/callback/paypal/route.ts` - PayPal回调
13. `/app/api/system-config/route.ts` - 系统配置

### 支付页面组件（4个文件）
14. `/app/payment/[orderId]/page.tsx` - 订单支付页面
15. `/app/payment/success/page.tsx` - 订单支付成功页面
16. `/app/payment/membership/[id]/page.tsx` - 会员支付页面
17. `/app/membership/success/page.tsx` - 会员支付成功页面

---

## 八、总结

**最简化的切换流程**（5分钟完成）：

```bash
# 1. 创建 .env 文件并填写商户信息
ALIPAY_APP_ID="..."
ALIPAY_PRIVATE_KEY="..."
# ... 其他配置

# 2. 修改数据库配置
UPDATE "SystemConfig" SET value = 'real' WHERE key = 'payment_mode';

# 3. 重启服务
npm run build && npm run start

# 4. 测试支付流程
# 创建订单 → 选择支付方式 → 完成支付 → 验证订单状态
```

**就这么简单！** 系统已经实现了完整的支付框架，你只需要提供商户信息并切换配置即可。

---

## 九、参考文档

- [支付配置设计文档](./payment-configuration-design.md)
- [支付宝开放平台文档](https://opendocs.alipay.com/open/270)
- [微信支付开发文档](https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml)
- [PayPal开发者文档](https://developer.paypal.com/docs/api/overview/)

---

**文档版本**：v1.0
**创建日期**：2025-11-18
**最后更新**：2025-11-18
**作者**：Claude AI Assistant
**状态**：已完成
