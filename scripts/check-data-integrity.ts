/**
 * 数据完整性检查脚本
 * 定期检查并报告数据问题，可选自动修复
 *
 * 使用方法:
 * npm run db:check-integrity          # 仅检查
 * npm run db:check-integrity -- --fix # 检查并自动修复
 */

import { validateProductCategories, repairProductCategories } from '../lib/product-helpers'
import { prisma } from '../lib/prisma'

interface IntegrityReport {
  timestamp: Date
  checks: {
    name: string
    status: 'pass' | 'warning' | 'error'
    message: string
    details?: any
  }[]
}

async function checkProductCategories(autoFix: boolean = false) {
  console.log('\n📋 检查商品分类数据完整性...')

  const issues = await validateProductCategories()

  if (issues.length === 0) {
    return {
      name: '商品分类完整性',
      status: 'pass' as const,
      message: '所有商品分类数据正常'
    }
  }

  console.log(`\n⚠️  发现 ${issues.length} 个问题:`)
  issues.forEach((issue, index) => {
    console.log(`\n${index + 1}. 商品: ${issue.productTitle} (ID: ${issue.productId})`)
    console.log(`   问题: ${issue.issue}`)
    console.log(`   categoryId: ${issue.categoryId || '(null)'}`)
    console.log(`   category: ${issue.category || '(null)'}`)
  })

  if (autoFix) {
    console.log('\n🔧 开始自动修复...')
    const result = await repairProductCategories()
    console.log(`\n✅ 修复完成:`)
    console.log(`   - 已同步: ${result.fixed} 个商品`)
    console.log(`   - 已清除: ${result.cleared} 个商品`)
    console.log(`   - 失败: ${result.errors} 个商品`)

    return {
      name: '商品分类完整性',
      status: result.errors > 0 ? 'warning' as const : 'pass' as const,
      message: `发现并修复 ${issues.length} 个问题`,
      details: result
    }
  }

  return {
    name: '商品分类完整性',
    status: 'warning' as const,
    message: `发现 ${issues.length} 个问题需要修复`,
    details: issues
  }
}

async function checkOrphanedRecords() {
  console.log('\n📋 检查孤儿记录...')

  const checks = []

  // 注意：Prisma 不支持直接查询 relation 为 null 的记录
  // 改用 include 方式检查
  try {
    // 检查订单项 - 使用 include 来检测孤儿记录
    const allOrderItems = await prisma.orderItem.findMany({
      take: 1000, // 限制数量避免内存问题
      include: {
        product: true
      }
    })

    const orphanedOrderItems = allOrderItems.filter(item => !item.product)

    if (orphanedOrderItems.length > 0) {
      checks.push({
        name: '孤儿订单项',
        status: 'warning' as const,
        message: `发现 ${orphanedOrderItems.length} 个订单项关联的商品不存在`,
        details: orphanedOrderItems.length
      })
      console.log(`⚠️  发现 ${orphanedOrderItems.length} 个孤儿订单项`)
    } else {
      checks.push({
        name: '孤儿订单项',
        status: 'pass' as const,
        message: '无孤儿订单项（检查前1000条）'
      })
    }
  } catch (error) {
    console.warn('⚠️  跳过孤儿订单项检查:', error)
    checks.push({
      name: '孤儿订单项',
      status: 'warning' as const,
      message: '检查失败，已跳过'
    })
  }

  // 检查购物车项
  try {
    const allCartItems = await prisma.cartItem.findMany({
      take: 1000,
      include: {
        user: true
      }
    })

    const orphanedCartItems = allCartItems.filter(item => !item.user)

    if (orphanedCartItems.length > 0) {
      checks.push({
        name: '孤儿购物车项',
        status: 'warning' as const,
        message: `发现 ${orphanedCartItems.length} 个购物车项关联的用户不存在`,
        details: orphanedCartItems.length
      })
      console.log(`⚠️  发现 ${orphanedCartItems.length} 个孤儿购物车项`)
    } else {
      checks.push({
        name: '孤儿购物车项',
        status: 'pass' as const,
        message: '无孤儿购物车项（检查前1000条）'
      })
    }
  } catch (error) {
    console.warn('⚠️  跳过孤儿购物车项检查:', error)
    checks.push({
      name: '孤儿购物车项',
      status: 'warning' as const,
      message: '检查失败，已跳过'
    })
  }

  return checks
}

