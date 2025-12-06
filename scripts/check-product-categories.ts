import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

const prisma = new PrismaClient()

async function checkProductCategories() {
  console.log('🔍 检查商品分类数据...\n')

  try {
    // 获取所有商品及其分类
    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        category: true,
        categoryId: true,
        categoryRef: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 10,
    })

    console.log(`📋 找到 ${products.length} 个商品:\n`)

    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title}`)
      console.log(`   category字段: ${product.category || '(空)'}`)
      console.log(`   categoryId: ${product.categoryId || '(空)'}`)
      console.log(`   categoryRef.name: ${product.categoryRef?.name || '(无关联)'}`)
      console.log(`   应该显示: ${product.categoryRef?.name || product.category || '-'}`)
      console.log('')
    })

    // 统计
    const withCategoryRef = products.filter(p => p.categoryRef).length
    const withCategoryId = products.filter(p => p.categoryId).length
    const withOldCategory = products.filter(p => p.category).length

    console.log('📊 统计:')
    console.log(`   有 categoryRef 的: ${withCategoryRef}/${products.length}`)
    console.log(`   有 categoryId 的: ${withCategoryId}/${products.length}`)
    console.log(`   有旧 category 字段的: ${withOldCategory}/${products.length}`)

    // 检查所有分类
    const categories = await prisma.category.findMany()
    console.log(`\n📁 数据库中的所有分类 (${categories.length} 个):`)
    categories.forEach(cat => {
      console.log(`   - ${cat.name} (ID: ${cat.id})`)
    })

  } catch (error) {
    console.error('❌ 查询失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProductCategories()
