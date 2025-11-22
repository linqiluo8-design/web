/**
 * SQLite 到 PostgreSQL 数据迁移脚本
 *
 * 使用方法：
 * 1. 确保 PostgreSQL 服务已启动
 * 2. 确保已创建目标数据库
 * 3. 确保 PostgreSQL 表结构已创建（运行 npx prisma migrate dev）
 * 4. 运行：npx tsx scripts/migrate-sqlite-to-postgres.ts
 *
 * 注意：
 * - 此脚本会从 prisma/dev.db 读取数据
 * - 目标数据库连接从 .env 的 DATABASE_URL 读取
 * - 建议先在测试环境验证后再在生产环境使用
 */

import { PrismaClient } from '@prisma/client'

// SQLite 客户端（源数据库）
const sqliteUrl = 'file:./prisma/dev.db'
const sqliteClient = new PrismaClient({
  datasources: {
    db: {
      url: sqliteUrl,
    },
  },
})

// PostgreSQL 客户端（目标数据库，使用 .env 配置）
const postgresClient = new PrismaClient()

interface MigrationStats {
  [key: string]: number
}

/**
 * 主迁移函数
 */
async function migrate() {
  const stats: MigrationStats = {}
  const startTime = Date.now()

  console.log('=' .repeat(70))
  console.log('🚀 开始数据迁移：SQLite → PostgreSQL')
  console.log('=' .repeat(70))
  console.log()
  console.log(`📅 迁移时间：${new Date().toLocaleString('zh-CN')}`)
  console.log(`📂 源数据库：${sqliteUrl}`)
  console.log(`🎯 目标数据库：PostgreSQL (从 .env 读取)`)
  console.log()

  try {
    // ====== 1. 迁移用户数据 ======
    await migrateUsers(stats)

    // ====== 2. 迁移分类数据 ======
    await migrateCategories(stats)

    // ====== 3. 迁移商品数据 ======
    await migrateProducts(stats)

    // ====== 4. 迁移会员方案 ======
    await migrateMembershipPlans(stats)

    // ====== 5. 迁移会员购买记录 ======
    await migrateMemberships(stats)

    // ====== 6. 迁移订单数据 ======
    await migrateOrders(stats)

    // ====== 7. 迁移购物车数据 ======
    await migrateCartItems(stats)

    // ====== 8. 迁移聊天会话 ======
    await migrateChatSessions(stats)

    // ====== 9. 迁移轮播图 ======
    await migrateBanners(stats)

    // ====== 10. 迁移系统配置 ======
    await migrateSystemConfigs(stats)

    // ====== 11. 迁移页面访问记录 ======
    await migratePageViews(stats)

    // ====== 12. 迁移安全警报 ======
    await migrateSecurityAlerts(stats)

    // ====== 13. 迁移系统日志 ======
    await migrateSystemLogs(stats)

    // ====== 14. 迁移导出记录 ======
    await migrateExportRecords(stats)

    // ====== 迁移完成 ======
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log()
    console.log('=' .repeat(70))
    console.log('🎉 数据迁移完成！')
    console.log('=' .repeat(70))
    console.log()
    console.log('📊 迁移统计：')
    console.log()

    const maxKeyLength = Math.max(...Object.keys(stats).map(k => k.length))

    Object.entries(stats).forEach(([key, value]) => {
      const paddedKey = key.padEnd(maxKeyLength + 2)
      const formattedValue = value.toLocaleString('zh-CN')
      console.log(`   ${paddedKey}: ${formattedValue.padStart(8)} 条`)
    })

    const total = Object.values(stats).reduce((a, b) => a + b, 0)
    console.log(`   ${'─'.repeat(maxKeyLength + 2)}   ${'─'.repeat(8)}`)
    console.log(`   ${'总计'.padEnd(maxKeyLength + 2)}: ${total.toLocaleString('zh-CN').padStart(8)} 条`)
    console.log()
    console.log(`⏱️  耗时：${duration} 秒`)
    console.log()

  } catch (error) {
    console.error()
    console.error('❌ 迁移失败！')
    console.error('=' .repeat(70))
    console.error(error)
    console.error()
    throw error
  } finally {
    await sqliteClient.$disconnect()
    await postgresClient.$disconnect()
  }
}

/**
 * 迁移用户数据
 */
