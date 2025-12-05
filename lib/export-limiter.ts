import { prisma } from "@/lib/prisma"

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
 * 检查订单导出限制（仅针对匿名用户）
 *
 * 注意：调用此函数前，调用方应该已经判断用户是匿名用户
 *
 * 规则：
 * - 每个已支付订单独立拥有2次导出机会
 * - 订单A可以导出2次，订单B可以导出2次（不是用户总共4次，而是各自独立2次）
 * - 按订单号分别检查和记录，不是按用户统计总次数
 *
 * @param visitorId 访客ID（用于识别匿名用户）
 * @param orderNumbers 用户要导出的订单号列表
 * @returns 导出限制结果
 */
export async function checkOrderExportLimit(
  visitorId?: string,
  orderNumbers?: string[]
): Promise<ExportLimitResult> {
  try {
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

    // 1. 查询用户的订单中哪些是已支付的
    const paidOrders = await prisma.order.findMany({
      where: {
        orderNumber: {
          in: orderNumbers
        },
        status: 'paid' // 只查询已支付订单
      },
      select: {
        orderNumber: true
      }
    })

    const paidOrderNumbers = paidOrders.map(o => o.orderNumber)
    const paidOrderCount = paidOrderNumbers.length

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

    // 2. 设置今天的日期范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 3. 查询每个已支付订单今天的导出次数
    const exportRecords = await prisma.orderExportRecord.findMany({
      where: {
        visitorId,
        orderNumber: {
          in: paidOrderNumbers
        },
        exportDate: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // 4. 检查每个订单是否超过2次限制，收集所有已达到限制的订单
    const limitedOrders: string[] = []
    for (const orderNumber of paidOrderNumbers) {
      const record = exportRecords.find(r => r.orderNumber === orderNumber)
      const count = record?.count || 0

      if (count >= 2) {
        limitedOrders.push(orderNumber)
      }
    }

    // 如果有订单达到限制，给出详细提示
    if (limitedOrders.length > 0) {
      const limitedCount = limitedOrders.length
      const totalCount = paidOrderNumbers.length

      let reason = ''
      if (limitedCount === totalCount) {
        // 所有选中的订单都达到限制
        if (totalCount === 1) {
          // 单个订单超限
          reason = '该订单今天已达到导出限制（每个订单最多导出2次）'
        } else {
          // 多个订单全部超限
          reason = '您选择的所有订单今天已达到导出限制，每个订单最多导出2次'
        }
      } else {
        // 部分订单达到限制
        const remainingCount = totalCount - limitedCount
        reason = `您有 ${limitedCount} 个订单今天已达到导出限制（每个订单最多导出2次）。您还有 ${remainingCount} 个订单可以导出，建议您单独导出 或者 选中合并导出 未达到限制的订单`
      }

      return {
        allowed: false,
        reason,
        paidOrderCount,
        usedExports: 2,
        remainingExports: 0,
        totalAllowed: 2
      }
    }

    // 5. 计算统计信息（用于显示）
    const totalUsed = exportRecords.reduce((sum, r) => sum + r.count, 0)
    const totalAllowed = paidOrderCount * 2
    const remainingExports = totalAllowed - totalUsed

    // 6. 允许导出
    return {
      allowed: true,
      paidOrderCount,
      usedExports: totalUsed,
      remainingExports,
      totalAllowed
    }
  } catch (error) {
    console.error('检查订单导出限制失败:', error)
    return {
      allowed: false,
      reason: '检查导出限制时发生错误'
    }
  }
}

/**
 * 记录订单导出操作（为每个订单分别记录）
 *
 * @param visitorId 访客ID
 * @param userId 用户ID（可选）
 * @param orderNumbers 要导出的订单号列表
 */
export async function recordOrderExport(
  visitorId?: string,
  userId?: string,
  orderNumbers?: string[]
): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 已登录用户不记录（不限制）
  if (userId) {
    return
  }

  // 匿名用户需要 visitorId 和 orderNumbers
  if (!visitorId || !orderNumbers || orderNumbers.length === 0) {
    throw new Error('匿名用户必须提供visitorId和orderNumbers')
  }

  // 只查询已支付的订单号
  const paidOrders = await prisma.order.findMany({
    where: {
      orderNumber: { in: orderNumbers },
      status: 'paid'
    },
    select: { orderNumber: true }
  })

  const paidOrderNumbers = paidOrders.map(o => o.orderNumber)

  // 为每个已支付订单分别记录导出次数
  for (const orderNumber of paidOrderNumbers) {
    const existingRecord = await prisma.orderExportRecord.findUnique({
      where: {
        visitorId_orderNumber_exportDate: {
          visitorId,
          orderNumber,
          exportDate: today
        }
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
          orderNumber,
          exportDate: today,
          count: 1
        }
      })
    }
  }
}

/**
 * 回滚导出记录（当导出失败时调用，按订单号回滚）
 *
 * @param visitorId 访客ID
 * @param orderNumbers 要回滚的订单号列表
 */
export async function rollbackExportRecord(
  visitorId?: string,
  orderNumbers?: string[]
): Promise<void> {
  if (!visitorId || !orderNumbers || orderNumbers.length === 0) {
    return
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 只查询已支付的订单号
  const paidOrders = await prisma.order.findMany({
    where: {
      orderNumber: { in: orderNumbers },
      status: 'paid'
    },
    select: { orderNumber: true }
  })

  const paidOrderNumbers = paidOrders.map(o => o.orderNumber)

  // 为每个订单分别回滚
  for (const orderNumber of paidOrderNumbers) {
    const existingRecord = await prisma.orderExportRecord.findUnique({
      where: {
        visitorId_orderNumber_exportDate: {
          visitorId,
          orderNumber,
          exportDate: today
        }
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
}

// ============== 会员订单导出限制 ==============

/**
 * 检查会员订单导出限制（仅针对匿名用户）
 *
 * 注意：调用此函数前，调用方应该已经判断用户是匿名用户
 *
 * 规则：
 * - 每个已支付会员订单独立拥有2次导出机会
 * - 按会员码分别检查和记录，不是按用户统计总次数
 *
 * @param visitorId 访客ID（用于识别匿名用户）
 * @param membershipCodes 用户要导出的会员码列表
 * @returns 导出限制结果
 */
export async function checkMembershipExportLimit(
  visitorId?: string,
  membershipCodes?: string[]
): Promise<ExportLimitResult> {
  try {
    // 匿名用户需要提供 visitorId
    if (!visitorId) {
      return {
        allowed: false,
        reason: '无法识别访客身份'
      }
    }

    // 匿名用户需要提供会员码列表
    if (!membershipCodes || membershipCodes.length === 0) {
      return {
        allowed: false,
        reason: '只有已支付会员订单支持导出，非已支付订单不支持导出哦',
        paidOrderCount: 0,
        usedExports: 0,
        remainingExports: 0,
        totalAllowed: 0
      }
    }

    // 1. 查询用户的会员订单中哪些是已支付的
    const paidMemberships = await prisma.membership.findMany({
      where: {
        membershipCode: {
          in: membershipCodes
        },
        paymentStatus: 'completed' // 只查询已支付订单
      },
      select: {
        membershipCode: true
      }
    })

    const paidMembershipCodes = paidMemberships.map(m => m.membershipCode)
    const paidOrderCount = paidMembershipCodes.length

    // 如果没有已支付订单，不允许导出
    if (paidOrderCount === 0) {
      return {
        allowed: false,
        reason: '只有已支付会员订单支持导出，非已支付订单不支持导出哦',
        paidOrderCount: 0,
        usedExports: 0,
        remainingExports: 0,
        totalAllowed: 0
      }
    }

    // 2. 设置今天的日期范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 3. 查询每个已支付会员订单今天的导出次数
    const exportRecords = await prisma.membershipExportRecord.findMany({
      where: {
        visitorId,
        membershipCode: {
          in: paidMembershipCodes
        },
        exportDate: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // 4. 检查每个会员订单是否超过2次限制，收集所有已达到限制的订单
    const limitedMemberships: string[] = []
    for (const membershipCode of paidMembershipCodes) {
      const record = exportRecords.find(r => r.membershipCode === membershipCode)
      const count = record?.count || 0

      if (count >= 2) {
        limitedMemberships.push(membershipCode)
      }
    }

    // 如果有会员订单达到限制，给出详细提示
    if (limitedMemberships.length > 0) {
      const limitedCount = limitedMemberships.length
      const totalCount = paidMembershipCodes.length

      let reason = ''
      if (limitedCount === totalCount) {
        // 所有选中的会员订单都达到限制
        if (totalCount === 1) {
          // 单个会员订单超限
          reason = '该会员订单今天已达到导出限制（每个订单最多导出2次）'
        } else {
          // 多个会员订单全部超限
          reason = '您选择的所有会员订单今天已达到导出限制，每个订单最多导出2次'
        }
      } else {
        // 部分会员订单达到限制
        const remainingCount = totalCount - limitedCount
        reason = `您有 ${limitedCount} 个会员订单今天已达到导出限制（每个订单最多导出2次）。您还有 ${remainingCount} 个会员订单可以导出，建议您单独导出 或者 选中合并导出 未达到限制的订单`
      }

      return {
        allowed: false,
        reason,
        paidOrderCount,
        usedExports: 2,
        remainingExports: 0,
        totalAllowed: 2
      }
    }

    // 5. 计算统计信息（用于显示）
    const totalUsed = exportRecords.reduce((sum, r) => sum + r.count, 0)
    const totalAllowed = paidOrderCount * 2
    const remainingExports = totalAllowed - totalUsed

    // 6. 允许导出
    return {
      allowed: true,
      paidOrderCount,
      usedExports: totalUsed,
      remainingExports,
      totalAllowed
    }
  } catch (error) {
    console.error('检查会员订单导出限制失败:', error)
    return {
      allowed: false,
      reason: '检查导出限制时发生错误'
    }
  }
}

/**
 * 记录会员订单导出操作（为每个会员订单分别记录）
 *
 * @param visitorId 访客ID
 * @param userId 用户ID（可选）
 * @param membershipCodes 要导出的会员码列表
 */
export async function recordMembershipExport(
  visitorId?: string,
  userId?: string,
  membershipCodes?: string[]
): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 已登录用户不记录（不限制）
  if (userId) {
    return
  }

  // 匿名用户需要 visitorId 和 membershipCodes
  if (!visitorId || !membershipCodes || membershipCodes.length === 0) {
    throw new Error('匿名用户必须提供visitorId和membershipCodes')
  }

  // 只查询已支付的会员订单
  const paidMemberships = await prisma.membership.findMany({
    where: {
      membershipCode: { in: membershipCodes },
      paymentStatus: 'completed'
    },
    select: { membershipCode: true }
  })

  const paidMembershipCodes = paidMemberships.map(m => m.membershipCode)

  // 为每个已支付会员订单分别记录导出次数
  for (const membershipCode of paidMembershipCodes) {
    const existingRecord = await prisma.membershipExportRecord.findUnique({
      where: {
        visitorId_membershipCode_exportDate: {
          visitorId,
          membershipCode,
          exportDate: today
        }
      }
    })

    if (existingRecord) {
      // 更新计数
      await prisma.membershipExportRecord.update({
        where: { id: existingRecord.id },
        data: {
          count: { increment: 1 }
        }
      })
    } else {
      // 创建新记录
      await prisma.membershipExportRecord.create({
        data: {
          visitorId,
          membershipCode,
          exportDate: today,
          count: 1
        }
      })
    }
  }
}

/**
 * 回滚会员订单导出记录（当导出失败时调用，按会员码回滚）
 *
 * @param visitorId 访客ID
 * @param membershipCodes 要回滚的会员码列表
 */
export async function rollbackMembershipExportRecord(
  visitorId?: string,
  membershipCodes?: string[]
): Promise<void> {
  if (!visitorId || !membershipCodes || membershipCodes.length === 0) {
    return
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 只查询已支付的会员订单
  const paidMemberships = await prisma.membership.findMany({
    where: {
      membershipCode: { in: membershipCodes },
      paymentStatus: 'completed'
    },
    select: { membershipCode: true }
  })

  const paidMembershipCodes = paidMemberships.map(m => m.membershipCode)

  // 为每个会员订单分别回滚
  for (const membershipCode of paidMembershipCodes) {
    const existingRecord = await prisma.membershipExportRecord.findUnique({
      where: {
        visitorId_membershipCode_exportDate: {
          visitorId,
          membershipCode,
          exportDate: today
        }
      }
    })

    if (existingRecord && existingRecord.count > 0) {
      // 减少计数
      await prisma.membershipExportRecord.update({
        where: { id: existingRecord.id },
        data: {
          count: { decrement: 1 }
        }
      })
    }
  }
}
