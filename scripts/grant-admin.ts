import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function grantAdmin(email: string) {
  try {
    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true
      }
    })

    if (!existingUser) {
      console.error(`❌ 用户不存在: ${email}`)
      console.log('\n💡 提示: 请确认邮箱地址是否正确')
      process.exit(1)
    }

    console.log('\n📋 当前用户信息:')
    console.log(`   邮箱: ${existingUser.email}`)
    console.log(`   姓名: ${existingUser.name || '未设置'}`)
    console.log(`   角色: ${existingUser.role === 'ADMIN' ? '管理员' : '普通用户'}`)
    console.log(`   状态: ${existingUser.accountStatus}`)

    if (existingUser.role === 'ADMIN') {
      console.log('\n⚠️  该用户已经是管理员')
      process.exit(0)
    }

    // 更新用户为管理员
    const user = await prisma.user.update({
      where: { email },
      data: {
        role: 'ADMIN',
        accountStatus: 'APPROVED' // 管理员自动批准
      }
    })

    console.log('\n✅ 成功授予管理员权限!')
    console.log(`   用户ID: ${user.id}`)
    console.log(`   邮箱: ${user.email}`)
    console.log(`   姓名: ${user.name || '未设置'}`)
    console.log(`   新角色: 管理员`)
    console.log(`   账号状态: 已批准`)

    console.log('\n🎉 该用户现在拥有:')
    console.log('   ✓ 无限制导出订单')
    console.log('   ✓ 访问所有后台管理功能')
    console.log('   ✓ 查看所有订单和用户数据')
    console.log('   ✓ 管理商品、分类、会员方案')

  } catch (error: any) {
    console.error(`\n❌ 授权失败:`, error.message)
    process.exit(1)
  }
}

async function revokeAdmin(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`❌ 用户不存在: ${email}`)
      process.exit(1)
    }

    if (user.role !== 'ADMIN') {
      console.log('⚠️  该用户不是管理员')
      process.exit(0)
    }

    // 移除管理员权限
    await prisma.user.update({
      where: { email },
      data: {
        role: 'USER'
      }
    })

    console.log(`\n✅ 成功移除 ${email} 的管理员权限`)

  } catch (error: any) {
    console.error(`\n❌ 操作失败:`, error.message)
    process.exit(1)
  }
}

async function listAdmins() {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN'
      },
      select: {
        id: true,
        name: true,
        email: true,
        accountStatus: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            permissions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (admins.length === 0) {
      console.log('\n⚠️  当前没有管理员用户')
      return
    }

    console.log(`\n📋 管理员列表 (共 ${admins.length} 位):\n`)

    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.email}`)
      console.log(`   姓名: ${admin.name || '未设置'}`)
      console.log(`   ID: ${admin.id}`)
      console.log(`   状态: ${admin.accountStatus}`)
      console.log(`   订单数: ${admin._count.orders}`)
      console.log(`   注册时间: ${admin.createdAt.toLocaleDateString('zh-CN')}`)
      console.log('')
    })

  } catch (error: any) {
    console.error(`\n❌ 查询失败:`, error.message)
    process.exit(1)
  }
}

async function main() {
  const command = process.argv[2]
  const email = process.argv[3]

  console.log('================================================')
  console.log('  管理员权限管理工具')
  console.log('================================================')

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    console.log('\n使用方法:')
    console.log('  npx tsx scripts/grant-admin.ts grant <email>    # 授予管理员权限')
    console.log('  npx tsx scripts/grant-admin.ts revoke <email>   # 移除管理员权限')
    console.log('  npx tsx scripts/grant-admin.ts list             # 查看所有管理员')
    console.log('\n示例:')
    console.log('  npx tsx scripts/grant-admin.ts grant admin@example.com')
    console.log('  npx tsx scripts/grant-admin.ts list')
    console.log('')
    return
  }

  switch (command) {
    case 'grant':
      if (!email) {
        console.error('\n❌ 请提供用户邮箱')
        console.log('使用方法: npx tsx scripts/grant-admin.ts grant admin@example.com\n')
        process.exit(1)
      }
      await grantAdmin(email)
      break

    case 'revoke':
      if (!email) {
        console.error('\n❌ 请提供用户邮箱')
        console.log('使用方法: npx tsx scripts/grant-admin.ts revoke admin@example.com\n')
        process.exit(1)
      }
      await revokeAdmin(email)
      break

    case 'list':
      await listAdmins()
      break

    default:
      console.error(`\n❌ 未知命令: ${command}`)
      console.log('使用 "npx tsx scripts/grant-admin.ts help" 查看帮助\n')
      process.exit(1)
  }

  console.log('================================================\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error)
    prisma.$disconnect()
    process.exit(1)
  })
