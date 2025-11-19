import { prisma } from "@/lib/prisma"

/**
 * 日志级别
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/**
 * 日志分类
 */
export type LogCategory = 'api' | 'auth' | 'payment' | 'system' | 'security' | 'database'

/**
 * 日志记录参数
 */
export interface LogParams {
  level: LogLevel
  category: LogCategory
  action: string
  message: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  path?: string
  method?: string
  statusCode?: number
  duration?: number
  metadata?: Record<string, any>
  error?: Error | string
}

/**
 * 系统日志记录工具
 *
 * @example
 * // 记录 API 调用
 * await logger.info({
 *   category: 'api',
 *   action: 'order_created',
 *   message: '用户创建订单',
 *   userId: 'user123',
 *   path: '/api/orders',
 *   method: 'POST',
 *   statusCode: 200,
 *   duration: 156
 * })
 *
 * // 记录错误
 * await logger.error({
 *   category: 'payment',
 *   action: 'payment_failed',
 *   message: '支付失败',
 *   error: err,
 *   metadata: { orderId: 'xxx' }
 * })
 */
export class Logger {
  /**
   * 记录日志
   */
  private async log(params: LogParams): Promise<void> {
    try {
      const {
        level,
        category,
        action,
        message,
        userId,
        ipAddress,
        userAgent,
        path,
        method,
        statusCode,
        duration,
        metadata,
        error
      } = params

      // 构建错误信息
      let errorString: string | undefined
      if (error) {
        if (error instanceof Error) {
          errorString = `${error.message}\n${error.stack || ''}`
        } else {
          errorString = String(error)
        }
      }

      // 写入数据库
      await prisma.systemLog.create({
        data: {
          level,
          category,
          action,
          message,
          userId,
          ipAddress,
          userAgent,
          path,
          method,
          statusCode,
          duration,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
          error: errorString
        }
      })

      // 同时输出到控制台（开发环境）
      if (process.env.NODE_ENV === 'development') {
        const prefix = `[${level.toUpperCase()}] [${category}] [${action}]`
        const logMessage = `${prefix} ${message}`

        switch (level) {
          case 'error':
            console.error(logMessage, error || '')
            break
          case 'warn':
            console.warn(logMessage)
            break
          case 'debug':
            console.debug(logMessage, metadata || '')
            break
          default:
            console.log(logMessage)
        }
      }
    } catch (err) {
      // 日志记录失败，输出到控制台
      console.error('Failed to write log:', err)
    }
  }

  /**
   * 记录 INFO 级别日志
   */
  async info(params: Omit<LogParams, 'level'>): Promise<void> {
    await this.log({ ...params, level: 'info' })
  }

  /**
   * 记录 WARN 级别日志
   */
  async warn(params: Omit<LogParams, 'level'>): Promise<void> {
    await this.log({ ...params, level: 'warn' })
  }

  /**
   * 记录 ERROR 级别日志
   */
  async error(params: Omit<LogParams, 'level'>): Promise<void> {
    await this.log({ ...params, level: 'error' })
  }

  /**
   * 记录 DEBUG 级别日志
   */
  async debug(params: Omit<LogParams, 'level'>): Promise<void> {
    await this.log({ ...params, level: 'debug' })
  }
}

// 导出单例
export const logger = new Logger()

/**
 * 从 Request 对象提取日志相关信息
 */
export function extractRequestInfo(req: Request) {
  const url = new URL(req.url)

  return {
    path: url.pathname,
    method: req.method,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
    userAgent: req.headers.get('user-agent') || undefined
  }
}