async function migrateUsers(stats: MigrationStats) {
  console.log('📦 [1/14] 迁移用户数据...')

  const users = await sqliteClient.user.findMany({
    include: {
      permissions: true,
      accounts: true,
      sessions: true,
    },
  })

  let userCount = 0
  let permissionCount = 0
  let accountCount = 0
  let sessionCount = 0

  for (const user of users) {
    const { permissions, accounts, sessions, ...userData } = user

    // 创建用户
    await postgresClient.user.create({
      data: userData,
    })
    userCount++

    // 创建权限
    for (const permission of permissions) {
      await postgresClient.permission.create({
        data: permission,
      })
      permissionCount++
    }

    // 创建账户
    for (const account of accounts) {
      await postgresClient.account.create({
        data: account,
      })
      accountCount++
    }

    // 创建会话
    for (const session of sessions) {
      await postgresClient.session.create({
        data: session,
      })
      sessionCount++
    }
  }

  stats['用户'] = userCount
  stats['用户权限'] = permissionCount
  stats['账户'] = accountCount
  stats['会话'] = sessionCount

  console.log(`   ✓ 用户: ${userCount}, 权限: ${permissionCount}, 账户: ${accountCount}, 会话: ${sessionCount}`)
  console.log()
}

/**
 * 迁移分类数据
 */
async function migrateCategories(stats: MigrationStats) {
  console.log('📦 [2/14] 迁移分类数据...')

  const categories = await sqliteClient.category.findMany()

  for (const category of categories) {
    await postgresClient.category.create({ data: category })
  }

  stats['分类'] = categories.length
  console.log(`   ✓ 已迁移 ${categories.length} 个分类`)
  console.log()
}

/**
 * 迁移商品数据
 */
async function migrateProducts(stats: MigrationStats) {
  console.log('📦 [3/14] 迁移商品数据...')

  const products = await sqliteClient.product.findMany()

  for (const product of products) {
    await postgresClient.product.create({ data: product })
  }

  stats['商品'] = products.length
  console.log(`   ✓ 已迁移 ${products.length} 个商品`)
  console.log()
}

/**
 * 迁移会员方案
 */
async function migrateMembershipPlans(stats: MigrationStats) {
  console.log('📦 [4/14] 迁移会员方案数据...')

  const plans = await sqliteClient.membershipPlan.findMany()

  for (const plan of plans) {
    await postgresClient.membershipPlan.create({ data: plan })
  }

  stats['会员方案'] = plans.length
  console.log(`   ✓ 已迁移 ${plans.length} 个会员方案`)
  console.log()
}

/**
 * 迁移会员购买记录
 */
async function migrateMemberships(stats: MigrationStats) {
  console.log('📦 [5/14] 迁移会员购买记录...')

  const memberships = await sqliteClient.membership.findMany({
    include: {
      usageRecords: true,
    },
  })

  let membershipCount = 0
  let usageCount = 0

  for (const membership of memberships) {
    const { usageRecords, ...membershipData } = membership

    // 创建会员记录
    await postgresClient.membership.create({
      data: membershipData,
    })
    membershipCount++

    // 创建使用记录
    for (const usage of usageRecords) {
      await postgresClient.membershipUsage.create({
        data: usage,
      })
      usageCount++
    }
  }

  stats['会员记录'] = membershipCount
  stats['会员使用记录'] = usageCount

  console.log(`   ✓ 会员记录: ${membershipCount}, 使用记录: ${usageCount}`)
  console.log()
}

/**
 * 迁移订单数据
 */
async function migrateOrders(stats: MigrationStats) {
  console.log('📦 [6/14] 迁移订单数据...')

  const orders = await sqliteClient.order.findMany({
    include: {
      orderItems: true,
      payment: true,
    },
  })

  let orderCount = 0
  let orderItemCount = 0
  let paymentCount = 0

  for (const order of orders) {
    const { orderItems, payment, ...orderData } = order

    // 创建订单
    await postgresClient.order.create({
      data: orderData,
    })
    orderCount++

    // 创建订单项
    for (const item of orderItems) {
      await postgresClient.orderItem.create({
        data: item,
      })
      orderItemCount++
    }

    // 创建支付记录
    if (payment) {
      await postgresClient.payment.create({
        data: payment,
      })
      paymentCount++
    }
  }

  stats['订单'] = orderCount
  stats['订单项'] = orderItemCount
  stats['支付记录'] = paymentCount

  console.log(`   ✓ 订单: ${orderCount}, 订单项: ${orderItemCount}, 支付: ${paymentCount}`)
  console.log()
}

/**
 * 迁移购物车数据
 */
async function migrateCartItems(stats: MigrationStats) {
  console.log('📦 [7/14] 迁移购物车数据...')

  const cartItems = await sqliteClient.cartItem.findMany()

  for (const item of cartItems) {
    await postgresClient.cartItem.create({ data: item })
  }

  stats['购物车项'] = cartItems.length
  console.log(`   ✓ 已迁移 ${cartItems.length} 个购物车项`)
  console.log()
}

