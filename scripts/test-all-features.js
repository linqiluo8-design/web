#!/usr/bin/env node

/**
 * 全站功能一键测试脚本
 * 支持模拟支付和真实支付两种测试场景
 *
 * 使用方法：
 * node scripts/test-all-features.js [mock|real]
 *
 * 示例：
 * node scripts/test-all-features.js mock   # 使用模拟支付测试
 * node scripts/test-all-features.js real   # 使用真实支付测试（谨慎使用）
 */

const https = require('https');
const http = require('http');

// 配置
const config = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  paymentMode: process.argv[2] || 'mock', // mock 或 real
  testUser: {
    email: 'test@example.com',
    password: 'Test123456',
    name: '测试用户'
  },
  adminUser: {
    email: 'admin@example.com',
    password: 'Admin123456'
  },
  timeout: 30000 // 30秒超时
};

// 创建支持自签名证书的 agent
const agent = config.baseUrl.startsWith('https')
  ? new https.Agent({ rejectUnauthorized: false })
  : new http.Agent();

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
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

// 工具函数
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logSection(message) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${message}`, 'bright');
  log('='.repeat(60), 'blue');
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
    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return { response, data };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 测试断言
function assert(condition, message) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    logSuccess(message);
    return true;
  } else {
    testResults.failed++;
    logError(message);
    testResults.errors.push(message);
    return false;
  }
}

function skip(message) {
  testResults.skipped++;
  logWarning(`SKIPPED: ${message}`);
}

// 会话管理
let sessionCookie = null;
let csrfToken = null;

function setSession(headers) {
  const setCookie = headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }
}

function getHeaders(includeAuth = false) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (includeAuth && sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  return headers;
}

// ==================== 测试用例 ====================

// 1. 基础健康检查
async function testHealthCheck() {
  logSection('1. 基础健康检查');

  try {
    const { response } = await request('/');
    assert(response.ok, '首页可访问');

    const { response: apiResponse } = await request('/api/health');
    assert(
      apiResponse.status === 200 || apiResponse.status === 404,
      'API 端点响应正常'
    );
  } catch (error) {
    assert(false, `健康检查失败: ${error.message}`);
  }
}

// 2. 用户认证测试
async function testAuthentication() {
  logSection('2. 用户认证测试');

  try {
    // 测试注册（可能已存在）
    logInfo('测试用户注册...');
    const { response: signupRes, data: signupData } = await request('/api/auth/signup', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(config.testUser)
    });

    if (signupRes.status === 201) {
      logSuccess('用户注册成功');
    } else if (signupRes.status === 400 && signupData.error?.includes('已存在')) {
      logInfo('测试用户已存在，跳过注册');
    } else {
      logWarning(`注册响应: ${signupRes.status} - ${signupData.error || 'Unknown'}`);
    }

    // 测试登录
    logInfo('测试用户登录...');
    const { response: signinRes, data: signinData } = await request('/api/auth/signin', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        email: config.testUser.email,
        password: config.testUser.password
      })
    });

    if (signinRes.ok) {
      setSession(signinRes.headers);
      logSuccess('用户登录成功');
      assert(sessionCookie !== null, '获取到会话 Cookie');
    } else {
      logError(`登录失败: ${signinData.error || 'Unknown'}`);
    }

  } catch (error) {
    assert(false, `认证测试失败: ${error.message}`);
  }
}

// 3. 商品功能测试
async function testProducts() {
  logSection('3. 商品功能测试');

  try {
    // 获取商品列表
    logInfo('获取商品列表...');
    const { response, data } = await request('/api/products');
    assert(response.ok, '商品列表 API 正常');
    assert(Array.isArray(data.products), '返回商品数组');

    if (data.products.length > 0) {
      logSuccess(`找到 ${data.products.length} 个商品`);

      // 测试单个商品详情
      const productId = data.products[0].id;
      const { response: detailRes, data: detailData } = await request(`/api/products/${productId}`);
      assert(detailRes.ok, '商品详情 API 正常');
      assert(detailData.product.id === productId, '商品详情数据正确');
    } else {
      logWarning('商品列表为空，跳过详情测试');
    }

  } catch (error) {
    assert(false, `商品测试失败: ${error.message}`);
  }
}

// 4. 分类功能测试
async function testCategories() {
  logSection('4. 分类功能测试');

  try {
    logInfo('获取分类列表...');
    const { response, data } = await request('/api/categories');
    assert(response.ok, '分类列表 API 正常');
    assert(Array.isArray(data.categories), '返回分类数组');
    logSuccess(`找到 ${data.categories.length} 个分类`);

  } catch (error) {
    assert(false, `分类测试失败: ${error.message}`);
  }
}

// 5. 会员方案测试
async function testMemberships() {
  logSection('5. 会员方案测试');

  try {
    logInfo('获取会员方案列表...');
    const { response, data } = await request('/api/memberships');
    assert(response.ok, '会员方案 API 正常');
    assert(Array.isArray(data.plans), '返回会员方案数组');
    logSuccess(`找到 ${data.plans.length} 个会员方案`);

  } catch (error) {
    assert(false, `会员方案测试失败: ${error.message}`);
  }
}

// 6. 购物车和订单测试
async function testOrderFlow() {
  logSection('6. 购物车和订单流程测试');

  try {
    // 获取商品列表
    const { data: productsData } = await request('/api/products');

    if (!productsData.products || productsData.products.length === 0) {
      skip('没有商品可用，跳过订单流程测试');
      return;
    }

    const testProduct = productsData.products[0];
    logInfo(`使用商品: ${testProduct.title}`);

    // 创建订单
    logInfo('创建测试订单...');
    const orderData = {
      items: [{
        productId: testProduct.id,
        quantity: 1,
        price: testProduct.price
      }],
      totalAmount: testProduct.price,
      paymentMethod: 'alipay'
    };

    const { response: orderRes, data: orderResult } = await request('/api/orders', {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(orderData)
    });

    if (orderRes.ok) {
      logSuccess('订单创建成功');
      assert(orderResult.order?.id, '获取到订单 ID');

      // 获取订单详情
      const { response: detailRes, data: detailData } = await request(
        `/api/orders/${orderResult.order.id}`,
        { headers: getHeaders(true) }
      );
      assert(detailRes.ok, '订单详情 API 正常');

      return orderResult.order;
    } else {
      logWarning(`订单创建失败: ${orderResult.error || 'Unknown'}`);
    }

  } catch (error) {
    assert(false, `订单流程测试失败: ${error.message}`);
  }
}

// 7. 支付流程测试
async function testPaymentFlow(testOrder) {
  logSection(`7. 支付流程测试 (${config.paymentMode} 模式)`);

  if (!testOrder) {
    skip('没有测试订单，跳过支付测试');
    return;
  }

  try {
    logInfo(`测试 ${config.paymentMode === 'mock' ? '模拟' : '真实'} 支付...`);

    if (config.paymentMode === 'mock') {
      // 模拟支付回调
      logInfo('模拟支付回调...');
      const { response } = await request('/api/payment/callback/mock', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          orderId: testOrder.id,
          status: 'success'
        })
      });

      assert(response.ok, '模拟支付回调成功');

      // 验证订单状态
      const { data: orderData } = await request(
        `/api/orders/${testOrder.id}`,
        { headers: getHeaders(true) }
      );
      assert(
        orderData.order?.status === 'PAID' || orderData.order?.status === 'COMPLETED',
        '订单状态更新为已支付'
      );

    } else {
      logWarning('真实支付测试需要手动完成支付流程');
      logInfo('请在浏览器中完成支付并按回车继续...');
      // 这里可以添加等待用户输入的逻辑
    }

  } catch (error) {
    assert(false, `支付流程测试失败: ${error.message}`);
  }
}

// 8. 系统设置测试
async function testSystemSettings() {
  logSection('8. 系统设置测试');

  try {
    logInfo('获取系统设置...');
    const { response, data } = await request('/api/system-config');

    if (response.ok) {
      assert(data.configs !== undefined, '系统配置 API 正常');
      logSuccess('系统设置读取成功');
    } else {
      logWarning('系统设置 API 需要管理员权限');
    }

  } catch (error) {
    logWarning(`系统设置测试: ${error.message}`);
  }
}

// 9. 轮播图测试
async function testBanners() {
  logSection('9. 轮播图功能测试');

  try {
    logInfo('获取轮播图列表...');
    const { response, data } = await request('/api/banners');
    assert(response.ok, '轮播图 API 正常');
    assert(Array.isArray(data.banners), '返回轮播图数组');
    logSuccess(`找到 ${data.banners.length} 个轮播图`);

  } catch (error) {
    assert(false, `轮播图测试失败: ${error.message}`);
  }
}

// 10. 浏览量统计测试
async function testAnalytics() {
  logSection('10. 浏览量统计测试');

  try {
    logInfo('记录页面访问...');
    const { response: trackRes } = await request('/api/analytics/track', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        path: '/test',
        userAgent: 'Test Agent',
        ipAddress: '127.0.0.1'
      })
    });

    assert(trackRes.ok, '浏览量记录 API 正常');

    // 注意：统计查询需要管理员权限
    logInfo('浏览量统计查询需要管理员权限，跳过');

  } catch (error) {
    assert(false, `浏览量统计测试失败: ${error.message}`);
  }
}

// 11. 前端页面可访问性测试
async function testPageAccessibility() {
  logSection('11. 前端页面可访问性测试');

  const pages = [
    { path: '/', name: '首页' },
    { path: '/products', name: '商品列表' },
    { path: '/memberships', name: '会员方案' },
    { path: '/auth/signin', name: '登录页' },
    { path: '/auth/signup', name: '注册页' },
    { path: '/backendmanager', name: '后台管理' },
  ];

  for (const page of pages) {
    try {
      const { response } = await request(page.path);
      assert(
        response.ok || response.status === 401 || response.status === 403,
        `${page.name} (${page.path}) 可访问`
      );
    } catch (error) {
      assert(false, `${page.name} 访问失败: ${error.message}`);
    }
  }
}

// 12. API 端点安全性测试
async function testAPISecurity() {
  logSection('12. API 安全性测试');

  try {
    // 测试未授权访问
    logInfo('测试未授权访问保护...');
    const { response: adminRes } = await request('/api/backendmanager/products');
    assert(
      adminRes.status === 401 || adminRes.status === 403,
      '管理员 API 有权限保护'
    );

    // 测试 CSRF 保护（如果实现了）
    logInfo('CSRF 保护检查...');
    logWarning('CSRF 保护测试需要根据实际实现进行');

  } catch (error) {
    logWarning(`安全性测试: ${error.message}`);
  }
}

// 13. 数据库连接测试
async function testDatabaseConnection() {
  logSection('13. 数据库连接测试');

  try {
    // 通过 API 调用间接测试数据库连接
    const { response } = await request('/api/products');
    assert(response.ok, '数据库连接正常（通过 API 验证）');

  } catch (error) {
    assert(false, `数据库连接测试失败: ${error.message}`);
  }
}

// 14. 性能基准测试
async function testPerformance() {
  logSection('14. 性能基准测试');

  const endpoints = [
    { path: '/api/products', name: '商品列表' },
    { path: '/api/categories', name: '分类列表' },
    { path: '/', name: '首页' }
  ];

  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      const { response } = await request(endpoint.path);
      const duration = Date.now() - startTime;

      assert(response.ok, `${endpoint.name} 响应正常`);

      if (duration < 1000) {
        logSuccess(`${endpoint.name} 响应时间: ${duration}ms (优秀)`);
      } else if (duration < 3000) {
        logInfo(`${endpoint.name} 响应时间: ${duration}ms (良好)`);
      } else {
        logWarning(`${endpoint.name} 响应时间: ${duration}ms (需要优化)`);
      }

    } catch (error) {
      logError(`${endpoint.name} 性能测试失败: ${error.message}`);
    }
  }
}

// ==================== 主测试流程 ====================

async function runAllTests() {
  log('\n' + '='.repeat(60), 'magenta');
  log('  🧪 全站功能测试开始', 'bright');
  log('='.repeat(60), 'magenta');
  log(`  基础 URL: ${config.baseUrl}`, 'cyan');
  log(`  支付模式: ${config.paymentMode === 'mock' ? '模拟支付' : '真实支付'}`, 'cyan');
  log(`  测试时间: ${new Date().toLocaleString('zh-CN')}`, 'cyan');
  log('='.repeat(60) + '\n', 'magenta');

  const startTime = Date.now();
  let testOrder = null;

  try {
    // 运行所有测试
    await testHealthCheck();
    await testAuthentication();
    await testProducts();
    await testCategories();
    await testMemberships();
    testOrder = await testOrderFlow();
    await testPaymentFlow(testOrder);
    await testSystemSettings();
    await testBanners();
    await testAnalytics();
    await testPageAccessibility();
    await testAPISecurity();
    await testDatabaseConnection();
    await testPerformance();

  } catch (error) {
    logError(`测试执行出错: ${error.message}`);
    console.error(error);
  }

  const duration = Date.now() - startTime;

  // 打印测试报告
  printTestReport(duration);
}

function printTestReport(duration) {
  log('\n' + '='.repeat(60), 'magenta');
  log('  📊 测试报告', 'bright');
  log('='.repeat(60), 'magenta');

  const passRate = testResults.total > 0
    ? ((testResults.passed / testResults.total) * 100).toFixed(2)
    : 0;

  log(`\n  总测试数: ${testResults.total}`, 'cyan');
  log(`  ✓ 通过: ${testResults.passed}`, 'green');
  log(`  ✗ 失败: ${testResults.failed}`, 'red');
  log(`  ⊘ 跳过: ${testResults.skipped}`, 'yellow');
  log(`  通过率: ${passRate}%`, passRate >= 80 ? 'green' : 'red');
  log(`  总耗时: ${(duration / 1000).toFixed(2)}s`, 'cyan');

  if (testResults.errors.length > 0) {
    log('\n  失败的测试:', 'red');
    testResults.errors.forEach((error, index) => {
      log(`    ${index + 1}. ${error}`, 'red');
    });
  }

  log('\n' + '='.repeat(60), 'magenta');

  // 生产环境建议
  if (testResults.failed === 0 && passRate >= 95) {
    log('  ✅ 所有测试通过！系统可以投入生产使用。', 'green');
  } else if (passRate >= 80) {
    log('  ⚠️  大部分测试通过，但有部分失败。请检查失败的测试。', 'yellow');
  } else {
    log('  ❌ 测试失败率较高，不建议投入生产使用。', 'red');
  }

  log('='.repeat(60) + '\n', 'magenta');

  // 退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// ==================== 执行测试 ====================

if (require.main === module) {
  // 验证参数
  if (!['mock', 'real'].includes(config.paymentMode)) {
    log('错误：无效的支付模式。请使用 "mock" 或 "real"', 'red');
    log('使用方法: node scripts/test-all-features.js [mock|real]', 'cyan');
    process.exit(1);
  }

  if (config.paymentMode === 'real') {
    log('\n⚠️  警告：您正在使用真实支付模式进行测试！', 'yellow');
    log('这将产生真实的支付交易。确认继续吗？ (y/N)', 'yellow');

    // 等待用户确认
    process.stdin.once('data', (data) => {
      const input = data.toString().trim().toLowerCase();
      if (input === 'y' || input === 'yes') {
        runAllTests();
      } else {
        log('测试已取消。', 'cyan');
        process.exit(0);
      }
    });
  } else {
    runAllTests();
  }
}

module.exports = { runAllTests, testResults };
