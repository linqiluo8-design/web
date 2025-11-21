# Sentry 错误监控配置指南

Sentry 是一个强大的错误追踪和性能监控平台，可以帮助你快速发现和修复生产环境中的问题。

---

## 📋 准备工作

### 1. 注册 Sentry 账号
访问 https://sentry.io/ 注册免费账号（支持每月最多 5000 个事件）

### 2. 创建项目
1. 登录 Sentry
2. 点击 "Create Project"
3. 选择 "Next.js" 作为平台
4. 记录下 **DSN**（Data Source Name），类似：
   ```
   https://xxx@o123456.ingest.sentry.io/7654321
   ```

---

## 🚀 安装和配置

### 步骤 1: 安装依赖

```bash
npm install --save @sentry/nextjs
```

或使用 Sentry CLI 自动配置：

```bash
npx @sentry/wizard@latest -i nextjs
```

### 步骤 2: 添加环境变量

在 `.env.local` 中添加（不要提交到 Git）：

```bash
# Sentry 配置
NEXT_PUBLIC_SENTRY_DSN="https://xxx@o123456.ingest.sentry.io/7654321"
SENTRY_AUTH_TOKEN="your_auth_token_here"
SENTRY_ORG="your_org_name"
SENTRY_PROJECT="your_project_name"

# 可选：环境标识
SENTRY_ENVIRONMENT="production"  # 或 development、staging
```

### 步骤 3: 创建 Sentry 配置文件

#### `sentry.client.config.ts`
```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 性能监控采样率（0.0 - 1.0）
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 开发环境调试
  debug: process.env.NODE_ENV === 'development',

  // 环境标识
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

  // 自动捕获 Console 错误
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Session Replay 采样率
  replaysSessionSampleRate: 0.1, // 10% 的会话
  replaysOnErrorSampleRate: 1.0, // 100% 错误时的会话

  // 过滤敏感信息
  beforeSend(event, hint) {
    // 移除敏感数据
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers
    }

    // 过滤特定错误
    if (event.exception) {
      const error = hint.originalException as Error
      if (error?.message?.includes('ResizeObserver')) {
        // 忽略 ResizeObserver 相关错误（浏览器兼容性问题）
        return null
      }
    }

    return event
  },
})
```

#### `sentry.server.config.ts`
```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: process.env.NODE_ENV === 'development',
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

  // 服务器端集成
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],

  // 过滤敏感信息
  beforeSend(event) {
    // 移除环境变量
    if (event.contexts?.runtime?.name === 'node') {
      delete event.contexts.runtime
    }

    // 移除请求头中的敏感信息
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }

    return event
  },
})
```

#### `sentry.edge.config.ts`
```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
})
```

### 步骤 4: 更新 `next.config.ts`

```typescript
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  // ... 现有配置
}

const sentryWebpackPluginOptions = {
  // 构建时上传 Source Maps
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // 只在生产构建时上传
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
}

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig
```

---

## 🔧 在代码中使用

### 手动捕获错误

```typescript
import * as Sentry from "@sentry/nextjs"

try {
  // 你的代码
  riskyOperation()
} catch (error) {
  // 捕获并发送到 Sentry
  Sentry.captureException(error, {
    tags: {
      section: 'payment',
    },
    extra: {
      orderId: '12345',
      userId: 'user-abc',
    },
  })
}
```

### 添加用户上下文

```typescript
import * as Sentry from "@sentry/nextjs"

// 在用户登录后设置
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.name,
})

// 在用户登出后清除
Sentry.setUser(null)
```

### 添加面包屑（Breadcrumbs）

```typescript
Sentry.addBreadcrumb({
  category: 'payment',
  message: '用户开始支付流程',
  level: 'info',
  data: {
    amount: 99.99,
    method: 'alipay',
  },
})
```

### 性能监控

```typescript
import * as Sentry from "@sentry/nextjs"

// 手动创建事务
const transaction = Sentry.startTransaction({
  op: 'payment',
  name: '处理支付请求',
})

try {
  // 你的代码
  await processPayment()
  transaction.setStatus('ok')
} catch (error) {
  transaction.setStatus('error')
  throw error
} finally {
  transaction.finish()
}
```

---

## 📊 监控关键路径

### API 路由错误捕获

在 API 路由中使用（示例）：