async function checkDatabaseStats() {
  console.log('\n📊 数据库统计...')

  const stats = {
    products: await prisma.product.count(),
    categories: await prisma.category.count(),
    orders: await prisma.order.count(),
    users: await prisma.user.count(),
    productsWithCategory: await prisma.product.count({
      where: { categoryId: { not: null } }
    }),
    productsWithoutCategory: await prisma.product.count({
      where: { categoryId: null }
    })
  }

  console.log(`   商品总数: ${stats.products}`)
  console.log(`   分类总数: ${stats.categories}`)
  console.log(`   订单总数: ${stats.orders}`)
  console.log(`   用户总数: ${stats.users}`)
  console.log(`   有分类的商品: ${stats.productsWithCategory} (${((stats.productsWithCategory / stats.products) * 100).toFixed(1)}%)`)
  console.log(`   无分类的商品: ${stats.productsWithoutCategory} (${((stats.productsWithoutCategory / stats.products) * 100).toFixed(1)}%)`)

  return {
    name: '数据库统计',
    status: 'pass' as const,
    message: `总计 ${stats.products} 个商品, ${stats.categories} 个分类, ${stats.orders} 个订单`,
    details: stats
  }
}

async function runIntegrityCheck(autoFix: boolean = false) {
  const report: IntegrityReport = {
    timestamp: new Date(),
    checks: []
  }

  console.log('🔍 开始数据完整性检查...')
  console.log(`⏰ 时间: ${report.timestamp.toLocaleString('zh-CN')}`)
  console.log(`🔧 自动修复: ${autoFix ? '启用' : '禁用'}`)

  try {
    // 1. 检查商品分类
    const categoryCheck = await checkProductCategories(autoFix)
    report.checks.push(categoryCheck)

    // 2. 检查孤儿记录
    const orphanChecks = await checkOrphanedRecords()
    report.checks.push(...orphanChecks)

    // 3. 数据库统计
    const statsCheck = await checkDatabaseStats()
    report.checks.push(statsCheck)

    // 汇总结果
    console.log('\n' + '='.repeat(60))
    console.log('📈 检查结果汇总:')
    console.log('='.repeat(60))

    const passed = report.checks.filter(c => c.status === 'pass').length
    const warnings = report.checks.filter(c => c.status === 'warning').length
    const errors = report.checks.filter(c => c.status === 'error').length

    console.log(`\n✅ 通过: ${passed}`)
    console.log(`⚠️  警告: ${warnings}`)
    console.log(`❌ 错误: ${errors}`)

    if (warnings > 0 || errors > 0) {
      console.log('\n需要注意的问题:')
      report.checks
        .filter(c => c.status !== 'pass')
        .forEach(check => {
          const icon = check.status === 'warning' ? '⚠️ ' : '❌'
          console.log(`${icon} ${check.name}: ${check.message}`)
        })

      if (!autoFix) {
        console.log('\n💡 提示: 运行 npm run db:check-integrity -- --fix 自动修复问题')
      }
    }

    console.log('\n✅ 检查完成!')
    console.log('='.repeat(60) + '\n')

    return report

  } catch (error) {
    console.error('\n❌ 检查过程中发生错误:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 执行脚本
const autoFix = process.argv.includes('--fix')

runIntegrityCheck(autoFix)
  .then((report) => {
    const hasIssues = report.checks.some(c => c.status !== 'pass')
    process.exit(hasIssues && !autoFix ? 1 : 0)
  })
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
