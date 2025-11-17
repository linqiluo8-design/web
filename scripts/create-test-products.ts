/**
 * 创建测试商品脚本
 * 用于在Windows环境下快速创建测试数据
 *
 * 使用: npx tsx scripts/create-test-products.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始创建测试商品...\n')

  const testProducts = [
    {
      id: 'test-100',
      title: '测试商品-100元',
      description: '用于安全测试的100元商品',
      price: 100,
      status: 'active'
    },
    {
      id: 'test-50',
      title: '测试商品-50元',
      description: '用于安全测试的50元商品',
      price: 50,
      status: 'active'
    },
    {
      id: 'test-free',
      title: '免费测试商品',
      description: '用于测试0元商品的合法性',
      price: 0,
      status: 'active'
    }
  ]

  for (const product of testProducts) {
    try {
      const result = await prisma.product.upsert({
        where: { id: product.id },
        update: {
          title: product.title,
          description: product.description,
          price: product.price,
          status: product.status
        },
        create: product
      })
      console.log(`✅ 创建/更新商品: ${result.title} (${result.price}元) - ID: ${result.id}`)
    } catch (error) {
      console.error(`❌ 创建商品失败: ${product.title}`, error)
    }
  }

  console.log('\n测试商品创建完成！')
  console.log('\n你现在可以运行测试脚本：')
  console.log('  npm run dev  (启动开发服务器)')
  console.log('  ./scripts/test-examples.sh  (运行测试)')
}

main()
  .catch((e) => {
    console.error('发生错误:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
