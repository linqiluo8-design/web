/**
 * 检查 test@example.com 用户的分销数据
 */

import { prisma } from "@/lib/prisma"

async function checkDistributionData() {
  try {
    console.log("===== 检查分销数据 =====\n")

    // 1. 查找用户
    console.log("1. 查找 test@example.com 用户...")
    const user = await prisma.user.findUnique({
      where: { email: "test@example.com" },
      include: {
        distributor: true
      }
    })

    if (!user) {
      console.log("   ❌ 用户不存在\n")
      return
    }

    console.log(`   ✓ 用户找到: ${user.id}`)
    console.log(`   - 用户名: ${user.name}`)
    console.log(`   - 邮箱: ${user.email}`)

    if (!user.distributor) {
      console.log("   ❌ 该用户还不是分销商\n")
      return
    }

    console.log(`\n2. 分销商信息:`)
    console.log(`   - ID: ${user.distributor.id}`)
    console.log(`   - 分销码: ${user.distributor.code}`)
    console.log(`   - 状态: ${user.distributor.status}`)
    console.log(`   - 佣金比例: ${user.distributor.commissionRate * 100}%`)
    console.log(`   - 总收益: ¥${user.distributor.totalEarnings}`)
    console.log(`   - 可提现余额: ¥${user.distributor.availableBalance}`)
    console.log(`   - 已提现金额: ¥${user.distributor.withdrawnAmount}`)
    console.log(`   - 总订单数: ${user.distributor.totalOrders}`)
    console.log(`   - 总点击数: ${user.distributor.totalClicks}`)

    // 3. 查找所有通过该分销商产生的订单
    console.log(`\n3. 查找通过分销链接产生的订单:`)
    const orders = await prisma.order.findMany({
      where: { distributorId: user.distributor.id },
      include: {
        orderItems: {
          include: {
            product: true
          }
        },
        payment: true
      },
      orderBy: { createdAt: "desc" }
    })

    console.log(`   找到 ${orders.length} 个订单:\n`)

    for (const order of orders) {
      console.log(`   订单号: ${order.orderNumber}`)
      console.log(`   - 订单ID: ${order.id}`)
      console.log(`   - 状态: ${order.status}`)
      console.log(`   - 金额: ¥${order.totalAmount}`)
      console.log(`   - 创建时间: ${order.createdAt}`)
      console.log(`   - 支付状态: ${order.payment?.status || '未支付'}`)
      console.log(`   - 商品:`)
      order.orderItems.forEach(item => {
        console.log(`     * ${item.product.title} x${item.quantity} (¥${item.price})`)
      })
      console.log()
    }

    // 4. 查找分销订单记录
    console.log(`4. 查找分销订单记录:`)
    const distributionOrders = await prisma.distributionOrder.findMany({
      where: { distributorId: user.distributor.id },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    console.log(`   找到 ${distributionOrders.length} 个分销订单记录:\n`)

    for (const distOrder of distributionOrders) {
      console.log(`   分销订单ID: ${distOrder.id}`)
      console.log(`   - 关联订单号: ${distOrder.order.orderNumber}`)
      console.log(`   - 订单金额: ¥${distOrder.orderAmount}`)
      console.log(`   - 佣金金额: ¥${distOrder.commissionAmount}`)
      console.log(`   - 佣金比例: ${distOrder.commissionRate * 100}%`)
      console.log(`   - 状态: ${distOrder.status}`)
      console.log(`   - 创建时间: ${distOrder.createdAt}`)
      console.log(`   - 确认时间: ${distOrder.confirmedAt || '未确认'}`)
      console.log(`   - 结算时间: ${distOrder.settledAt || '未结算'}`)
      console.log()
    }

    // 5. 查找点击记录
    console.log(`5. 查找点击记录:`)
    const clicks = await prisma.distributionClick.findMany({
      where: { distributorId: user.distributor.id },
      orderBy: { clickedAt: "desc" },
      take: 10
    })

    console.log(`   最近10次点击记录 (共 ${user.distributor.totalClicks} 次):\n`)
    clicks.forEach((click, index) => {
      console.log(`   ${index + 1}. 点击ID: ${click.id}`)
      console.log(`      - 访客ID: ${click.visitorId}`)
      console.log(`      - IP: ${click.ipAddress}`)
      console.log(`      - 是否转化: ${click.converted ? '是' : '否'}`)
      console.log(`      - 订单ID: ${click.orderId || '无'}`)
      console.log(`      - 点击时间: ${click.clickedAt}`)
      console.log()
    })

    console.log("\n===== 检查完成 =====")

  } catch (error) {
    console.error("检查失败:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 运行检查
checkDistributionData()
