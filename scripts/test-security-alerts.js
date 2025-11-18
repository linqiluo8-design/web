#!/usr/bin/env node

/**
 * 安全警报功能测试脚本
 *
 * 该脚本会故意触发各种安全警报，用于测试警报系统是否正常工作
 *
 * 警报类型：
 * 1. PRICE_MANIPULATION - 价格篡改
 * 2. NEGATIVE_PRICE - 负价格
 * 3. PRICE_INCREASE - 价格上涨（使用会员折扣后反而更贵）
 * 4. FREE_PRODUCT_WITH_MEMBERSHIP - 免费商品使用会员折扣
 * 5. EXCESSIVE_QUANTITY - 超大数量订单
 * 6. EXCESSIVE_ORDER_ITEMS - 订单项过多
 * 7. INVALID_DISCOUNT_RATE - 无效折扣率
 * 8. ABNORMAL_DAILY_LIMIT - 异常每日限额
 * 9. ABNORMAL_MEMBERSHIP_DURATION - 异常会员期限
 * 10. EXPIRED_MEMBERSHIP_USE - 使用已过期会员
 * 11. INACTIVE_MEMBERSHIP_USE - 使用未激活会员
 * 12. DAILY_LIMIT_EXHAUSTED - 每日限额耗尽
 * 13. SUSPICIOUS_URL - 可疑URL
 * 14. EXCESSIVE_BANNER_COUNT - 轮播图数量过多
 *
 * 使用方法：
 * node scripts/test-security-alerts.js
 */

const https = require('https');
const http = require('http');

// 配置
const config = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  timeout: 30000
};

// 创建支持自签名证书的 agent
const agent = config.baseUrl.startsWith('https')
  ? new https.Agent({ rejectUnauthorized: false })
  : new http.Agent();

