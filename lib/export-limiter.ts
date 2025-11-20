import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/options"

/**
 * 导出限制结果
 */
export interface ExportLimitResult {
  allowed: boolean           // 是否允许导出
  reason?: string            // 不允许的原因
  paidOrderCount?: number    // 已支付订单数
  usedExports?: number       // 今天已使用的导出次数
  remainingExports?: number  // 剩余可导出次数
  totalAllowed?: number      // 总共允许的导出次数
}

/**
 * 检查订单导出限制（针对匿名用户）
 *
 * 规则：
 * - 管理员和团队成员：无限制
 * - 匿名用户：每个已支付订单最多可导出2次
 *   例如：1个已支付订单 → 最多导出2次
 *         2个已支付订单 → 最多导出4次
 * - 非已支付订单（已取消、待支付等）不允许匿名用户导出
 *
 * @param visitorId 访客ID（用于识别匿名用户）
 * @param orderNumbers 用户的订单号列表（从 localStorage 读取）
 * @returns 导出限制结果
 */
export async function checkOrderExportLimit(
  visitorId?: string,
  orderNumbers?: string[]
): Promise<ExportLimitResult> {
  try {
    // 检查是否为已登录用户
    const session = await getServerSession(authOptions)

    // 管理员和拥有权限的团队成员不受限制
    if (session?.user) {
      // 如果是管理员，不限制
      if (session.user.role === 'ADMIN') {
        return { allowed: true }
      }

      // 检查是否有订单管理权限
      const permissions = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/permissions`, {
        headers: {
          cookie: `next-auth.session-token=${session.user.id}`
        }
      }).then(res => res.json()).catch(() => ({ permissions: {} }))

      if (permissions.permissions?.ORDERS === 'READ' || permissions.permissions?.ORDERS === 'WRITE') {
        return { allowed: true }
      }
    }

    // 匿名用户需要提供 visitorId
    if (!visitorId) {
      return {
        allowed: false,
        reason: '无法识别访客身份'
      }
    }

    // 匿名用户需要提供订单号列表
    if (!orderNumbers || orderNumbers.length === 0) {
      return {
        allowed: false,
        reason: '只有已支付订单支持导出，非已支付订单不支持导出哦',
        paidOrderCount: 0,
        usedExports: 0,
        remainingExports: 0,
        totalAllowed: 0
      }
    }

    // 1. 查询用户的订单中有多少是已支付的
    const paidOrderCount = await prisma.order.count({
      where: {
        orderNumber: {
          in: orderNumbers
        },
        status: 'paid' // 只计算已支付订单
      }
    })

    // 如果没有已支付订单，不允许导出
    if (paidOrderCount === 0) {
      return {
        allowed: false,
        reason: '只有已支付订单支持导出，非已支付订单不支持导出哦',
        paidOrderCount: 0,
        usedExports: 0,
        remainingExports: 0,
        totalAllowed: 0
      }
    }

    // 2. 计算允许的总导出次数 = 已支付订单数 × 2（每个订单2次）
    const totalAllowed = paidOrderCount * 2

    // 3. 查询今天已经导出的次数
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const exportRecord = await prisma.orderExportRecord.findFirst({
      where: {
        visitorId,
        exportDate: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    const usedExports = exportRecord?.count || 0
    const remainingExports = Math.max(0, totalAllowed - usedExports)

    // 4. 判断是否超过限制
    if (usedExports >= totalAllowed) {
      return {
        allowed: false,
        reason: '抱歉，只支持每个已支付订单导出2次，请妥善保管好订单信息，谢谢',
        paidOrderCount,
        usedExports,
        remainingExports: 0,
        totalAllowed
      }
    }

    // 5. 允许导出
    return {
      allowed: true,
      paidOrderCount,
      usedExports,
      remainingExports,
      totalAllowed
    }
  } catch (error) {
    console.error('检查导出限制失败:', error)
    return {
      allowed: false,
      reason: '检查导出限制时发生错误'
    }
  }
}

/**
 * 记录订单导出操作
 *
 * @param visitorId 访客ID
 * @param userId 用户ID（可选）
 */
export async function recordOrderExport(
  visitorId?: string,
  userId?: string
): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 已登录用户不记录（不限制）
  if (userId) {
    return
  }

  // 匿名用户需要 visitorId
  if (!visitorId) {
    throw new Error('匿名用户必须提供visitorId')
  }

  // 查找今天的导出记录
  const existingRecord = await prisma.orderExportRecord.findFirst({
    where: {
      visitorId,
      exportDate: today
    }
  })

  if (existingRecord) {
    // 更新计数
    await prisma.orderExportRecord.update({
      where: { id: existingRecord.id },
      data: {
        count: { increment: 1 }
      }
    })
  } else {
    // 创建新记录
    await prisma.orderExportRecord.create({
      data: {
        visitorId,
        exportDate: today,
        count: 1
      }
    })
  }
}

/**
 * 回滚导出记录（当导出失败时调用）
 *
 * @param visitorId 访客ID
 */
export async function rollbackExportRecord(visitorId?: string): Promise<void> {
  if (!visitorId) {
    return
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 查找今天的导出记录
  const existingRecord = await prisma.orderExportRecord.findFirst({
    where: {
      visitorId,
      exportDate: today
    }
  })

  if (existingRecord && existingRecord.count > 0) {
    // 减少计数
    await prisma.orderExportRecord.update({
      where: { id: existingRecord.id },
      data: {
        count: { decrement: 1 }
      }
    })
  }
}
