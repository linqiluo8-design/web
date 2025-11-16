const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  console.log('=== 检查管理员账号 ===\n')

  const admin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' }
  })

  if (!admin) {
    console.log('❌ 管理员账号不存在！')
    console.log('请运行: node create-admin.js')
    return
  }

  console.log('✓ 找到管理员账号')
  console.log('ID:', admin.id)
  console.log('邮箱:', admin.email)
  console.log('名称:', admin.name)
  console.log('角色:', admin.role)
  console.log('账号状态:', admin.accountStatus)
  console.log('密码哈希:', admin.password ? '已设置' : '未设置')

  // 测试密码
  if (admin.password) {
    const testPassword = 'admin123'
    const isValid = await bcrypt.compare(testPassword, admin.password)
    console.log('\n密码验证 (admin123):', isValid ? '✓ 正确' : '❌ 错误')
  }

  console.log('\n=== 所有用户列表 ===')
  const allUsers = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      role: true,
      accountStatus: true
    }
  })

  console.table(allUsers)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
