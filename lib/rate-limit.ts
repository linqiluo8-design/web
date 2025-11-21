/**
 * 速率限制工具
 * 防止暴力破解和 API 滥用
 *
 * 使用内存存储，适合单实例部署
 * 生产环境建议升级到 Redis 基础的方案（如 @upstash/ratelimit）
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// 内存存储（简单实现，单实例有效）
const store = new Map<string, RateLimitEntry>()

// 清理过期记录（每分钟执行一次）
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 60 * 1000)

export interface RateLimitConfig {
  /** 限制的请求数量 */
  max: number
  /** 时间窗口（秒） */
  windowSeconds: number
  /** 标识符前缀（用于区分不同类型的限制） */
  prefix?: string
}

export interface RateLimitResult {
  /** 是否允许请求 */
  success: boolean
  /** 剩余请求数 */
  remaining: number
  /** 限制重置时间（Unix 时间戳） */
  resetAt: number
  /** 是否达到限制 */
  limited: boolean
}

/**
 * 基于 IP 的速率限制
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = config.prefix ? `${config.prefix}:${identifier}` : identifier
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  let entry = store.get(key)

  // 如果记录不存在或已过期，创建新记录
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    }
    store.set(key, entry)
  }

  // 增加计数
  entry.count++

  const limited = entry.count > config.max
  const remaining = Math.max(0, config.max - entry.count)

  return {
    success: !limited,
    remaining,
    resetAt: entry.resetAt,
    limited,
  }
}

/**
 * 从请求中获取 IP 地址
 */
export function getClientIp(req: Request): string {
  // 尝试从各种头部获取真实 IP
  const headers = req.headers

  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfConnectingIp = headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // 如果都没有，返回一个占位符
  // 在本地开发环境可能无法获取真实 IP
  return 'unknown'
}

/**
 * 预设的速率限制配置
 */
export const RateLimitPresets = {
  /** 登录限制：每分钟最多 5 次 */
  LOGIN: {
    max: 5,
    windowSeconds: 60,
    prefix: 'login',
  },
  /** 注册限制：每小时最多 3 次 */
  REGISTER: {
    max: 3,
    windowSeconds: 3600,
    prefix: 'register',
  },
  /** 聊天消息限制：每分钟最多 20 条 */
  CHAT: {
    max: 20,
    windowSeconds: 60,
    prefix: 'chat',
  },
  /** 订单创建限制：每分钟最多 10 次 */
  ORDER: {
    max: 10,
    windowSeconds: 60,
    prefix: 'order',
  },
  /** API 通用限制：每分钟最多 60 次 */
  API: {
    max: 60,
    windowSeconds: 60,
    prefix: 'api',
  },
  /** 图片上传限制：每小时最多 20 次 */
  UPLOAD: {
    max: 20,
    windowSeconds: 3600,
    prefix: 'upload',
  },
} as const

/**
 * Rate Limit 中间件工具
 * 用于 API 路由
 */
export async function withRateLimit(
  req: Request,
  config: RateLimitConfig,
  handler: () => Promise<Response>
): Promise<Response> {
  const ip = getClientIp(req)
  const result = await rateLimit(ip, config)

  // 添加速率限制响应头
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', config.max.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', result.resetAt.toString())

  if (result.limited) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
    headers.set('Retry-After', retryAfter.toString())

    return new Response(
      JSON.stringify({
        error: '请求过于频繁，请稍后再试',
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(headers.entries()),
        },
      }
    )
  }

  // 执行实际的处理函数
  const response = await handler()

  // 将速率限制头添加到响应
  for (const [key, value] of headers.entries()) {
    response.headers.set(key, value)
  }

  return response
}
