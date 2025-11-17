/**
 * 轮播图安全测试脚本
 *
 * 测试场景：
 * 1. 超长标题/描述攻击 (DoS)
 * 2. 恶意URL注入
 * 3. 超出边界的排序值
 * 4. 超过最大数量限制
 * 5. XSS攻击尝试
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 测试配置
const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000'
const ADMIN_SESSION = process.env.TEST_ADMIN_SESSION // 需要管理员会话Cookie

// 颜色输出
function log(message: string, color: 'green' | 'red' | 'yellow' | 'blue' = 'blue') {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m'
  }
  console.log(`${colors[color]}${message}\x1b[0m`)
}

interface TestResult {
  name: string
  passed: boolean
  alertTriggered: boolean
  message: string
}

const results: TestResult[] = []

// 测试辅助函数
async function testBannerCreation(
  testName: string,
  bannerData: any,
  expectedToFail: boolean,
  expectedErrorCode?: string
): Promise<TestResult> {
  log(`\n🧪 测试: ${testName}`, 'blue')

  try {
    const response = await fetch(`${API_BASE}/api/backendmanager/banners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': ADMIN_SESSION || ''
      },
      body: JSON.stringify(bannerData)
    })

    const data = await response.json()

    if (expectedToFail) {
      if (response.status === 400 || response.status === 403) {
        const alertTriggered = expectedErrorCode ? data.code === expectedErrorCode : true

        if (alertTriggered) {
          log(`✅ 测试通过: 恶意请求被成功拦截 (${data.code || data.error})`, 'green')
          return {
            name: testName,
            passed: true,
            alertTriggered: true,
            message: `拦截成功: ${data.error}`
          }
        } else {
          log(`⚠️  测试警告: 请求被拦截但错误码不匹配`, 'yellow')
          log(`   期望: ${expectedErrorCode}, 实际: ${data.code}`, 'yellow')
          return {
            name: testName,
            passed: true,
            alertTriggered: false,
            message: `错误码不匹配: 期望 ${expectedErrorCode}, 实际 ${data.code}`
          }
        }
      } else if (response.status === 201) {
        log(`❌ 测试失败: 恶意请求未被拦截，轮播图创建成功`, 'red')
        return {
          name: testName,
          passed: false,
          alertTriggered: false,
          message: '未能拦截恶意请求'
        }
      }
    } else {
      if (response.status === 201) {
        log(`✅ 测试通过: 正常轮播图创建成功`, 'green')
        return {
          name: testName,
          passed: true,
          alertTriggered: false,
          message: '轮播图创建成功'
        }
      } else {
        log(`❌ 测试失败: 正常请求被错误拦截`, 'red')
        return {
          name: testName,
          passed: false,
          alertTriggered: false,
          message: `正常请求被拦截: ${data.error}`
        }
      }
    }

    return {
      name: testName,
      passed: false,
      alertTriggered: false,
      message: `未预期的响应状态: ${response.status}`
    }
  } catch (error) {
    log(`❌ 测试异常: ${error}`, 'red')
    return {
      name: testName,
      passed: false,
      alertTriggered: false,
      message: `测试异常: ${error}`
    }
  }
}

async function runTests() {
  log('\n=== 轮播图安全测试开始 ===\n', 'blue')

  // 测试1: 正常轮播图创建
  results.push(await testBannerCreation(
    '正常轮播图创建',
    {
      title: '春季新品促销',
      image: 'https://example.com/banner1.jpg',
      link: 'https://example.com/promo',
      description: '全场8折优惠',
      sortOrder: 0,
      status: 'active'
    },
    false
  ))

  // 测试2: 超长标题攻击 (DoS)
  results.push(await testBannerCreation(
    '超长标题攻击 (201字符)',
    {
      title: 'A'.repeat(201), // 超过200字符限制
      image: 'https://example.com/banner2.jpg',
      sortOrder: 0
    },
    true
  ))

  // 测试3: 超长描述攻击 (DoS)
  results.push(await testBannerCreation(
    '超长描述攻击 (1001字符)',
    {
      title: '测试轮播图',
      image: 'https://example.com/banner3.jpg',
      description: 'A'.repeat(1001), // 超过1000字符限制
      sortOrder: 0
    },
    true
  ))

  // 测试4: 超长URL攻击
  results.push(await testBannerCreation(
    '超长图片URL攻击 (2001字符)',
    {
      title: '测试轮播图',
      image: 'https://example.com/' + 'x'.repeat(2001),
      sortOrder: 0
    },
    true
  ))

  // 测试5: JavaScript协议注入 (XSS)
  results.push(await testBannerCreation(
    'JavaScript协议注入攻击',
    {
      title: 'XSS攻击测试',
      image: 'https://example.com/banner.jpg',
      link: 'javascript:alert("XSS")',
      sortOrder: 0
    },
    true,
    'SUSPICIOUS_URL'
  ))

  // 测试6: Data URI攻击
  results.push(await testBannerCreation(
    'Data URI注入攻击',
    {
      title: 'Data URI测试',
      image: 'data:text/html,<script>alert("XSS")</script>',
      sortOrder: 0
    },
    true,
    'SUSPICIOUS_URL'
  ))

  // 测试7: Script标签注入
  results.push(await testBannerCreation(
    'Script标签注入攻击',
    {
      title: '测试轮播图',
      image: 'https://example.com/banner.jpg',
      link: 'https://example.com/<script>alert("XSS")</script>',
      sortOrder: 0
    },
    true,
    'SUSPICIOUS_URL'
  ))

  // 测试8: File协议攻击
  results.push(await testBannerCreation(
    'File协议攻击',
    {
      title: '测试轮播图',
      image: 'file:///etc/passwd',
      sortOrder: 0
    },
    true,
    'SUSPICIOUS_URL'
  ))

  // 测试9: 超大排序值
  results.push(await testBannerCreation(
    '超大排序值攻击 (10000)',
    {
      title: '测试轮播图',
      image: 'https://example.com/banner.jpg',
      sortOrder: 10000, // 超过9999限制
    },
    true
  ))

  // 测试10: 超小排序值
  results.push(await testBannerCreation(
    '超小排序值攻击 (-101)',
    {
      title: '测试轮播图',
      image: 'https://example.com/banner.jpg',
      sortOrder: -101, // 小于-100限制
    },
    true
  ))

  // 测试11: 正常边界值 (应该通过)
  results.push(await testBannerCreation(
    '正常边界值测试 (sortOrder: -100)',
    {
      title: '置顶轮播图',
      image: 'https://example.com/banner.jpg',
      sortOrder: -100, // 最小允许值
    },
    false
  ))

  // 测试12: 正常边界值 (应该通过)
  results.push(await testBannerCreation(
    '正常边界值测试 (sortOrder: 9999)',
    {
      title: '最后轮播图',
      image: 'https://example.com/banner.jpg',
      sortOrder: 9999, // 最大允许值
    },
    false
  ))

  // 输出测试总结
  log('\n=== 测试总结 ===\n', 'blue')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const alertsTriggered = results.filter(r => r.alertTriggered).length

  log(`总测试数: ${results.length}`, 'blue')
  log(`✅ 通过: ${passed}`, 'green')
  log(`❌ 失败: ${failed}`, failed > 0 ? 'red' : 'green')
  log(`🔒 安全警报触发: ${alertsTriggered}`, 'yellow')

  // 详细结果
  log('\n=== 详细结果 ===\n', 'blue')
  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌'
    const color = result.passed ? 'green' : 'red'
    log(`${index + 1}. ${icon} ${result.name}`, color)
    log(`   ${result.message}`, color)
    if (result.alertTriggered) {
      log(`   🔒 安全警报已触发`, 'yellow')
    }
  })

  // 检查安全警报记录
  log('\n=== 安全警报记录 ===\n', 'blue')

  const bannerAlerts = await prisma.securityAlert.findMany({
    where: {
      type: {
        in: [
          'SUSPICIOUS_URL',
          'EXCESSIVE_BANNER_COUNT',
          'BANNER_CREATED',
          'BANNER_UPDATED',
          'BANNER_DELETED'
        ]
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 20
  })

  log(`找到 ${bannerAlerts.length} 条轮播图相关安全记录`, 'blue')

  const suspiciousUrls = bannerAlerts.filter(a => a.type === 'SUSPICIOUS_URL')
  const creations = bannerAlerts.filter(a => a.type === 'BANNER_CREATED')

  log(`  - SUSPICIOUS_URL: ${suspiciousUrls.length} 条`, 'yellow')
  log(`  - BANNER_CREATED: ${creations.length} 条`, 'green')

  // 显示最近的可疑URL警报
  if (suspiciousUrls.length > 0) {
    log('\n最近的可疑URL警报:', 'yellow')
    suspiciousUrls.slice(0, 5).forEach((alert, i) => {
      const metadata = JSON.parse(alert.metadata || '{}')
      log(`  ${i + 1}. [${alert.severity}] ${alert.message}`, 'yellow')
      log(`     URL: ${metadata.url || 'N/A'}`, 'yellow')
      log(`     时间: ${alert.createdAt.toISOString()}`, 'yellow')
    })
  }

  // 最终评分
  log('\n=== 安全评分 ===\n', 'blue')
  const score = (passed / results.length * 100).toFixed(1)
  const scoreColor = parseFloat(score) >= 90 ? 'green' : parseFloat(score) >= 70 ? 'yellow' : 'red'
  log(`安全测试通过率: ${score}%`, scoreColor)

  if (failed === 0) {
    log('\n🎉 所有安全测试通过！轮播图系统安全防护完善！', 'green')
  } else {
    log(`\n⚠️  ${failed} 个测试失败，请检查安全防护机制！`, 'red')
  }

  return failed === 0
}

// 主函数
async function main() {
  try {
    if (!ADMIN_SESSION) {
      log('⚠️  警告: 未设置 TEST_ADMIN_SESSION 环境变量', 'yellow')
      log('某些测试可能需要管理员权限才能运行', 'yellow')
      log('使用方法: TEST_ADMIN_SESSION="your-session-cookie" npm run test:banner-security\n', 'yellow')
    }

    const success = await runTests()
    process.exit(success ? 0 : 1)
  } catch (error) {
    log(`\n❌ 测试异常: ${error}`, 'red')
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
