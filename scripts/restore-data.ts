/**
 * 数据恢复脚本
 * 在执行 prisma migrate reset 之后运行此脚本
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function restoreData() {
  try {
    console.log('📥 开始恢复数据...\n')

    // 读取最新的备份文件
    const backupDir = path.join(process.cwd(), 'backup')
    if (!fs.existsSync(backupDir)) {
      console.error('❌ 备份目录不存在！请先运行 backup-data.ts')
      process.exit(1)
    }

    const backupFiles = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse()

    if (backupFiles.length === 0) {
      console.error('❌ 没有找到备份文件！')
      process.exit(1)
    }

    const latestBackup = backupFiles[0]
    const backupFile = path.join(backupDir, latestBackup)

    console.log(`📄 使用备份文件: ${latestBackup}\n`)

    // 读取备份数据
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'))
    const { data } = backupData

    // 1. 恢复用户数据
    console.log('👤 恢复用户数据...')
    for (const user of data.users) {
      const { accounts, sessions, ...userData } = user
      await prisma.user.create({
        data: {
          ...userData,
          accounts: {
            create: accounts.map((acc: any) => ({
              type: acc.type,
              provider: acc.provider,
              providerAccountId: acc.providerAccountId,
              refresh_token: acc.refresh_token,
              access_token: acc.access_token,
              expires_at: acc.expires_at,
              token_type: acc.token_type,
              scope: acc.scope,
              id_token: acc.id_token,
              session_state: acc.session_state
            }))
          }
        }
      })
    }
    console.log(`   ✓ 恢复 ${data.users.length} 个用户`)

    // 2. 恢复分类数据
    console.log('📁 恢复分类数据...')
    for (const category of data.categories) {
      await prisma.category.create({
        data: category
      })
    }
    console.log(`   ✓ 恢复 ${data.categories.length} 个分类`)

    // 3. 恢复商品数据（添加新字段 networkDiskLink）
    console.log('📦 恢复商品数据...')
    for (const product of data.products) {
      await prisma.product.create({
        data: {
          ...product,
          networkDiskLink: null // 新字段设置为null
        }
      })
    }
    console.log(`   ✓ 恢复 ${data.products.length} 个商品`)

    // 4. 恢复订单数据
    console.log('🛒 恢复订单数据...')
    for (const order of data.orders) {
      const { orderItems, payment, ...orderData } = order
      await prisma.order.create({
        data: {
          ...orderData,
          orderItems: {
            create: orderItems.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price
            }))
          },
          payment: payment ? {
            create: {
              paymentMethod: payment.paymentMethod,
              transactionId: payment.transactionId,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              paymentData: payment.paymentData
            }
          } : undefined
        }
      })
    }
    console.log(`   ✓ 恢复 ${data.orders.length} 个订单`)

    // 5. 恢复会员方案数据
    console.log('💎 恢复会员方案数据...')
    for (const plan of data.membershipPlans) {
      await prisma.membershipPlan.create({
        data: plan
      })
    }
    console.log(`   ✓ 恢复 ${data.membershipPlans.length} 个会员方案`)

    // 6. 恢复会员数据
    console.log('🎫 恢复会员数据...')
    for (const membership of data.memberships) {
      const { usageRecords, ...membershipData } = membership
      await prisma.membership.create({
        data: {
          ...membershipData,
          usageRecords: {
            create: usageRecords.map((record: any) => ({
              usageDate: new Date(record.usageDate),
              count: record.count
            }))
          }
        }
      })
    }
    console.log(`   ✓ 恢复 ${data.memberships.length} 个会员`)

    console.log('\n✅ 数据恢复完成！')
    console.log(`📊 总计恢复:`)
    console.log(`   - ${data.users.length} 个用户`)
    console.log(`   - ${data.categories.length} 个分类`)
    console.log(`   - ${data.products.length} 个商品`)
    console.log(`   - ${data.orders.length} 个订单`)
    console.log(`   - ${data.membershipPlans.length} 个会员方案`)
    console.log(`   - ${data.memberships.length} 个会员`)

  } catch (error) {
    console.error('❌ 恢复失败:', error)
    console.error('\n提示: 如果遇到唯一约束错误，可能是数据库未完全清空')
    console.error('请确保先运行了 npx prisma migrate reset')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

restoreData()
