const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== 管理员账号列表 ===\n')

  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN'
    },
    select: {
      id: true,
      email: true,
      name: true,
      accountStatus: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  if (admins.length === 0) {
    console.log('❌ 没有找到管理员账号')
    console.log('请运行以下命令创建管理员：')
    console.log('  node create-admin.js')
    console.log('  或')
    console.log('  node create-admin-interactive.js')
    return
  }

  console.log(`找到 ${admins.length} 个管理员账号：\n`)

  admins.forEach((admin, index) => {
    console.log(`${index + 1}. ${admin.name || '(未设置名称)'}`)
    console.log(`   邮箱: ${admin.email}`)
    console.log(`   状态: ${admin.accountStatus}`)
    console.log(`   创建时间: ${admin.createdAt.toLocaleString('zh-CN')}`)
    console.log(`   ID: ${admin.id}`)
    console.log('')
  })

  console.log('================================')
  console.log(`总计: ${admins.length} 个管理员账号`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
