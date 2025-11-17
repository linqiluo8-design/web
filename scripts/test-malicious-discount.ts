/**
 * 恶意折扣测试脚本
 * 测试异常会员码是否能触发安全警报
 *
 * 使用方法: npx tsx scripts/test-malicious-discount.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// 测试数据
const testProduct = {
  id: 'malicious-test-product-100',
  title: '测试商品-100元',
  price: 100
}

// 恶意会员码数据
interface MaliciousMembership {
  membershipCode: string
  discount: number
  description: string
  shouldTriggerAlert: boolean
  expectedTotalAmount: number
}

const maliciousMemberships: MaliciousMembership[] = [
  {
    membershipCode: 'HACK150',
    discount: 1.5,  // 150%折扣 - 超额折扣
    description: '150%折扣 - 会导致负价格',
    shouldTriggerAlert: true,
    expectedTotalAmount: -50  // 100 - 100*1.5 = -50
  },
  {
    membershipCode: 'HACK200',
    discount: 2.0,  // 200%折扣
    description: '200%折扣 - 极端超额折扣',
    shouldTriggerAlert: true,
    expectedTotalAmount: -100  // 100 - 100*2.0 = -100
  },
  {
    membershipCode: 'HACK100',
    discount: 1.0,  // 100%折扣 - 刚好免费
    description: '100%折扣 - 刚好变成0元',
    shouldTriggerAlert: true,
    expectedTotalAmount: 0  // 100 - 100*1.0 = 0
  },
  {
    membershipCode: 'HACK999',
    discount: 0.999,  // 99.9%折扣 - 接近0元
    description: '99.9%折扣 - 0.1元',
    shouldTriggerAlert: false,  // 不应该触发（总价0.1 > 0.01）
    expectedTotalAmount: 0.1  // 100 - 100*0.999 = 0.1
  },
  {
    membershipCode: 'NORMAL50',
    discount: 0.5,  // 50%折扣 - 正常折扣
    description: '50%折扣 - 正常会员优惠',
    shouldTriggerAlert: false,
    expectedTotalAmount: 50  // 100 - 100*0.5 = 50
  }
]

// 清理测试数据
async function cleanup() {
  log('\n清理测试数据...', 'yellow')

  try {
    // 删除测试订单项
    await prisma.orderItem.deleteMany({
      where: {
        product: {
          id: testProduct.id
        }
      }
    })

    // 删除测试订单
    await prisma.order.deleteMany({
      where: {
        orderNumber: {
          startsWith: 'ORD'
        },
        orderItems: {
          some: {
            productId: testProduct.id
          }
        }
      }
    })

    // 删除测试会员使用记录
    await prisma.membershipUsage.deleteMany({
      where: {
        membership: {
          membershipCode: {
            in: maliciousMemberships.map(m => m.membershipCode)
          }
        }
      }
    })

    // 删除测试会员码
    await prisma.membership.deleteMany({
      where: {
        membershipCode: {
          in: maliciousMemberships.map(m => m.membershipCode)
        }
      }
    })

    // 删除测试商品
    await prisma.product.deleteMany({
      where: {
        id: testProduct.id
      }
    })

    // 删除测试安全警报
    await prisma.securityAlert.deleteMany({
      where: {
        userAgent: 'malicious-discount-test'
      }
    })

    log('✅ 清理完成', 'green')
  } catch (error) {
    log(`清理失败: ${error}`, 'red')
  }
}

// 创建测试商品
async function setupTestProduct() {
  log('\n创建测试商品...', 'yellow')

  try {
    await prisma.product.upsert({
      where: { id: testProduct.id },
      update: {
        price: testProduct.price,
        status: 'active'
      },
      create: {
        id: testProduct.id,
        title: testProduct.title,
        description: `用于恶意折扣测试 - ${testProduct.price}元`,
        price: testProduct.price,
        status: 'active',
      }
    })
    log(`✅ 创建商品: ${testProduct.title} (${testProduct.price}元)`, 'green')
  } catch (error) {
    log(`❌ 创建商品失败: ${error}`, 'red')
    throw error
  }
}

// 创建恶意会员码
async function setupMaliciousMemberships() {
  log('\n创建测试会员码...', 'yellow')

  for (const membership of maliciousMemberships) {
    try {
      const endDate = new Date()
      endDate.setFullYear(endDate.getFullYear() + 1) // 1年有效期

      // 先检查是否有会员方案，如果没有则创建一个测试方案
      let plan = await prisma.membershipPlan.findFirst({
        where: { name: '测试会员方案' }
      })

      if (!plan) {
        plan = await prisma.membershipPlan.create({
          data: {
            name: '测试会员方案',
            price: 0,
            duration: 365,
            discount: 0.5,
            dailyLimit: 999,
            status: 'active'
          }
        })
      }

      await prisma.membership.upsert({
        where: { membershipCode: membership.membershipCode },
        update: {
          discount: membership.discount,
          status: 'active',
          dailyLimit: 999
        },
        create: {
          membershipCode: membership.membershipCode,
          planId: plan.id,
          planSnapshot: JSON.stringify({
            name: membership.description,
            discount: membership.discount,
            dailyLimit: 999
          }),
          purchasePrice: 0,
          discount: membership.discount,
          status: 'active',
          dailyLimit: 999,
          duration: 365,
          endDate: endDate,
          paymentStatus: 'completed'
        }
      })

      const color = membership.shouldTriggerAlert ? 'red' : 'blue'
      log(`✅ 创建会员码: ${membership.membershipCode} (${(membership.discount * 100).toFixed(1)}%折扣) - ${membership.description}`, color)
    } catch (error) {
      log(`❌ 创建会员码失败: ${membership.membershipCode}`, 'red')
      throw error
    }
  }
}

// 测试单个恶意会员码
async function testMaliciousMembership(membership: MaliciousMembership, index: number) {
  log(`\n${'='.repeat(80)}`, 'cyan')
  log(`测试 ${index + 1}/${maliciousMemberships.length}: ${membership.membershipCode}`, 'cyan')
  log(`说明: ${membership.description}`, 'blue')
  log(`折扣率: ${(membership.discount * 100).toFixed(1)}%`, membership.shouldTriggerAlert ? 'red' : 'green')
  log(`预期总价: ${membership.expectedTotalAmount}元`, membership.shouldTriggerAlert ? 'red' : 'green')
  log(`应该触发警报: ${membership.shouldTriggerAlert ? '是' : '否'}`, membership.shouldTriggerAlert ? 'yellow' : 'green')
  log('='.repeat(80), 'cyan')

  try {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'malicious-discount-test'
      },
      body: JSON.stringify({
        items: [
          { productId: testProduct.id, quantity: 1 }
        ],
        membershipCode: membership.membershipCode
      })
    })

    const data = await response.json()
    const status = response.status

    log(`\n响应状态: ${status}`, status === 201 ? 'green' : 'red')
    log(`响应数据: ${JSON.stringify(data, null, 2)}`, 'reset')

    // 验证结果
    if (membership.shouldTriggerAlert) {
      // 应该触发警报，订单应该被拒绝
      if (status === 400 && data.code === 'PRICE_MANIPULATION') {
        log(`\n✅ 测试通过: 恶意折扣被成功拦截`, 'green')
        log(`✅ 错误代码: ${data.code}`, 'green')
        log(`✅ 错误信息: ${data.message}`, 'green')
        return { passed: true, alertTriggered: true, orderCreated: false }
      } else {
        log(`\n❌ 测试失败: 恶意折扣应该被拦截但没有`, 'red')
        log(`❌ 期望: 状态码 400 + PRICE_MANIPULATION`, 'red')
        log(`❌ 实际: 状态码 ${status}`, 'red')
        return { passed: false, alertTriggered: false, orderCreated: status === 201 }
      }
    } else {
      // 不应该触发警报，订单应该成功
      if (status === 201) {
        log(`\n✅ 测试通过: 正常订单创建成功`, 'green')
        log(`✅ 订单号: ${data.orderNumber}`, 'green')
        if (data.appliedDiscount) {
          log(`✅ 折扣信息:`, 'green')
          log(`   原价: ${data.appliedDiscount.originalAmount}元`, 'reset')
          log(`   折扣: ${(data.appliedDiscount.discount * 100).toFixed(1)}%`, 'reset')
          log(`   实付: ${data.appliedDiscount.finalAmount}元`, 'reset')
          log(`   节省: ${data.appliedDiscount.saved}元`, 'reset')
        }
        return { passed: true, alertTriggered: false, orderCreated: true }
      } else {
        log(`\n❌ 测试失败: 正常订单应该成功但失败了`, 'red')
        log(`❌ 期望: 状态码 201`, 'red')
        log(`❌ 实际: 状态码 ${status}`, 'red')
        return { passed: false, alertTriggered: false, orderCreated: false }
      }
    }

  } catch (error) {
    log(`\n❌ 测试执行失败: ${error}`, 'red')
    return { passed: false, alertTriggered: false, orderCreated: false, error: String(error) }
  }
}

// 运行所有测试
async function runAllTests() {
  log('\n' + '='.repeat(80), 'cyan')
  log('恶意折扣安全测试', 'cyan')
  log('='.repeat(80) + '\n', 'cyan')

  log('⚠️  测试说明:', 'yellow')
  log('本测试会在数据库中创建异常折扣的会员码，验证系统能否检测并拦截', 'yellow')
  log('包括：超过100%的折扣、负折扣等恶意场景\n', 'yellow')

  const results = []

  for (let i = 0; i < maliciousMemberships.length; i++) {
    const result = await testMaliciousMembership(maliciousMemberships[i], i)
    results.push({
      ...result,
      membership: maliciousMemberships[i]
    })

    // 延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // 查询并显示安全警报
  log('\n' + '='.repeat(80), 'magenta')
  log('安全警报记录', 'magenta')
  log('='.repeat(80), 'magenta')

  const alerts = await prisma.securityAlert.findMany({
    where: {
      userAgent: 'malicious-discount-test'
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  if (alerts.length > 0) {
    log(`\n共触发 ${alerts.length} 条安全警报：\n`, 'yellow')

    alerts.forEach((alert, index) => {
      log(`警报 ${index + 1}:`, 'yellow')
      log(`  ID: ${alert.id}`, 'reset')
      log(`  类型: ${alert.type}`, 'reset')
      log(`  严重程度: ${alert.severity}`, alert.severity === 'high' ? 'red' : 'yellow')
      log(`  描述: ${alert.description}`, 'reset')
      log(`  IP地址: ${alert.ipAddress}`, 'reset')
      log(`  时间: ${alert.createdAt}`, 'reset')

      try {
        const metadata = JSON.parse(alert.metadata || '{}')
        log(`  详细信息:`, 'cyan')
        log(`    原价: ${metadata.originalAmount}元`, 'reset')
        log(`    折后价: ${metadata.totalAmount}元`, 'reset')
        log(`    折扣率: ${metadata.discount ? (metadata.discount * 100).toFixed(1) + '%' : 'N/A'}`, 'reset')
        log(`    会员码: ${metadata.membershipCode || 'N/A'}`, 'reset')
      } catch (e) {
        // 忽略JSON解析错误
      }
      log('', 'reset')
    })
  } else {
    log('\n⚠️  没有触发任何安全警报', 'yellow')
  }

  // 总结
  log('\n' + '='.repeat(80), 'cyan')
  log('测试总结', 'cyan')
  log('='.repeat(80), 'cyan')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const alertsTriggered = results.filter(r => r.alertTriggered).length

  log(`\n总测试数: ${results.length}`, 'blue')
  log(`✅ 通过: ${passed}`, 'green')
  log(`❌ 失败: ${failed}`, failed > 0 ? 'red' : 'green')
  log(`🚨 触发警报: ${alertsTriggered}`, alertsTriggered > 0 ? 'yellow' : 'green')

  if (failed > 0) {
    log('\n失败的测试:', 'red')
    results.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.membership.membershipCode}: ${r.membership.description}`, 'red')
    })
  }

  // 验证安全机制
  log('\n' + '='.repeat(80), 'cyan')
  log('安全机制验证', 'cyan')
  log('='.repeat(80), 'cyan')

  const shouldTriggerCount = maliciousMemberships.filter(m => m.shouldTriggerAlert).length
  const actuallyTriggered = alertsTriggered

  if (actuallyTriggered === shouldTriggerCount) {
    log(`\n✅ 安全机制工作正常！`, 'green')
    log(`   预期拦截 ${shouldTriggerCount} 个恶意请求`, 'green')
    log(`   实际拦截 ${actuallyTriggered} 个恶意请求`, 'green')
  } else {
    log(`\n❌ 安全机制可能存在问题！`, 'red')
    log(`   预期拦截 ${shouldTriggerCount} 个恶意请求`, 'yellow')
    log(`   实际拦截 ${actuallyTriggered} 个恶意请求`, 'yellow')
  }

  log('\n' + '='.repeat(80) + '\n', 'cyan')

  return passed === results.length
}

// 主函数
async function main() {
  try {
    await cleanup()
    await setupTestProduct()
    await setupMaliciousMemberships()

    log('\n按 Enter 开始测试...', 'yellow')

    // 等待用户输入（仅在TTY环境）
    if (process.stdin.isTTY) {
      await new Promise(resolve => {
        process.stdin.once('data', resolve)
      })
    }

    const success = await runAllTests()

    log('\n是否清理测试数据? (将删除测试商品、会员码和警报)', 'yellow')
    log('按 Enter 清理并退出...', 'yellow')

    if (process.stdin.isTTY) {
      await new Promise(resolve => {
        process.stdin.once('data', resolve)
      })
    }

    await cleanup()

    process.exit(success ? 0 : 1)

  } catch (error) {
    log(`\n测试执行失败: ${error}`, 'red')
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