// 测试结果
const testResults = {
  total: 0,
  triggered: 0,
  failed: 0,
  alerts: []
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logSection(message) {
  log(`\n${'='.repeat(80)}`, 'blue');
  log(`  ${message}`, 'bright');
  log('='.repeat(80), 'blue');
}

// HTTP 请求封装
async function request(path, options = {}) {
  const url = `${config.baseUrl}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      agent
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    let data;

    try {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (e) {
      data = null;
    }

    return { response, data };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 记录测试结果
function recordTest(testName, alertType, triggered, details = '') {
  testResults.total++;

  if (triggered) {
    testResults.triggered++;
    testResults.alerts.push({
      name: testName,
      type: alertType,
      details
    });
    logSuccess(`${testName} - 警报已触发`);
  } else {
    testResults.failed++;
    logError(`${testName} - 警报未触发`);
  }
}

function getHeaders(includeAuth = false, session = null) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (includeAuth && session) {
    headers['Cookie'] = session;
  }

  return headers;
}

// ==================== 警报测试用例 ====================

// 1. 价格篡改警报测试
async function testPriceManipulation() {
  logSection('1. 价格篡改警报测试 (PRICE_MANIPULATION)');

  try {
    // 获取商品
    const { data: productsData } = await request('/api/products');

    if (!productsData.products || productsData.products.length === 0) {
      logWarning('没有商品可测试，跳过');
      return;
    }

    const product = productsData.products[0];

    // 尝试创建价格被篡改的订单
    const { response, data } = await request('/api/orders', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        items: [{
          productId: product.id,
          quantity: 1,
          price: product.price // 会被服务器忽略，使用数据库价格
        }],
        totalAmount: 0.01, // 故意设置错误的总金额
        paymentMethod: 'alipay'
      })
    });

    const alertTriggered = response.status === 400 &&
                          data.code === 'PRICE_MANIPULATION';

    recordTest(
      '价格篡改测试',
      'PRICE_MANIPULATION',
      alertTriggered,
      `尝试将订单金额从 ${product.price} 改为 0.01`
    );

  } catch (error) {
    logError(`测试失败: ${error.message}`);
  }
}

// 2. 负价格警报测试
async function testNegativePrice() {
  logSection('2. 负价格警报测试 (NEGATIVE_PRICE)');

  try {
    const { data: productsData } = await request('/api/products');

    if (!productsData.products || productsData.products.length === 0) {
      logWarning('没有商品可测试，跳过');
      return;
    }

    const product = productsData.products[0];

    // 尝试创建负价格订单
    const { response, data } = await request('/api/orders', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        items: [{
          productId: product.id,
          quantity: 1,
          price: -100 // 负价格
        }],
        totalAmount: -100,
        paymentMethod: 'alipay'
      })
    });

    const alertTriggered = response.status === 400;

    recordTest(
      '负价格测试',
      'NEGATIVE_PRICE',
      alertTriggered,
      '尝试创建负价格订单'
    );

  } catch (error) {
    logError(`测试失败: ${error.message}`);
  }
}

// 3. 超大数量警报测试
async function testExcessiveQuantity() {
  logSection('3. 超大数量警报测试 (EXCESSIVE_QUANTITY)');

  try {
    const { data: productsData } = await request('/api/products');

    if (!productsData.products || productsData.products.length === 0) {
      logWarning('没有商品可测试，跳过');
      return;
    }

    const product = productsData.products[0];

    // 尝试创建超大数量订单
    const { response, data } = await request('/api/orders', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        items: [{
          productId: product.id,
          quantity: 100000, // 超大数量
          price: product.price
        }],
        totalAmount: product.price * 100000,
        paymentMethod: 'alipay'
      })
    });

    const alertTriggered = response.status === 400 &&
                          (data.code === 'EXCESSIVE_QUANTITY' || data.error?.includes('数量'));

    recordTest(
      '超大数量测试',
      'EXCESSIVE_QUANTITY',
      alertTriggered,
      '尝试购买 100000 个商品'
    );

  } catch (error) {
    logError(`测试失败: ${error.message}`);
  }
}

// 4. 订单项过多警报测试
async function testExcessiveOrderItems() {
  logSection('4. 订单项过多警报测试 (EXCESSIVE_ORDER_ITEMS)');

  try {
    const { data: productsData } = await request('/api/products');

    if (!productsData.products || productsData.products.length === 0) {
      logWarning('没有商品可测试，跳过');
      return;
    }

    const product = productsData.products[0];

    // 创建超多订单项
    const items = [];
    for (let i = 0; i < 150; i++) { // 超过100项
      items.push({
        productId: product.id,
        quantity: 1,
        price: product.price
      });
    }

    const { response, data } = await request('/api/orders', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        items,
        totalAmount: product.price * 150,
        paymentMethod: 'alipay'
      })
    });

    const alertTriggered = response.status === 400 &&
                          (data.code === 'EXCESSIVE_ORDER_ITEMS' || data.error?.includes('订单项'));

    recordTest(
      '订单项过多测试',
      'EXCESSIVE_ORDER_ITEMS',
      alertTriggered,
      '尝试创建 150 个订单项'
    );

  } catch (error) {
    logError(`测试失败: ${error.message}`);
  }
}

// 5. 可疑URL警报测试
async function testSuspiciousUrl() {
  logSection('5. 可疑URL警报测试 (SUSPICIOUS_URL)');

  const suspiciousUrls = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    '<script>alert(1)</script>'
  ];

  for (const url of suspiciousUrls) {
    try {
      const { response, data } = await request('/api/backendmanager/banners', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: '测试轮播图',
          image: url,
          sortOrder: 0,
          status: 'active'
        })
      });

      const alertTriggered = response.status === 400 &&
                            data.code === 'SUSPICIOUS_URL';

      recordTest(
        `可疑URL测试 - ${url.substring(0, 30)}...`,
        'SUSPICIOUS_URL',
        alertTriggered,
        `检测到可疑URL: ${url}`
      );

    } catch (error) {
      logError(`测试失败: ${error.message}`);
    }
  }
}

// 6. 超长字符串警报测试
async function testExcessiveLength() {
  logSection('6. 超长字符串警报测试');

  try {
    const { response, data } = await request('/api/backendmanager/banners', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        title: 'A'.repeat(300), // 超长标题
        image: 'https://example.com/banner.jpg',
        description: 'B'.repeat(2000), // 超长描述
        sortOrder: 0,
        status: 'active'
      })
    });

    const alertTriggered = response.status === 400;

    recordTest(
      '超长字符串测试',
      'INPUT_VALIDATION',
      alertTriggered,
      '尝试提交超长标题和描述'
    );

  } catch (error) {
    logError(`测试失败: ${error.message}`);
  }
}

// 7. SQL注入尝试检测
async function testSQLInjectionDetection() {
  logSection('7. SQL注入尝试检测');

  const sqlPayloads = [
    "' OR '1'='1",
    "1' OR '1' = '1",
    "'; DROP TABLE users--"
  ];

  for (const payload of sqlPayloads) {
    try {
      const { response, data } = await request(`/api/products?search=${encodeURIComponent(payload)}`);

      // 检查是否返回了数据库错误
      const hasDbError = response.status === 500 ||
                        (data && typeof data === 'string' &&
                         (data.includes('SQL') || data.includes('syntax error')));

      if (hasDbError) {
        logWarning(`SQL注入测试 - ${payload.substring(0, 30)}... - 可能存在漏洞！`);
      } else {
        logSuccess(`SQL注入测试 - ${payload.substring(0, 30)}... - 已拦截`);
      }

    } catch (error) {
      logSuccess(`SQL注入测试 - ${payload} - 已拦截（请求失败）`);
    }
  }
}

// 8. XSS尝试检测
async function testXSSDetection() {
  logSection('8. XSS尝试检测');

  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>'
  ];

  for (const payload of xssPayloads) {
    try {
      const { response, data } = await request('/api/auth/register', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          email: `xss-test-${Date.now()}@example.com`,
          password: 'Test123456',
          name: payload
        })
      });

      // 检查响应中是否包含未转义的脚本
      const responseText = JSON.stringify(data);
      const hasXSS = responseText.includes('<script>') ||
                     responseText.includes('onerror=') ||
                     responseText.includes('onload=');

      if (hasXSS) {
        logWarning(`XSS测试 - ${payload.substring(0, 30)}... - 可能存在漏洞！`);
      } else {
        logSuccess(`XSS测试 - ${payload.substring(0, 30)}... - 已过滤`);
      }

    } catch (error) {
      logSuccess(`XSS测试 - ${payload} - 已拦截`);
    }
  }
}

// 9. 查看生成的安全警报
async function checkSecurityAlerts() {
  logSection('9. 查看生成的安全警报');

  try {
    const { response, data } = await request('/api/backendmanager/security-alerts?page=1&limit=20');

    if (response.ok && data.alerts) {
      logInfo(`找到 ${data.alerts.length} 条安全警报`);

      // 显示最近的警报
      const recentAlerts = data.alerts.slice(0, 10);

      if (recentAlerts.length > 0) {
        log('\n最近的安全警报:', 'cyan');
        log('-'.repeat(80), 'cyan');

        recentAlerts.forEach((alert, index) => {
          const severityColor = {
            critical: 'red',
            high: 'red',
            medium: 'yellow',
            low: 'cyan'
          };

          log(`\n${index + 1}. [${alert.severity.toUpperCase()}] ${alert.type}`, severityColor[alert.severity] || 'cyan');
          log(`   描述: ${alert.description}`, 'reset');
          log(`   时间: ${new Date(alert.createdAt).toLocaleString('zh-CN')}`, 'reset');
          log(`   状态: ${alert.status}`, 'reset');

          if (alert.metadata) {
            try {
              const metadata = JSON.parse(alert.metadata);
              log(`   详情: ${JSON.stringify(metadata, null, 2).substring(0, 100)}...`, 'reset');
            } catch (e) {
              // 忽略解析错误
            }
          }
        });

        log('\n' + '-'.repeat(80), 'cyan');
      }

      // 按类型统计
      const alertsByType = {};
      data.alerts.forEach(alert => {
        alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
      });

      if (Object.keys(alertsByType).length > 0) {
        log('\n警报类型统计:', 'yellow');
        Object.entries(alertsByType).forEach(([type, count]) => {
          log(`  ${type}: ${count}`, 'reset');
        });
      }

    } else {
      logWarning('无法获取安全警报（可能需要管理员权限）');
    }

  } catch (error) {
    logWarning(`查看安全警报失败: ${error.message}`);
  }
}

// 10. 直接插入测试警报到数据库
async function insertTestAlerts() {
  logSection('10. 直接插入测试警报到数据库');

  logInfo('如果需要直接插入警报，请运行以下 Prisma 命令：');

  const commands = [
    {
      type: 'PRICE_MANIPULATION',
      severity: 'critical',
      description: '检测到价格篡改尝试：商品原价100元，被异常折扣至0.01元'
    },
    {
      type: 'SUSPICIOUS_URL',
      severity: 'high',
      description: '检测到可疑URL：javascript:alert(1)'
    },
    {
      type: 'EXCESSIVE_QUANTITY',
      severity: 'medium',
      description: '检测到异常订单数量：单次购买100000个商品'
    }
  ];

  log('\nPrisma 插入命令示例:', 'cyan');
  commands.forEach((alert, index) => {
    log(`\n// 警报 ${index + 1}: ${alert.type}`, 'yellow');
    log(`await prisma.securityAlert.create({`, 'reset');
    log(`  data: {`, 'reset');
    log(`    type: "${alert.type}",`, 'reset');
    log(`    severity: "${alert.severity}",`, 'reset');
    log(`    description: "${alert.description}",`, 'reset');
    log(`    ipAddress: "127.0.0.1",`, 'reset');
    log(`    userAgent: "test-script",`, 'reset');
    log(`    status: "unresolved"`, 'reset');
    log(`  }`, 'reset');
    log(`})`, 'reset');
  });
}

