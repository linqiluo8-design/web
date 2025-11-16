/**
 * 更新现有用户的审核状态
 * 在添加审核功能前创建的用户需要批准才能继续使用
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始更新现有用户状态...\n')

  // 将所有现有用户状态设置为 APPROVED
  const result = await prisma.user.updateMany({
    where: {
      accountStatus: 'PENDING', // 找到所有待审核的用户
    },
    data: {
      accountStatus: 'APPROVED', // 批准所有现有用户
    },
  })

  console.log(`✅ 已批准 ${result.count} 个现有用户`)
  console.log('\n注意：今后新注册的用户需要管理员审核后才能登录。')
}

main()
  .catch((e) => {
    console.error('❌ 更新失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
