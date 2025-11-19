import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function generateTestLogs() {
  console.log('开始生成测试日志...')

  const levels = ['info', 'warn', 'error', 'debug']
  const categories = ['api', 'auth', 'payment', 'system', 'security', 'database']
  const actions = [
    'user_login',
    'user_logout',
    'order_created',
    'order_cancelled',
    'payment_success',
    'payment_failed',
    'product_viewed',
    'cart_updated',
    'membership_created',
    'api_call'
  ]
  const messages = [
    '用户成功登录',
    '创建订单成功',
    '支付处理完成',
    '数据库查询执行',
    '安全检查通过',
    'API调用成功',
    '警告：缓存未命中',
    '错误：数据库连接超时',
    '调试：请求参数验证'
  ]
  const paths = [
    '/api/auth/signin',
    '/api/orders',
    '/api/payments',
    '/api/products',
    '/api/users',
    '/api/backendmanager/orders'
  ]
  const methods = ['GET', 'POST', 'PUT', 'DELETE']
  const statusCodes = [200, 201, 400, 401, 403, 404, 500]

  // 生成100条测试日志
  for (let i = 0; i < 100; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)]
    const category = categories[Math.floor(Math.random() * categories.length)]
    const action = actions[Math.floor(Math.random() * actions.length)]
    const message = messages[Math.floor(Math.random() * messages.length)]
    const path = paths[Math.floor(Math.random() * paths.length)]
    const method = methods[Math.floor(Math.random() * methods.length)]
    const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)]
    const duration = Math.floor(Math.random() * 1000)

    // 随机时间（最近7天内）
    const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)

    await prisma.systemLog.create({
      data: {
        level,
        category,
        action,
        message,
        path,
        method,
        statusCode,
        duration,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Test)',
        metadata: JSON.stringify({
          test: true,
          index: i
        }),
        createdAt
      }
    })

    if ((i + 1) % 10 === 0) {
      console.log(`已生成 ${i + 1} 条日志...`)
    }
  }

  console.log('测试日志生成完成！')
}

generateTestLogs()
  .then(() => {
    console.log('完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('错误:', error)
    process.exit(1)
  })
