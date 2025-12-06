/**
 * 商品操作辅助函数
 * 提供统一的商品创建、更新接口，确保数据一致性
 */

import { prisma } from './prisma'
import { Product, Prisma } from '@prisma/client'

/**
 * 商品创建数据类型
 */
export type ProductCreateInput = Omit<Prisma.ProductCreateInput, 'category' | 'categoryRef'>

/**
 * 商品更新数据类型
 */
export type ProductUpdateInput = Omit<Prisma.ProductUpdateInput, 'category' | 'categoryRef'>

/**
 * 统一的商品创建函数
 * 自动处理分类字段同步（通过 Prisma 中间件）
 */
export async function createProduct(data: ProductCreateInput): Promise<Product> {
  try {
    // Prisma 中间件会自动同步 category 字段
    const product = await prisma.product.create({
      data: data as Prisma.ProductCreateInput,
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Product Helper] ✅ 创建商品: ${product.title}`)
    }

    return product
  } catch (error) {
    console.error('[Product Helper] ❌ 创建商品失败:', error)
    throw error
  }
}

/**
 * 统一的商品更新函数
 * 自动处理分类字段同步（通过 Prisma 中间件）
 */
export async function updateProduct(
  id: string,
  data: ProductUpdateInput
): Promise<Product> {
  try {
    // Prisma 中间件会自动同步 category 字段
    const product = await prisma.product.update({
      where: { id },
      data: data as Prisma.ProductUpdateInput,
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Product Helper] ✅ 更新商品: ${product.title}`)
    }

    return product
  } catch (error) {
    console.error('[Product Helper] ❌ 更新商品失败:', error)
    throw error
  }
}

/**
 * 批量创建商品
 * 确保每个商品都经过中间件处理
 */
export async function createProductsBatch(
  productsData: ProductCreateInput[]
): Promise<Product[]> {
  const createdProducts: Product[] = []

  try {
    // 逐个创建以触发中间件
    for (const data of productsData) {
      const product = await createProduct(data)
      createdProducts.push(product)
    }

    console.log(`[Product Helper] ✅ 批量创建 ${createdProducts.length} 个商品`)
    return createdProducts
  } catch (error) {
    console.error('[Product Helper] ❌ 批量创建失败:', error)
    throw error
  }
}

/**
 * 验证商品分类数据完整性
 * 返回需要修复的商品列表
 */
export async function validateProductCategories() {
  const issues: Array<{
    productId: string
    productTitle: string
    issue: string
    categoryId: string | null
    category: string | null
  }> = []

  try {
    // 检查所有商品
    const products = await prisma.product.findMany({
      include: {
        categoryRef: {
          select: { id: true, name: true }
        }
      }
    })

    for (const product of products) {
      // 问题1: categoryId 存在但 category 为空
      if (product.categoryId && !product.category) {
        issues.push({
          productId: product.id,
          productTitle: product.title,
          issue: 'categoryId 存在但 category 字段为空',
          categoryId: product.categoryId,
          category: product.category,
        })
      }

      // 问题2: categoryId 指向不存在的分类
      if (product.categoryId && !product.categoryRef) {
        issues.push({
          productId: product.id,
          productTitle: product.title,
          issue: 'categoryId 指向不存在的分类（孤儿外键）',
          categoryId: product.categoryId,
          category: product.category,
        })
      }

      // 问题3: category 与 categoryRef.name 不一致
      if (product.categoryId && product.categoryRef && product.category !== product.categoryRef.name) {
        issues.push({
          productId: product.id,
          productTitle: product.title,
          issue: `category 字段不一致: "${product.category}" != "${product.categoryRef.name}"`,
          categoryId: product.categoryId,
          category: product.category,
        })
      }
    }

    return issues
  } catch (error) {
    console.error('[Product Helper] ❌ 验证分类完整性失败:', error)
    throw error
  }
}

/**
 * 自动修复商品分类数据问题
 */
export async function repairProductCategories(): Promise<{
  fixed: number
  cleared: number
  errors: number
}> {
  const issues = await validateProductCategories()
  let fixed = 0
  let cleared = 0
  let errors = 0

  for (const issue of issues) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: issue.productId },
        include: { categoryRef: true }
      })

      if (!product) continue

      if (!product.categoryRef) {
        // 分类不存在，清除
        await prisma.product.update({
          where: { id: product.id },
          data: { categoryId: null, category: null }
        })
        cleared++
      } else {
        // 同步分类名称
        await prisma.product.update({
          where: { id: product.id },
          data: { category: product.categoryRef.name }
        })
        fixed++
      }
    } catch (error) {
      console.error(`[Product Helper] ❌ 修复商品 ${issue.productTitle} 失败:`, error)
      errors++
    }
  }

  return { fixed, cleared, errors }
}
