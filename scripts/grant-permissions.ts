import { PrismaClient, PermissionModule, PermissionLevel } from '@prisma/client'

const prisma = new PrismaClient()

// 权限模块的中文描述
const MODULE_NAMES: Record<PermissionModule, string> = {
  CATEGORIES: '分类管理',
  MEMBERSHIPS: '会员管理',
  ORDERS: '订单数据管理',
  PRODUCTS: '商品管理',
  BANNERS: '轮播图管理',
  SYSTEM_SETTINGS: '系统设置',
  SECURITY_ALERTS: '安全警报',
  CUSTOMER_CHAT: '客服聊天',
  USER_MANAGEMENT: '用户管理',
  ORDER_LOOKUP: '订单查询',
  ANALYTICS: '浏览量统计',
  SYSTEM_LOGS: '系统日志管理',
  DISTRIBUTION: '分销管理'
}

const LEVEL_NAMES: Record<PermissionLevel, string> = {
  NONE: '无权限',
  READ: '只读',
  WRITE: '读写'
}

async function grantPermissions(
  email: string,
  modules: Array<{ module: PermissionModule; level: PermissionLevel }>
) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    if (!user) {
      console.error(`❌ 用户不存在: ${email}`)
      process.exit(1)
    }

    console.log('\n📋 用户信息:')
    console.log(`   邮箱: ${user.email}`)
    console.log(`   姓名: ${user.name || '未设置'}`)
    console.log(`   角色: ${user.role === 'ADMIN' ? '管理员' : '普通用户'}`)

    console.log('\n🔧 正在授予以下权限:')

    // 批量创建/更新权限
    for (const { module, level } of modules) {
      await prisma.permission.upsert({
        where: {
          userId_module: {
            userId: user.id,
            module
          }
        },
        update: { level },
        create: {
          userId: user.id,
          module,
          level
        }
      })

      console.log(`   ✓ ${MODULE_NAMES[module]} - ${LEVEL_NAMES[level]}`)
    }

    console.log('\n✅ 权限授予成功!')

  } catch (error: any) {
    console.error(`\n❌ 授权失败:`, error.message)
    process.exit(1)
  }
}

async function revokePermissions(email: string, modules?: PermissionModule[]) {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`❌ 用户不存在: ${email}`)
      process.exit(1)
    }

    if (modules && modules.length > 0) {
      // 移除特定模块权限
      await prisma.permission.deleteMany({
        where: {
          userId: user.id,
          module: {
            in: modules
          }
        }
      })

      console.log(`\n✅ 成功移除 ${modules.length} 个模块的权限`)
      modules.forEach(module => {
        console.log(`   ✓ ${MODULE_NAMES[module]}`)
      })

    } else {
      // 移除所有权限
      const result = await prisma.permission.deleteMany({
        where: {
          userId: user.id
        }
      })

      console.log(`\n✅ 成功移除所有权限 (共 ${result.count} 个)`)
    }

  } catch (error: any) {
    console.error(`\n❌ 操作失败:`, error.message)
    process.exit(1)
  }
}

async function listPermissions(email?: string) {
  try {
    if (email) {
      // 查询特定用户的权限
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          permissions: {
            orderBy: {
              module: 'asc'
            }
          }
        }
      })

      if (!user) {
        console.error(`❌ 用户不存在: ${email}`)
        process.exit(1)
      }

      console.log(`\n📋 ${user.email} 的权限:\n`)
      console.log(`   姓名: ${user.name || '未设置'}`)
      console.log(`   角色: ${user.role === 'ADMIN' ? '管理员' : '普通用户'}`)

      if (user.role === 'ADMIN') {
        console.log('   \n   ⭐ 管理员拥有所有权限\n')
        return
      }

      if (user.permissions.length === 0) {
        console.log('\n   ⚠️  该用户没有任何权限\n')
        return
      }

      console.log('\n   权限列表:')
      user.permissions.forEach(permission => {
        console.log(`     • ${MODULE_NAMES[permission.module]} - ${LEVEL_NAMES[permission.level]}`)
      })
      console.log('')

    } else {
      // 查询所有有权限的用户
      const users = await prisma.user.findMany({
        where: {
          permissions: {
            some: {}
          }
        },
        include: {
          permissions: true
        },
        orderBy: {
          email: 'asc'
        }
      })

      if (users.length === 0) {
        console.log('\n⚠️  没有用户拥有细粒度权限\n')
        return
      }

      console.log(`\n📋 拥有权限的用户 (共 ${users.length} 位):\n`)

      users.forEach(user => {
        console.log(`${user.email}`)
        console.log(`  姓名: ${user.name || '未设置'}`)
        console.log(`  权限数: ${user.permissions.length}`)
        console.log(`  权限列表:`)
        user.permissions.forEach(permission => {
          console.log(`    • ${MODULE_NAMES[permission.module]} - ${LEVEL_NAMES[permission.level]}`)
        })
        console.log('')
      })
    }

  } catch (error: any) {
    console.error(`\n❌ 查询失败:`, error.message)
    process.exit(1)
  }
}

