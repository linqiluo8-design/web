/**
 * 数据备份脚本
 * 在执行 prisma migrate reset 之前运行此脚本
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function backupData() {
  try {
    console.log('📦 开始备份数据...\n')

    // 创建备份目录
    const backupDir = path.join(process.cwd(), 'backup')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`)

    // 1. 备份用户数据
    console.log('👤 备份用户数据...')
    const users = await prisma.user.findMany({
      include: {
        accounts: true,
        sessions: true
      }
    })
    console.log(`   ✓ 导出 ${users.length} 个用户`)

    // 2. 备份分类数据
    console.log('📁 备份分类数据...')
    const categories = await prisma.category.findMany()
    console.log(`   ✓ 导出 ${categories.length} 个分类`)

    // 3. 备份商品数据
    console.log('📦 备份商品数据...')
    const products = await prisma.product.findMany()
    console.log(`   ✓ 导出 ${products.length} 个商品`)

    // 4. 备份订单数据
    console.log('🛒 备份订单数据...')
    const orders = await prisma.order.findMany({
      include: {
        orderItems: true,
        payment: true
      }
    })
    console.log(`   ✓ 导出 ${orders.length} 个订单`)

    // 5. 备份会员方案数据
    console.log('💎 备份会员方案数据...')
    const membershipPlans = await prisma.membershipPlan.findMany()
    console.log(`   ✓ 导出 ${membershipPlans.length} 个会员方案`)

    // 6. 备份会员数据
    console.log('🎫 备份会员数据...')
    const memberships = await prisma.membership.findMany({
      include: {
        usageRecords: true
      }
    })
    console.log(`   ✓ 导出 ${memberships.length} 个会员`)

    // 组装备份数据
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        users,
        categories,
        products,
        orders,
        membershipPlans,
        memberships
      }
    }

    // 写入文件
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8')

    console.log('\n✅ 备份完成！')
    console.log(`📄 备份文件: ${backupFile}`)
    console.log(`📊 总计:`)
    console.log(`   - ${users.length} 个用户`)
    console.log(`   - ${categories.length} 个分类`)
    console.log(`   - ${products.length} 个商品`)
    console.log(`   - ${orders.length} 个订单`)
    console.log(`   - ${membershipPlans.length} 个会员方案`)
    console.log(`   - ${memberships.length} 个会员`)

  } catch (error) {
    console.error('❌ 备份失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backupData()
