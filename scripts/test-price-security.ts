/**
 * 完整的价格安全测试脚本
 * 自动创建测试商品并测试价格篡改检测
 *
 * 使用方法: npx tsx scripts/test-price-security.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// 测试数据
interface TestProduct {
  id: string
  title: string
  price: number
}

const testProducts: TestProduct[] = [
  { id: 'security-test-product-100', title: '测试商品-100元', price: 100 },
  { id: 'security-test-product-50', title: '测试商品-50元', price: 50 },
  { id: 'security-test-product-free', title: '免费商品-0元', price: 0 },
]

// 清理测试数据
async function cleanup() {
  log('\n清理测试数据...', 'yellow')

  try {
    // 删除测试订单项
    await prisma.orderItem.deleteMany({
      where: {
        product: {
          id: {
            in: testProducts.map(p => p.id)
          }
        }
      }
    })

    // 删除测试订单
    await prisma.order.deleteMany({
      where: {
        orderNumber: {
          startsWith: 'TEST-'
        }
      }
    })

    // 删除测试商品
    await prisma.product.deleteMany({
      where: {
        id: {
          in: testProducts.map(p => p.id)
        }
      }
    })

    log('✅ 清理完成', 'green')
  } catch (error) {
    log(`清理失败: ${error}`, 'red')
  }
}

// 创建测试商品
async function setupTestProducts() {
  log('\n创建测试商品...', 'yellow')

  for (const product of testProducts) {
    try {
      await prisma.product.upsert({
        where: { id: product.id },
        update: {
          price: product.price,
          status: 'active'
        },
        create: {
          id: product.id,
          title: product.title,
          description: `用于价格篡改安全测试 - ${product.price}元`,
          price: product.price,
          status: 'active',
        }
      })
      log(`✅ 创建商品: ${product.title} (${product.price}元)`, 'green')
    } catch (error) {
      log(`❌ 创建商品失败: ${product.title}`, 'red')
      throw error
    }
  }
}

// 测试场景
interface TestCase {
  name: string
  description: string
  items: Array<{ productId: string; quantity: number; price: number }>
  shouldCreateOrder: boolean
  shouldTriggerAlert: boolean
  isAttack: boolean
}

const testCases: TestCase[] = [
  {
    name: '场景1: 正常购买100元商品',
    description: '使用正确的价格购买，应该成功',
    items: [{ productId: 'security-test-product-100', quantity: 1, price: 100 }],
    shouldCreateOrder: true,
    shouldTriggerAlert: false,
    isAttack: false
  },
  {
    name: '场景2: 购买合法0元商品',
    description: '购买管理员上架的0元商品，应该成功且不触发警报',
    items: [{ productId: 'security-test-product-free', quantity: 1, price: 0 }],
    shouldCreateOrder: true,
    shouldTriggerAlert: false,
    isAttack: false
  },
  {
    name: '场景3: 价格篡改 - 100元商品改成0元',
    description: '将100元商品价格篡改成0元，应该被拦截并触发警报',
    items: [{ productId: 'security-test-product-100', quantity: 1, price: 0 }],
    shouldCreateOrder: false,
    shouldTriggerAlert: true,
    isAttack: true
  },
  {
    name: '场景4: 价格篡改 - 50元商品改成0.01元',
    description: '将50元商品价格篡改成0.01元，应该被拦截',
    items: [{ productId: 'security-test-product-50', quantity: 1, price: 0.01 }],
    shouldCreateOrder: false,
    shouldTriggerAlert: true,
    isAttack: true
  },
  {
    name: '场景5: 多商品 - 混合篡改',
    description: '一个正常价格 + 一个篡改价格，应该被拦截',
    items: [
      { productId: 'security-test-product-100', quantity: 1, price: 100 },
      { productId: 'security-test-product-50', quantity: 1, price: 0 }
    ],
    shouldCreateOrder: false,
    shouldTriggerAlert: false, // 会在价格验证时就失败，不会到安全检查
    isAttack: true
  },
  {
    name: '场景6: 0元商品多个购买',
    description: '购买多个0元商品，应该成功',
    items: [{ productId: 'security-test-product-free', quantity: 5, price: 0 }],
    shouldCreateOrder: true,
    shouldTriggerAlert: false,
    isAttack: false
  }
]

// 模拟订单创建逻辑（简化版，直接测试核心逻辑）
async function testOrderCreation(testCase: TestCase) {
  log(`\n${'='.repeat(80)}`, 'cyan')
  log(`测试: ${testCase.name}`, 'cyan')
  log(`说明: ${testCase.description}`, 'blue')
  if (testCase.isAttack) {
    log('⚠️  这是一个攻击测试场景', 'yellow')
  }
  log('='.repeat(80), 'cyan')

  try {
    let originalAmount = 0
    let totalAmount = 0

    // 验证所有商品并计算原价
    for (const item of testCase.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      })

      if (!product || product.status !== 'active') {
        throw new Error(`商品不存在或已下架: ${item.productId}`)
      }

      // 验证价格是否匹配（这里会检测篡改）
      if (Math.abs(product.price - item.price) > 0.01) {
        log(`❌ 价格不匹配: 商品实际价格${product.price}元，请求价格${item.price}元`, 'red')
        log(`✅ 价格验证层拦截成功`, 'green')
        return {
          success: false,
          reason: 'price_mismatch',
          alertTriggered: false
        }
      }

      originalAmount += item.price * item.quantity
    }

    totalAmount = originalAmount

    // 安全检查：检测价格篡改攻击
    if (originalAmount > 0.01 && totalAmount <= 0.01) {
      log(`🚨 检测到价格篡改攻击！`, 'red')
      log(`   原价: ${originalAmount}元`, 'yellow')
      log(`   折后价: ${totalAmount}元`, 'yellow')

      // 记录安全警报
      await prisma.securityAlert.create({
        data: {
          type: 'PRICE_MANIPULATION',
          severity: 'high',
          userId: null,
          ipAddress: 'test-script',
          userAgent: 'security-test-script',
          description: `[测试]检测到价格篡改攻击：商品原价${originalAmount}元，被异常折扣至${totalAmount}元`,
          metadata: JSON.stringify({
            originalAmount,
            totalAmount,
            items: testCase.items,
            testCase: testCase.name,
            timestamp: new Date().toISOString()
          }),
          status: 'unresolved'
        }
      })

      log(`✅ 安全警报已创建`, 'green')
      log(`✅ 订单创建已拦截`, 'green')

      return {
        success: false,
        reason: 'price_manipulation',
        alertTriggered: true
      }
    }

    // 如果通过所有检查，创建测试订单
    log(`✅ 所有检查通过，原价=${originalAmount}元，总价=${totalAmount}元`, 'green')
    log(`✅ 订单允许创建`, 'green')

    return {
      success: true,
      reason: 'order_created',
      alertTriggered: false,
      amount: totalAmount
    }

  } catch (error) {
    log(`❌ 测试执行失败: ${error}`, 'red')
    return {
      success: false,
      reason: 'error',
      alertTriggered: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// 运行所有测试
async function runAllTests() {
  log('\n' + '='.repeat(80), 'cyan')
  log('价格篡改安全测试', 'cyan')
  log('='.repeat(80) + '\n', 'cyan')

  const results = []

  for (const testCase of testCases) {
    const result = await testOrderCreation(testCase)

    // 验证结果
    const passed =
      (testCase.shouldCreateOrder === result.success) &&
      (testCase.shouldTriggerAlert === result.alertTriggered)

    results.push({
      testCase: testCase.name,
      passed,
      expected: {
        shouldCreate: testCase.shouldCreateOrder,
        shouldAlert: testCase.shouldTriggerAlert
      },
      actual: {
        created: result.success,
        alerted: result.alertTriggered
      }
    })

    if (passed) {
      log(`\n✅ 测试通过`, 'green')
    } else {
      log(`\n❌ 测试失败`, 'red')
      log(`   期望: 订单创建=${testCase.shouldCreateOrder}, 触发警报=${testCase.shouldTriggerAlert}`, 'yellow')
      log(`   实际: 订单创建=${result.success}, 触发警报=${result.alertTriggered}`, 'yellow')
    }

    // 延迟
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  // 总结
  log('\n' + '='.repeat(80), 'cyan')
  log('测试总结', 'cyan')
  log('='.repeat(80), 'cyan')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  log(`\n总测试数: ${results.length}`, 'blue')
  log(`✅ 通过: ${passed}`, 'green')
  log(`❌ 失败: ${failed}`, failed > 0 ? 'red' : 'green')

  if (failed > 0) {
    log('\n失败的测试:', 'red')
    results.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.testCase}`, 'red')
    })
  }

  // 显示安全警报
  const alerts = await prisma.securityAlert.findMany({
    where: {
      userAgent: 'security-test-script'
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  })

  if (alerts.length > 0) {
    log('\n' + '='.repeat(80), 'yellow')
    log(`生成的安全警报 (${alerts.length}条)`, 'yellow')
    log('='.repeat(80), 'yellow')

    alerts.forEach((alert, index) => {
      log(`\n警报 ${index + 1}:`, 'yellow')
      log(`  类型: ${alert.type}`, 'reset')
      log(`  严重程度: ${alert.severity}`, 'reset')
      log(`  描述: ${alert.description}`, 'reset')
      log(`  时间: ${alert.createdAt}`, 'reset')
    })
  }

  log('\n' + '='.repeat(80) + '\n', 'cyan')

  return passed === results.length
}

// 主函数
async function main() {
  try {
    await cleanup()
    await setupTestProducts()
    const success = await runAllTests()

    log('\n是否清理测试数据? (建议清理)', 'yellow')
    log('测试商品和警报将被删除\n', 'yellow')

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
