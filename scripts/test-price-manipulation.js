/**
 * 价格篡改测试脚本
 * 用于测试订单创建API的安全检查功能
 *
 * 使用方法：
 * 1. 确保开发服务器正在运行 (npm run dev)
 * 2. 运行测试: node scripts/test-price-manipulation.js
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// 测试场景
const testCases = [
  {
    name: '场景1: 正常购买 (100元商品)',
    description: '购买正常价格的商品，应该成功',
    data: {
      items: [
        { productId: 'test-product-1', quantity: 1, price: 100 }
      ]
    },
    expectedStatus: 201,
    shouldPass: true
  },
  {
    name: '场景2: 合法0元商品',
    description: '购买管理员上架的0元免费商品，应该成功',
    data: {
      items: [
        { productId: 'test-free-product', quantity: 1, price: 0 }
      ]
    },
    expectedStatus: 201,
    shouldPass: true
  },
  {
    name: '场景3: 价格篡改攻击 - 单个商品',
    description: '将100元商品篡改成0元，应该被拦截',
    data: {
      items: [
        { productId: 'test-product-1', quantity: 1, price: 0 }  // 篡改：实际价格是100元
      ]
    },
    expectedStatus: 400,
    expectedError: 'PRICE_MANIPULATION',
    shouldPass: false,
    attack: true
  },
  {
    name: '场景4: 价格篡改攻击 - 负数价格',
    description: '使用负数价格，应该在验证阶段被拦截',
    data: {
      items: [
        { productId: 'test-product-1', quantity: 1, price: -50 }
      ]
    },
    expectedStatus: 400,
    shouldPass: false,
    attack: true
  },
  {
    name: '场景5: 价格篡改攻击 - 极小价格',
    description: '将100元商品篡改成0.001元，应该被拦截',
    data: {
      items: [
        { productId: 'test-product-1', quantity: 1, price: 0.001 }
      ]
    },
    expectedStatus: 400,
    expectedError: 'PRICE_MANIPULATION',
    shouldPass: false,
    attack: true
  },
  {
    name: '场景6: 多商品混合 - 正常',
    description: '购买多个正常价格商品，应该成功',
    data: {
      items: [
        { productId: 'test-product-1', quantity: 2, price: 100 },
        { productId: 'test-product-2', quantity: 1, price: 50 }
      ]
    },
    expectedStatus: 201,
    shouldPass: true
  },
  {
    name: '场景7: 多商品混合 - 部分篡改',
    description: '一个正常价格 + 一个篡改成0元，应该被拦截',
    data: {
      items: [
        { productId: 'test-product-1', quantity: 1, price: 100 },
        { productId: 'test-product-2', quantity: 1, price: 0 }  // 篡改：实际价格是50元
      ]
    },
    expectedStatus: 400,
    shouldPass: false,
    attack: true
  }
]

// 执行单个测试
async function runTest(testCase, index) {
  log(`\n${'='.repeat(80)}`, 'cyan')
  log(`测试 ${index + 1}/${testCases.length}: ${testCase.name}`, 'cyan')
  log(`说明: ${testCase.description}`, 'blue')
  log(`${'='.repeat(80)}`, 'cyan')

  if (testCase.attack) {
    log('⚠️  这是一个攻击测试场景', 'yellow')
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCase.data)
    })

    const data = await response.json()
    const status = response.status

    log(`\n响应状态: ${status}`, status === testCase.expectedStatus ? 'green' : 'red')
    log(`响应数据: ${JSON.stringify(data, null, 2)}`, 'reset')

    // 验证结果
    if (status === testCase.expectedStatus) {
      if (testCase.shouldPass) {
        log(`\n✅ 测试通过: 订单创建成功`, 'green')
      } else {
        log(`\n✅ 测试通过: 攻击被成功拦截`, 'green')
        if (data.code === testCase.expectedError) {
          log(`✅ 错误类型正确: ${data.code}`, 'green')
        }
      }
      return { passed: true, testCase: testCase.name }
    } else {
      log(`\n❌ 测试失败: 期望状态码 ${testCase.expectedStatus}，实际 ${status}`, 'red')
      return { passed: false, testCase: testCase.name, reason: `状态码不匹配` }
    }

  } catch (error) {
    log(`\n❌ 测试失败: ${error.message}`, 'red')
    return { passed: false, testCase: testCase.name, reason: error.message }
  }
}

// 运行所有测试
async function runAllTests() {
  log('\n' + '='.repeat(80), 'cyan')
  log('开始价格篡改安全测试', 'cyan')
  log('='.repeat(80) + '\n', 'cyan')

  log('⚠️  注意事项:', 'yellow')
  log('1. 这些测试会尝试创建订单，但由于商品ID不存在，大部分会失败', 'yellow')
  log('2. 我们主要测试的是价格验证逻辑，而不是完整的订单流程', 'yellow')
  log('3. 要进行完整测试，需要先在数据库中创建测试商品\n', 'yellow')

  const results = []

  for (let i = 0; i < testCases.length; i++) {
    const result = await runTest(testCases[i], i)
    results.push(result)

    // 延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // 输出总结
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
      log(`  - ${r.testCase}: ${r.reason}`, 'red')
    })
  }

  log('\n' + '='.repeat(80) + '\n', 'cyan')
}

// 创建真实测试商品的辅助脚本
function printSetupInstructions() {
  log('\n' + '='.repeat(80), 'yellow')
  log('完整测试设置说明', 'yellow')
  log('='.repeat(80), 'yellow')

  log('\n要进行完整的真实测试，你需要:', 'yellow')
  log('1. 在数据库中创建测试商品', 'yellow')
  log('2. 记录商品ID和价格', 'yellow')
  log('3. 修改本脚本中的 productId 和 price\n', 'yellow')

  log('创建测试商品的SQL (SQLite):', 'cyan')
  log(`
-- 创建一个100元的测试商品
INSERT INTO Product (id, title, description, price, status, createdAt, updatedAt)
VALUES ('test-product-100', '测试商品-100元', '用于价格篡改测试', 100, 'active', datetime('now'), datetime('now'));

-- 创建一个0元的免费商品
INSERT INTO Product (id, title, description, price, status, createdAt, updatedAt)
VALUES ('test-product-free', '免费测试商品', '合法的0元商品', 0, 'active', datetime('now'), datetime('now'));

-- 创建一个50元的测试商品
INSERT INTO Product (id, title, description, price, status, createdAt, updatedAt)
VALUES ('test-product-50', '测试商品-50元', '用于价格篡改测试', 50, 'active', datetime('now'), datetime('now'));
`, 'reset')

  log('或者通过管理后台创建这些商品\n', 'yellow')
  log('='.repeat(80) + '\n', 'yellow')
}

// 主函数
async function main() {
  printSetupInstructions()

  log('按 Ctrl+C 退出，或按 Enter 继续运行测试...', 'yellow')

  // 等待用户输入
  if (process.stdin.isTTY) {
    await new Promise(resolve => {
      process.stdin.once('data', resolve)
    })
  }

  await runAllTests()
}

// 运行
main().catch(console.error)
