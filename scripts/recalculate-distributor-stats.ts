/**
 * 重新计算所有分销商的统计数据
 * 用于修复因测试数据或其他原因导致的数据不一致问题
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function recalculateDistributorStats() {
  console.log('🔄 开始重新计算分销商统计数据...\n')

  try {
    // 获取所有分销商
    const distributors = await prisma.distributor.findMany({
      include: {
        user: {
          select: { email: true }
        }
      }
    })

    console.log(`📊 找到 ${distributors.length} 个分销商\n`)

    let fixedCount = 0
    let errorCount = 0

    for (const distributor of distributors) {
      try {
        // 获取该分销商的所有订单
        const orders = await prisma.distributionOrder.findMany({
          where: { distributorId: distributor.id }
        })

        // 获取所有提现记录
        const withdrawals = await prisma.commissionWithdrawal.findMany({
          where: { distributorId: distributor.id }
        })

        // 计算统计数据
        const stats = orders.reduce(
          (acc, order) => {
            if (order.status === 'confirmed' || order.status === 'settled') {
              acc.totalEarnings += order.commissionAmount
            }
            if (order.status === 'confirmed') {
              acc.pendingCommission += order.commissionAmount
            }
            if (order.status === 'settled') {
              acc.availableBalance += order.commissionAmount
            }
            return acc
          },
          { totalEarnings: 0, pendingCommission: 0, availableBalance: 0, withdrawnAmount: 0 }
        )

        // 计算提现相关数据
        withdrawals.forEach(withdrawal => {
          if (withdrawal.status === 'pending' || withdrawal.status === 'processing') {
            // 待处理的提现：已从 availableBalance 扣除
            stats.availableBalance -= withdrawal.amount
          }
          if (withdrawal.status === 'completed') {
            // 已完成的提现：计入 withdrawnAmount，已从 availableBalance 扣除
            stats.withdrawnAmount += withdrawal.amount
            stats.availableBalance -= withdrawal.amount
          }
          // rejected 状态的提现不影响余额（钱会退回 availableBalance）
        })

        // 检查是否需要更新
        const needsUpdate =
          distributor.totalEarnings !== stats.totalEarnings ||
          distributor.pendingCommission !== stats.pendingCommission ||
          distributor.availableBalance !== stats.availableBalance ||
          distributor.withdrawnAmount !== stats.withdrawnAmount

        if (needsUpdate) {
          console.log(`🔧 修复分销商: ${distributor.user?.email || distributor.id}`)
          console.log(`   旧值: totalEarnings=${distributor.totalEarnings}, pendingCommission=${distributor.pendingCommission}, availableBalance=${distributor.availableBalance}, withdrawnAmount=${distributor.withdrawnAmount}`)
          console.log(`   新值: totalEarnings=${stats.totalEarnings}, pendingCommission=${stats.pendingCommission}, availableBalance=${stats.availableBalance}, withdrawnAmount=${stats.withdrawnAmount}`)

          // 更新数据库
          await prisma.distributor.update({
            where: { id: distributor.id },
            data: {
              totalEarnings: stats.totalEarnings,
              pendingCommission: stats.pendingCommission,
              availableBalance: stats.availableBalance,
              withdrawnAmount: stats.withdrawnAmount
            }
          })

          fixedCount++
          console.log(`   ✅ 已修复\n`)
        }
      } catch (error) {
        console.error(`❌ 处理分销商 ${distributor.user?.email || distributor.id} 时出错:`, error)
        errorCount++
      }
    }

    console.log('\n📈 统计结果:')
    console.log(`   ✅ 已修复: ${fixedCount} 个分销商`)
    console.log(`   ⚠️  跳过: ${distributors.length - fixedCount - errorCount} 个分销商（数据正确）`)
    console.log(`   ❌ 错误: ${errorCount} 个分销商`)

    // 查找仍有问题的数据
    const problematicDistributors = await prisma.distributor.findMany({
      where: {
        OR: [
          { totalEarnings: { lt: 0 } },
          { pendingCommission: { lt: 0 } },
          { availableBalance: { lt: 0 } }
        ]
      },
      include: {
        user: {
          select: { email: true }
        }
      }
    })

    if (problematicDistributors.length > 0) {
      console.log('\n⚠️  警告：以下分销商仍有负数数据：')
      problematicDistributors.forEach(d => {
        console.log(`   - ${d.user?.email || d.id}:`)
        console.log(`     totalEarnings=${d.totalEarnings}`)
        console.log(`     pendingCommission=${d.pendingCommission}`)
        console.log(`     availableBalance=${d.availableBalance}`)
      })
    } else {
      console.log('\n✅ 所有分销商数据正常！')
    }

  } catch (error) {
    console.error('❌ 重新计算失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 执行脚本
recalculateDistributorStats()
  .then(() => {
    console.log('\n✅ 脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error)
    process.exit(1)
  })