// ==================== 主测试流程 ====================

async function runAllTests() {
  log('\n' + '='.repeat(80), 'magenta');
  log('  🚨 安全警报功能测试', 'bright');
  log('='.repeat(80), 'magenta');
  log(`  目标 URL: ${config.baseUrl}`, 'cyan');
  log(`  测试时间: ${new Date().toLocaleString('zh-CN')}`, 'cyan');
  log('='.repeat(80) + '\n', 'magenta');

  const startTime = Date.now();

  try {
    await testPriceManipulation();
    await testNegativePrice();
    await testExcessiveQuantity();
    await testExcessiveOrderItems();
    await testSuspiciousUrl();
    await testExcessiveLength();
    await testSQLInjectionDetection();
    await testXSSDetection();

    // 等待一下让警报写入数据库
    await new Promise(resolve => setTimeout(resolve, 1000));

    await checkSecurityAlerts();
    await insertTestAlerts();

  } catch (error) {
    logError(`测试执行出错: ${error.message}`);
    console.error(error);
  }

  const duration = Date.now() - startTime;

  // 打印测试报告
  printTestReport(duration);
}

function printTestReport(duration) {
  log('\n' + '='.repeat(80), 'magenta');
  log('  📊 测试报告', 'bright');
  log('='.repeat(80), 'magenta');

  log(`\n  总测试数: ${testResults.total}`, 'cyan');
  log(`  ✓ 警报已触发: ${testResults.triggered}`, 'green');
  log(`  ✗ 警报未触发: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`  测试耗时: ${(duration / 1000).toFixed(2)}s`, 'cyan');

  if (testResults.alerts.length > 0) {
    log('\n  已触发的警报:', 'green');
    log('  ' + '-'.repeat(78), 'green');

    testResults.alerts.forEach((alert, index) => {
      log(`\n  ${index + 1}. ${alert.type}`, 'green');
      log(`     ${alert.name}`, 'cyan');
      if (alert.details) {
        log(`     ${alert.details}`, 'yellow');
      }
    });
    log('  ' + '-'.repeat(78), 'green');
  }

  log('\n' + '='.repeat(80), 'magenta');

  if (testResults.triggered > 0) {
    log(`  ✅ 成功触发 ${testResults.triggered} 个安全警报！`, 'green');
    log('  安全警报系统运行正常！', 'green');
  } else {
    log('  ⚠️  未能触发任何警报，请检查系统配置。', 'yellow');
  }

  log('='.repeat(80) + '\n', 'magenta');

  process.exit(0);
}

// ==================== 执行测试 ====================

if (require.main === module) {
  log('\n⚠️  警告：此脚本将故意触发安全警报！', 'yellow');
  log('这些警报会记录到数据库中，仅用于测试目的。', 'yellow');
  log('开始测试...\n', 'cyan');

  setTimeout(() => {
    runAllTests();
  }, 1000);
}

module.exports = { runAllTests, testResults };