```typescript
// app/api/payment/create/route.ts
import * as Sentry from "@sentry/nextjs"

export async function POST(request: Request) {
  return withRateLimit(request, RateLimitPresets.ORDER, async () => {
    try {
      // 现有逻辑
      // ...
    } catch (error) {
      // 捕获错误并发送到 Sentry
      Sentry.captureException(error, {
        tags: {
          api: 'payment-create',
        },
        extra: {
          url: request.url,
          method: request.method,
        },
      })

      return NextResponse.json({ error: "创建支付失败" }, { status: 500 })
    }
  })
}
```

### 全局错误边界（React）

```typescript
// app/error.tsx
'use client'

import * as Sentry from "@sentry/nextjs"
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 自动发送到 Sentry
    Sentry.captureException(error)
  }, [error])

  return (
    <div>
      <h2>出错了！</h2>
      <button onClick={() => reset()}>重试</button>
    </div>
  )
}
```

---

## 🎯 最佳实践

### 1. 过滤噪音
```typescript
ignoreErrors: [
  // 忽略浏览器扩展错误
  /chrome-extension/,
  /moz-extension/,
  // 忽略已知的无害错误
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection captured',
]
```

### 2. 设置合理的采样率
- 开发环境：100%（`tracesSampleRate: 1.0`）
- 生产环境：10-20%（`tracesSampleRate: 0.1`）

### 3. 使用标签分类
```typescript
Sentry.setTag('payment_method', 'alipay')
Sentry.setTag('user_type', 'premium')
```

### 4. 添加上下文信息
```typescript
Sentry.setContext('order', {
  orderId: '12345',
  amount: 99.99,
  status: 'pending',
})
```

### 5. 保护敏感信息
- 永远不要发送密码、Token、信用卡信息
- 使用 `beforeSend` 过滤敏感数据
- 删除请求头中的 Authorization 和 Cookie

---

## 🔒 安全注意事项

1. **不要在前端暴露 Auth Token**
   - 只在构建时使用（通过环境变量）
   - 不要将 `SENTRY_AUTH_TOKEN` 添加到 `NEXT_PUBLIC_` 前缀

2. **过滤敏感信息**
   ```typescript
   beforeSend(event) {
     // 移除密码字段
     if (event.request?.data?.password) {
       event.request.data.password = '[Filtered]'
     }
     return event
   }
   ```

3. **限制 Source Maps**
   - 生产环境隐藏 Source Maps（`hideSourceMaps: true`）
   - 只上传到 Sentry，不公开访问

---

## 📈 监控指标

### 关键指标
- **Error Rate**: 错误率
- **APDEX Score**: 用户满意度
- **Response Time**: 响应时间
- **Throughput**: 吞吐量

### 设置告警
1. 进入 Sentry 项目设置
2. 配置 "Alerts"
3. 创建规则：
   - 错误数超过 100 次/小时
   - 新错误出现
   - 性能下降 50%

---

## 🧪 测试 Sentry 配置

### 测试错误捕获
```typescript
// 在页面中添加测试按钮
<button onClick={() => {
  throw new Error('Sentry 测试错误')
}}>
  触发测试错误
</button>
```

### 测试性能监控
```typescript
import * as Sentry from "@sentry/nextjs"

// 测试慢查询
const transaction = Sentry.startTransaction({
  op: 'test',
  name: '测试慢操作',
})

await new Promise(resolve => setTimeout(resolve, 3000))
transaction.finish()
```

### 验证配置
1. 触发测试错误
2. 等待 1-2 分钟
3. 在 Sentry Dashboard 检查是否收到错误报告

---

## 💰 费用优化

### 免费版限制
- 每月 5,000 个错误事件
- 每月 10,000 个性能事件
- 保留 30 天

### 优化技巧
1. **降低采样率**: 生产环境使用 10%
2. **过滤噪音**: 使用 `ignoreErrors` 过滤已知错误
3. **合并相似错误**: 使用 `fingerprint` 分组错误
4. **限制上下文大小**: 避免发送大量数据

---

## 📚 更多资源

- 官方文档: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Next.js 集成指南: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- 性能监控: https://docs.sentry.io/product/performance/
- Session Replay: https://docs.sentry.io/product/session-replay/

---

**配置完成后，你将获得**:
✅ 实时错误追踪
✅ 性能监控和分析
✅ 用户会话回放
✅ 自动问题分组
✅ Email/Slack 告警
✅ 详细的错误堆栈信息

**预计配置时间**: 15-30 分钟
