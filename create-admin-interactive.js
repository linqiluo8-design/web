const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const readline = require('readline')
const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
  console.log('=== 创建管理员账号 ===\n')

  // 获取邮箱
  const email = await question('请输入管理员邮箱: ')
  if (!email || !email.includes('@')) {
    console.log('❌ 邮箱格式不正确')
    rl.close()
    return
  }

  // 检查是否已存在
  const existingUser = await prisma.user.findUnique({
    where: { email }
  })

  if (existingUser) {
    console.log('\n❌ 该邮箱已被使用')
    console.log('现有用户信息:')
    console.log('  邮箱:', existingUser.email)
    console.log('  名称:', existingUser.name)
    console.log('  角色:', existingUser.role)
    console.log('  状态:', existingUser.accountStatus)

    const update = await question('\n是否要将此用户升级为管理员? (y/n): ')
    if (update.toLowerCase() === 'y') {
      await prisma.user.update({
        where: { email },
        data: {
          role: 'ADMIN',
          accountStatus: 'APPROVED'
        }
      })
      console.log('✓ 用户已升级为管理员')
    }
    rl.close()
    return
  }

  // 获取密码
  const password = await question('请输入密码 (至少6位): ')
  if (!password || password.length < 6) {
    console.log('❌ 密码至少需要6位')
    rl.close()
    return
  }

  // 获取名称
  const name = await question('请输入管理员名称 (可选，直接回车跳过): ')

  // 创建管理员
  const hashedPassword = await bcrypt.hash(password, 10)

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || '管理员',
      role: 'ADMIN',
      accountStatus: 'APPROVED'
    }
  })

  console.log('\n✓ 管理员账号创建成功！')
  console.log('================================')
  console.log('邮箱:', email)
  console.log('密码:', password)
  console.log('名称:', admin.name)
  console.log('================================')
  console.log('\n请妥善保管登录信息！')

  rl.close()
}

main()
  .catch(error => {
    console.error('\n❌ 创建失败:', error.message)
    rl.close()
  })
  .finally(() => prisma.$disconnect())
