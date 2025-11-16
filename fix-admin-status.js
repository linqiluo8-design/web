const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 更新所有管理员账号的状态为 APPROVED
  const result = await prisma.user.updateMany({
    where: {
      role: 'ADMIN'
    },
    data: {
      accountStatus: 'APPROVED'
    }
  })

  console.log(`✓ 已更新 ${result.count} 个管理员账号状态为 APPROVED`)

  // 显示所有管理员账号
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN'
    },
    select: {
      email: true,
      name: true,
      role: true,
      accountStatus: true
    }
  })

  console.log('\n管理员账号列表：')
  admins.forEach(admin => {
    console.log(`- ${admin.email} (${admin.name}) - 状态: ${admin.accountStatus}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
