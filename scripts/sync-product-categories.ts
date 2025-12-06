/**
 * 同步所有商品的分类字段
 * 将 categoryId 对应的分类名称写入旧的 category 字段
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncProductCategories() {
  console.log('🔄 开始同步商品分类字段...\n')

  try {
    // 获取所有有 categoryId 的商品
    const products = await prisma.product.findMany({
      where: {
        categoryId: {
          not: null
        }
      },
      include: {
        categoryRef: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    console.log(`📊 找到 ${products.length} 个设置了分类的商品\n`)

    let syncedCount = 0
    let invalidCount = 0
    let alreadySyncedCount = 0

    for (const product of products) {
      if (!product.categoryRef) {
        // categoryId 指向的分类不存在
        console.log(`⚠️  商品 "${product.title}" (ID: ${product.id})`)
        console.log(`   categoryId: ${product.categoryId}`)
        console.log(`   ❌ 分类不存在，需要清除 categoryId\n`)

        await prisma.product.update({
          where: { id: product.id },
          data: {
            categoryId: null,
            category: null
          }
        })
        invalidCount++
      } else if (product.category !== product.categoryRef.name) {
        // 需要同步
        console.log(`🔧 同步商品 "${product.title}"`)
        console.log(`   旧值: category="${product.category || '(null)'}"`)
        console.log(`   新值: category="${product.categoryRef.name}"`)

        await prisma.product.update({
          where: { id: product.id },
          data: {
            category: product.categoryRef.name
          }
        })
        syncedCount++
        console.log(`   ✅ 已同步\n`)
      } else {
        alreadySyncedCount++
      }
    }

    console.log('\n📈 同步结果:')
    console.log(`   ✅ 已同步: ${syncedCount} 个商品`)
    console.log(`   ⏭️  已正确: ${alreadySyncedCount} 个商品（无需更新）`)
    console.log(`   ❌ 清除无效分类: ${invalidCount} 个商品`)
    console.log(`   📊 总计: ${products.length} 个商品`)

    // 检查所有分类
    const categories = await prisma.category.findMany()
    console.log(`\n📁 数据库中的分类 (${categories.length} 个):`)
    categories.forEach(cat => {
      const productCount = products.filter(p => p.categoryId === cat.id).length
      console.log(`   - ${cat.name} (ID: ${cat.id}) - ${productCount} 个商品`)
    })

  } catch (error) {
    console.error('❌ 同步失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 执行脚本
syncProductCategories()
  .then(() => {
    console.log('\n✅ 脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error)
    process.exit(1)
  })
