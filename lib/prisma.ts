import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// Prisma 中间件：自动同步商品分类字段
// 注意：由于中间件内部调用 prisma 可能导致初始化问题，暂时禁用
// 使用手动同步方案（更新接口已有同步逻辑）
/*
prisma.$use(async (params, next) => {
  // 仅处理 Product 模型的创建和更新操作
  if (params.model === 'Product' && (params.action === 'create' || params.action === 'update')) {
    const data = params.args.data

    // 如果设置了 categoryId，自动同步 category 字段
    if (data.categoryId !== undefined) {
      if (data.categoryId === null || data.categoryId === '') {
        // 清除分类时，同时清除旧字段
        data.category = null
      } else {
        // 查询分类名称并同步
        try {
          const category = await prisma.category.findUnique({
            where: { id: data.categoryId },
            select: { name: true }
          })

          if (category) {
            data.category = category.name
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Prisma Middleware] 自动同步分类: categoryId=${data.categoryId} -> category="${category.name}"`)
            }
          } else {
            // categoryId 无效，清除
            data.categoryId = null
            data.category = null
            console.warn(`[Prisma Middleware] ⚠️ 无效的 categoryId: ${data.categoryId}，已自动清除`)
          }
        } catch (error) {
          console.error('[Prisma Middleware] 同步分类失败:', error)
        }
      }
    }
  }

  return next(params)
})
*/

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