/**
 * 迁移聊天会话
 */
async function migrateChatSessions(stats: MigrationStats) {
  console.log('📦 [8/14] 迁移聊天会话数据...')

  const chatSessions = await sqliteClient.chatSession.findMany({
    include: {
      messages: true,
    },
  })

  let sessionCount = 0
  let messageCount = 0

  for (const session of chatSessions) {
    const { messages, ...sessionData } = session

    // 创建会话
    await postgresClient.chatSession.create({
      data: sessionData,
    })
    sessionCount++

    // 创建消息
    for (const message of messages) {
      await postgresClient.chatMessage.create({
        data: message,
      })
      messageCount++
    }
  }

  stats['聊天会话'] = sessionCount
  stats['聊天消息'] = messageCount

  console.log(`   ✓ 会话: ${sessionCount}, 消息: ${messageCount}`)
  console.log()
}

/**
 * 迁移轮播图
 */
async function migrateBanners(stats: MigrationStats) {
  console.log('📦 [9/14] 迁移轮播图数据...')

  const banners = await sqliteClient.banner.findMany()

  for (const banner of banners) {
    await postgresClient.banner.create({ data: banner })
  }

  stats['轮播图'] = banners.length
  console.log(`   ✓ 已迁移 ${banners.length} 个轮播图`)
  console.log()
}

/**
 * 迁移系统配置
 */
async function migrateSystemConfigs(stats: MigrationStats) {
  console.log('📦 [10/14] 迁移系统配置...')

  const configs = await sqliteClient.systemConfig.findMany()

  for (const config of configs) {
    await postgresClient.systemConfig.create({ data: config })
  }

  stats['系统配置'] = configs.length
  console.log(`   ✓ 已迁移 ${configs.length} 个配置项`)
  console.log()
}

/**
 * 迁移页面访问记录
 */
async function migratePageViews(stats: MigrationStats) {
  console.log('📦 [11/14] 迁移页面访问记录...')

  const pageViews = await sqliteClient.pageView.findMany()

  // 批量插入以提高性能
  const batchSize = 1000
  for (let i = 0; i < pageViews.length; i += batchSize) {
    const batch = pageViews.slice(i, i + batchSize)
    await Promise.all(
      batch.map(view => postgresClient.pageView.create({ data: view }))
    )
  }

  stats['页面访问'] = pageViews.length
  console.log(`   ✓ 已迁移 ${pageViews.length} 条访问记录`)
  console.log()
}

/**
 * 迁移安全警报
 */
async function migrateSecurityAlerts(stats: MigrationStats) {
  console.log('📦 [12/14] 迁移安全警报...')

  const alerts = await sqliteClient.securityAlert.findMany()

  for (const alert of alerts) {
    await postgresClient.securityAlert.create({ data: alert })
  }

  stats['安全警报'] = alerts.length
  console.log(`   ✓ 已迁移 ${alerts.length} 条安全警报`)
  console.log()
}

/**
 * 迁移系统日志
 */
async function migrateSystemLogs(stats: MigrationStats) {
  console.log('📦 [13/14] 迁移系统日志...')

  const logs = await sqliteClient.systemLog.findMany()

  // 批量插入以提高性能
  const batchSize = 1000
  for (let i = 0; i < logs.length; i += batchSize) {
    const batch = logs.slice(i, i + batchSize)
    await Promise.all(
      batch.map(log => postgresClient.systemLog.create({ data: log }))
    )
  }

  stats['系统日志'] = logs.length
  console.log(`   ✓ 已迁移 ${logs.length} 条系统日志`)
  console.log()
}

/**
 * 迁移导出记录
 */
async function migrateExportRecords(stats: MigrationStats) {
  console.log('📦 [14/14] 迁移导出记录...')

  const orderExports = await sqliteClient.orderExportRecord.findMany()
  const membershipExports = await sqliteClient.membershipExportRecord.findMany()

  for (const record of orderExports) {
    await postgresClient.orderExportRecord.create({ data: record })
  }

  for (const record of membershipExports) {
    await postgresClient.membershipExportRecord.create({ data: record })
  }

  const total = orderExports.length + membershipExports.length
  stats['导出记录'] = total

  console.log(`   ✓ 订单导出: ${orderExports.length}, 会员导出: ${membershipExports.length}`)
  console.log()
}

// ====== 执行迁移 ======
migrate()
  .then(() => {
    console.log('✅ 迁移脚本执行成功')
    console.log()
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 迁移脚本执行失败')
    console.error()
    console.error('错误详情：')
    console.error(error)
    console.error()
    process.exit(1)
  })
