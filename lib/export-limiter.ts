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
 * - 匿名用户：每个已支付订单允许全天导出 n+1 次
 *   例如：1个已支付订单 → 最多导出2次
 *         2个已支付订单 → 最多导出3次
 * - 非已支付订单不允许匿名用户导出
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
        reason: '您还没有订单，无法导出订单数据',
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
        reason: '您还没有已支付的订单，无法导出订单数据',
        paidOrderCount: 0,
        usedExports: 0,
        remainingExports: 0,
        totalAllowed: 0
      }
    }

    // 2. 计算今天允许的总导出次数 = 已支付订单数 + 1
    const totalAllowed = paidOrderCount + 1

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
        reason: `您今天的导出次数已用完（${usedExports}/${totalAllowed}次）。每个已支付订单允许全天导出 ${paidOrderCount + 1} 次`,
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
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 已登录用户不记录（不限制）
    if (userId) {
      return
    }

    // 匿名用户需要 visitorId
    if (!visitorId) {
      return
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
  } catch (error) {
    console.error('记录导出操作失败:', error)
  }
}
