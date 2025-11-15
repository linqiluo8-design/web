import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始初始化会员方案...')

  // 检查是否已存在方案
  const existing = await prisma.membershipPlan.findMany()
  if (existing.length > 0) {
    console.log('会员方案已存在，跳过初始化')
    return
  }

  // 创建初始会员方案
  const plans = [
    {
      name: '年度会员',
      price: 88,
      duration: 365, // 一年
      discount: 0.8, // 8折
      dailyLimit: 10,
      sortOrder: 1,
      status: 'active'
    },
    {
      name: '三年会员',
      price: 188,
      duration: 1095, // 三年
      discount: 0.7, // 7折
      dailyLimit: 8,
      sortOrder: 2,
      status: 'active'
    },
    {
      name: '终身会员',
      price: 288,
      duration: -1, // 终身
      discount: 0.7, // 7折
      dailyLimit: 8,
      sortOrder: 3,
      status: 'active'
    }
  ]

  for (const plan of plans) {
    const created = await prisma.membershipPlan.create({
      data: plan
    })
    console.log(`✓ 创建会员方案: ${created.name} - ¥${created.price}`)
  }

  console.log('会员方案初始化完成！')
}

main()
  .catch((e) => {
    console.error('初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