async function main() {
  const command = process.argv[2]
  const email = process.argv[3]

  console.log('================================================')
  console.log('  细粒度权限管理工具')
  console.log('================================================')

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    console.log('\n使用方法:')
    console.log('  npx tsx scripts/grant-permissions.ts grant <email> <preset>  # 授予权限')
    console.log('  npx tsx scripts/grant-permissions.ts revoke <email>          # 移除所有权限')
    console.log('  npx tsx scripts/grant-permissions.ts list [email]            # 查看权限')
    console.log('\n权限预设 (preset):')
    console.log('  customer-service  - 客服人员（客服聊天读写）')
    console.log('  content-editor    - 内容编辑（商品、轮播图读写）')
    console.log('  data-analyst      - 数据分析（订单、统计只读）')
    console.log('  product-manager   - 产品经理（商品、分类、会员读写）')
    console.log('  super-manager     - 高级管理（几乎所有模块读写）')
    console.log('\n示例:')
    console.log('  npx tsx scripts/grant-permissions.ts grant user@example.com customer-service')
    console.log('  npx tsx scripts/grant-permissions.ts list user@example.com')
    console.log('')
    return
  }

  switch (command) {
    case 'grant': {
      const preset = process.argv[4]
      if (!email || !preset) {
        console.error('\n❌ 请提供用户邮箱和权限预设')
        console.log('使用方法: npx tsx scripts/grant-permissions.ts grant <email> <preset>\n')
        process.exit(1)
      }

      let permissions: Array<{ module: PermissionModule; level: PermissionLevel }> = []

      switch (preset) {
        case 'customer-service':
          permissions = [
            { module: 'CUSTOMER_CHAT', level: 'WRITE' },
            { module: 'ORDER_LOOKUP', level: 'READ' }
          ]
          break

        case 'content-editor':
          permissions = [
            { module: 'PRODUCTS', level: 'WRITE' },
            { module: 'BANNERS', level: 'WRITE' },
            { module: 'CATEGORIES', level: 'WRITE' }
          ]
          break

        case 'data-analyst':
          permissions = [
            { module: 'ORDERS', level: 'READ' },
            { module: 'ANALYTICS', level: 'READ' },
            { module: 'SYSTEM_LOGS', level: 'READ' }
          ]
          break

        case 'product-manager':
          permissions = [
            { module: 'PRODUCTS', level: 'WRITE' },
            { module: 'CATEGORIES', level: 'WRITE' },
            { module: 'MEMBERSHIPS', level: 'WRITE' },
            { module: 'BANNERS', level: 'WRITE' },
            { module: 'ORDERS', level: 'READ' }
          ]
          break

        case 'super-manager':
          permissions = [
            { module: 'CATEGORIES', level: 'WRITE' },
            { module: 'PRODUCTS', level: 'WRITE' },
            { module: 'ORDERS', level: 'WRITE' },
            { module: 'MEMBERSHIPS', level: 'WRITE' },
            { module: 'BANNERS', level: 'WRITE' },
            { module: 'CUSTOMER_CHAT', level: 'WRITE' },
            { module: 'ANALYTICS', level: 'READ' },
            { module: 'SYSTEM_LOGS', level: 'READ' },
            { module: 'USER_MANAGEMENT', level: 'READ' }
          ]
          break

        default:
          console.error(`\n❌ 未知的权限预设: ${preset}`)
          console.log('请使用 "help" 命令查看可用的权限预设\n')
          process.exit(1)
      }

      await grantPermissions(email, permissions)
      break
    }

    case 'revoke':
      if (!email) {
        console.error('\n❌ 请提供用户邮箱')
        console.log('使用方法: npx tsx scripts/grant-permissions.ts revoke <email>\n')
        process.exit(1)
      }
      await revokePermissions(email)
      break

    case 'list':
      await listPermissions(email)
      break

    default:
      console.error(`\n❌ 未知命令: ${command}`)
      console.log('使用 "npx tsx scripts/grant-permissions.ts help" 查看帮助\n')
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
