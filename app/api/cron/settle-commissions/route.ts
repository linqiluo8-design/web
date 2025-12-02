import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 测试用户名单（允许 0 天冷静期，立即结算）
 * 匹配规则：邮箱前缀（test001@example.com, test002@example.com）
 */
const TEST_USERS = ['test001', 'test002']

/**
 * 检查是否为测试用户
 */
async function isTestUser(distributorId: string): Promise<boolean> {
  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    include: {
      user: {
        select: { email: true }
      }
    }
  })

  if (!distributor?.user?.email) return false

  // 检查邮箱前缀是否在测试用户列表中
  const emailPrefix = distributor.user.email.split('@')[0]
  return TEST_USERS.includes(emailPrefix)
}

/**
 * 自动结算超过冷静期的佣金
 *
 * GET /api/cron/settle-commissions
 *
 * 功能：
 * 1. 查找所有状态为 "confirmed" 且超过冷静期的分销订单
 * 2. 将这些订单的状态改为 "settled"
 * 3. 将佣金从 pendingCommission 转移到 availableBalance
 * 4. 测试用户（test001, test002）支持 0 天冷静期，立即结算
 *
 * 建议配置：
 * - 使用 cron job 每天定时执行（如每天凌晨2点）
 * - 或使用 Vercel Cron Jobs 功能
 */
export async function GET(req: Request) {
  try {
    // 获取冷静期配置（默认15天）
    const cooldownConfig = await prisma.systemConfig.findUnique({
      where: { key: "commission_settlement_cooldown_days" }
    })
    const cooldownDays = cooldownConfig ? parseInt(cooldownConfig.value) : 15

    // 计算冷静期截止时间
    const cooldownDeadline = new Date()
    cooldownDeadline.setDate(cooldownDeadline.getDate() - cooldownDays)

    console.log(`开始结算冷静期超过 ${cooldownDays} 天的佣金...`)
    console.log(`冷静期截止时间: ${cooldownDeadline.toISOString()}`)
    console.log(`测试用户（${TEST_USERS.join(', ')}）使用 0 天冷静期`)

    // 查找所有待结算的订单（状态为 confirmed 且确认时间超过冷静期）
    const pendingOrders = await prisma.distributionOrder.findMany({
      where: {
        status: "confirmed",
        confirmedAt: {
          lte: cooldownDeadline  // 确认时间 <= 截止时间（表示已超过冷静期）
        }
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true
          }
        },
        distributor: {
          include: {
            user: {
              select: { email: true }
            }
          }
        }
      }
    })

    // 查找测试用户的所有 confirmed 订单（不受冷静期限制）
    const testUserOrders = await prisma.distributionOrder.findMany({
      where: {
        status: "confirmed",
        distributor: {
          user: {
            OR: TEST_USERS.map(testUser => ({
              email: {
                startsWith: `${testUser}@`
              }
            }))
          }
        }
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true
          }
        },
        distributor: {
          include: {
            user: {
              select: { email: true }
            }
          }
        }
      }
    })

    // 合并订单列表（去重）
    const allOrders = [...pendingOrders, ...testUserOrders]
    const uniqueOrders = Array.from(
      new Map(allOrders.map(order => [order.id, order])).values()
    )

    console.log(`找到 ${pendingOrders.length} 个普通待结算订单`)
    console.log(`找到 ${testUserOrders.length} 个测试用户订单（0天冷静期）`)
    console.log(`共 ${uniqueOrders.length} 个订单待结算`)

    if (uniqueOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "没有需要结算的佣金",
        settled: 0
      })
    }

    let settledCount = 0
    let errorCount = 0
    const errors: Array<{ orderId: string; error: string }> = []

    // 逐个结算订单
    for (const distributionOrder of uniqueOrders) {
      try {
        // 检查订单状态是否仍然为 paid（防止订单被退款）
        if (distributionOrder.order.status !== "paid") {
          console.warn(`订单 ${distributionOrder.order.orderNumber} 状态不是 paid (当前: ${distributionOrder.order.status})，跳过结算`)
          continue
        }

        // 检查是否为测试用户
        const isTest = distributionOrder.distributor?.user?.email
          ? TEST_USERS.some(testUser => distributionOrder.distributor.user.email.startsWith(testUser))
          : false

        // 使用事务确保数据一致性
        await prisma.$transaction(async (tx) => {
          // 1. 更新分销订单状态为 settled
          await tx.distributionOrder.update({
            where: { id: distributionOrder.id },
            data: {
              status: "settled",
              settledAt: new Date()
            }
          })

          // 2. 更新分销商余额：从 pendingCommission 转移到 availableBalance
          await tx.distributor.update({
            where: { id: distributionOrder.distributorId },
            data: {
              pendingCommission: { decrement: distributionOrder.commissionAmount },
              availableBalance: { increment: distributionOrder.commissionAmount }
            }
          })
        })

        settledCount++
        const userLabel = isTest ? '[测试用户-0天冷静期]' : ''
        console.log(`✅ 已结算: ${distributionOrder.order.orderNumber}, 佣金: ¥${distributionOrder.commissionAmount} ${userLabel}`)
      } catch (error: any) {
        errorCount++
        const errorMsg = error.message || "未知错误"
        errors.push({
          orderId: distributionOrder.order.orderNumber,
          error: errorMsg
        })
        console.error(`❌ 结算失败: ${distributionOrder.order.orderNumber}`, error)
      }
    }

    console.log("\n" + "=".repeat(60))
    console.log("佣金结算完成！")
    console.log(`✅ 成功结算: ${settledCount} 个订单`)
    console.log(`❌ 结算失败: ${errorCount} 个订单`)
    console.log("=".repeat(60))

    return NextResponse.json({
      success: true,
      message: `成功结算 ${settledCount} 个订单的佣金`,
      settled: settledCount,
      failed: errorCount,
      errors: errorCount > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error("佣金结算任务失败:", error)
    return NextResponse.json(
      {
        success: false,
        error: "佣金结算失败",
        message: error.message
      },
      { status: 500 }
    )
  }
}
