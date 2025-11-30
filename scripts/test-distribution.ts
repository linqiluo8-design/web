/**
 * 测试脚本：验证分销佣金结算逻辑
 *
 * 测试流程：
 * 1. 创建测试分销商
 * 2. 使用分销码创建订单
 * 3. 模拟支付成功
 * 4. 验证佣金是否正确结算
 */

import { prisma } from "@/lib/prisma"

async function testDistributionCommission() {
  try {
    console.log("===== 开始测试分销佣金结算 =====\n")

    // 1. 创建测试用户
    console.log("1. 创建测试用户...")
    const testUser = await prisma.user.upsert({
      where: { email: "test-distributor@example.com" },
      update: {},
      create: {
        email: "test-distributor@example.com",
        name: "测试分销商",
        accountStatus: "APPROVED"
      }
    })
    console.log(`   ✓ 用户已创建: ${testUser.id}\n`)

    // 2. 创建测试分销商
    console.log("2. 创建测试分销商...")
    const testDistributor = await prisma.distributor.upsert({
      where: { userId: testUser.id },
      update: {
        status: "active",
        commissionRate: 0.1
      },
      create: {
        userId: testUser.id,
        code: "TEST001",
        commissionRate: 0.1, // 10% 佣金
        status: "active",
        contactName: "测试分销商",
        totalEarnings: 0,
        availableBalance: 0,
        withdrawnAmount: 0,
        totalOrders: 0,
        totalClicks: 0
      }
    })
    console.log(`   ✓ 分销商已创建: ${testDistributor.code}`)
    console.log(`   - 佣金比例: ${testDistributor.commissionRate * 100}%`)
    console.log(`   - 当前余额: ¥${testDistributor.availableBalance}\n`)

    // 3. 创建测试商品
    console.log("3. 创建测试商品...")
    const testProduct = await prisma.product.upsert({
      where: { id: "test-product-001" },
      update: {
        price: 100,
        status: "active"
      },
      create: {
        id: "test-product-001",
        title: "测试商品",
        description: "用于测试分销佣金的商品",
        price: 100,
        status: "active"
      }
    })
    console.log(`   ✓ 商品已创建: ${testProduct.title}`)
    console.log(`   - 价格: ¥${testProduct.price}\n`)

    // 4. 创建订单（使用分销码）
    console.log("4. 模拟创建订单（使用分销码）...")
    const orderNumber = `TEST-${Date.now()}`
    const orderAmount = testProduct.price

    const order = await prisma.order.create({
      data: {
        orderNumber,
        totalAmount: orderAmount,
        distributorId: testDistributor.id,
        status: "pending",
        paymentMethod: "alipay",
        orderItems: {
          create: {
            productId: testProduct.id,
            quantity: 1,
            price: testProduct.price
          }
        }
      }
    })
    console.log(`   ✓ 订单已创建: ${order.orderNumber}`)
    console.log(`   - 订单金额: ¥${order.totalAmount}`)
    console.log(`   - 分销商: ${testDistributor.code}\n`)

    // 5. 创建分销订单记录
    console.log("5. 创建分销订单记录...")
    const commissionAmount = orderAmount * testDistributor.commissionRate
    const distributionOrder = await prisma.distributionOrder.create({
      data: {
        orderId: order.id,
        distributorId: testDistributor.id,
        orderAmount,
        commissionAmount,
        commissionRate: testDistributor.commissionRate,
        status: "pending"
      }
    })
    console.log(`   ✓ 分销订单已创建`)
    console.log(`   - 订单金额: ¥${distributionOrder.orderAmount}`)
    console.log(`   - 佣金金额: ¥${distributionOrder.commissionAmount}`)
    console.log(`   - 状态: ${distributionOrder.status}\n`)

    // 6. 更新分销商订单数
    await prisma.distributor.update({
      where: { id: testDistributor.id },
      data: {
        totalOrders: { increment: 1 }
      }
    })

    // 7. 模拟支付成功
    console.log("6. 模拟支付成功，触发佣金结算...")

    // 创建支付记录
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: "alipay",
        amount: orderAmount,
        status: "completed",
        transactionId: `TEST_${Date.now()}`
      }
    })

    // 更新订单状态
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "paid" }
    })

    // 更新分销订单状态并结算佣金
    await prisma.distributionOrder.update({
      where: { id: distributionOrder.id },
      data: {
        status: "settled",
        confirmedAt: new Date(),
        settledAt: new Date()
      }
    })

    // 更新分销商余额
    await prisma.distributor.update({
      where: { id: testDistributor.id },
      data: {
        totalEarnings: { increment: commissionAmount },
        availableBalance: { increment: commissionAmount }
      }
    })

    console.log(`   ✓ 支付成功，佣金已结算\n`)

    // 8. 验证结果
    console.log("7. 验证结算结果...")
    const updatedDistributor = await prisma.distributor.findUnique({
      where: { id: testDistributor.id }
    })

    const updatedDistributionOrder = await prisma.distributionOrder.findUnique({
      where: { id: distributionOrder.id }
    })

    console.log(`   分销商统计:`)
    console.log(`   - 总订单数: ${updatedDistributor?.totalOrders}`)
    console.log(`   - 总收益: ¥${updatedDistributor?.totalEarnings}`)
    console.log(`   - 可提现余额: ¥${updatedDistributor?.availableBalance}`)
    console.log(`\n   分销订单状态:`)
    console.log(`   - 状态: ${updatedDistributionOrder?.status}`)
    console.log(`   - 确认时间: ${updatedDistributionOrder?.confirmedAt}`)
    console.log(`   - 结算时间: ${updatedDistributionOrder?.settledAt}`)

    // 验证佣金计算是否正确
    const expectedCommission = orderAmount * testDistributor.commissionRate
    if (updatedDistributor?.availableBalance === expectedCommission) {
      console.log(`\n   ✅ 测试通过！佣金计算正确: ¥${expectedCommission}`)
    } else {
      console.log(`\n   ❌ 测试失败！佣金计算错误`)
      console.log(`      预期: ¥${expectedCommission}`)
      console.log(`      实际: ¥${updatedDistributor?.availableBalance}`)
    }

    console.log("\n===== 测试完成 =====")

  } catch (error) {
    console.error("测试失败:", error)
    throw error
  }
}

// 运行测试
testDistributionCommission()
  .then(() => {
    console.log("\n所有测试通过！")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n测试失败:", error)
    process.exit(1)
  })
