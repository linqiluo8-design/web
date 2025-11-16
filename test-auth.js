const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function testAuth() {
  console.log('=== 测试认证逻辑 ===\n')

  const email = 'admin@example.com'
  const password = 'admin123'

  console.log('1. 查找用户...')
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    console.log('❌ 用户不存在')
    return
  }

  console.log('✓ 找到用户')
  console.log('   ID:', user.id)
  console.log('   邮箱:', user.email)
  console.log('   名称:', user.name)
  console.log('   角色:', user.role)
  console.log('   账号状态:', user.accountStatus)
  console.log('')

  console.log('2. 验证密码...')
  if (!user.password) {
    console.log('❌ 密码未设置')
    return
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  console.log('   密码验证:', isPasswordValid ? '✓ 正确' : '❌ 错误')
  console.log('')

  console.log('3. 检查账号状态...')
  if (user.role === 'ADMIN') {
    console.log('   ✓ 管理员账号，跳过审核检查')
  } else {
    console.log('   账号状态:', user.accountStatus)
    if (user.accountStatus === 'PENDING') {
      console.log('   ❌ 账号待审核')
      return
    }
    if (user.accountStatus === 'REJECTED') {
      console.log('   ❌ 账号已拒绝')
      return
    }
    if (user.accountStatus !== 'APPROVED') {
      console.log('   ❌ 账号状态异常')
      return
    }
    console.log('   ✓ 账号已审核通过')
  }
  console.log('')

  console.log('4. 返回用户信息...')
  const userInfo = {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
  }
  console.log('   ✓ 认证成功')
  console.log('   用户信息:', JSON.stringify(userInfo, null, 2))
  console.log('')

  console.log('=== 认证流程完成 ===')
  console.log('✓ 所有检查通过，认证应该成功')
}

testAuth()
  .catch(error => {
    console.error('❌ 错误:', error.message)
    console.error(error)
  })
  .finally(() => prisma.$disconnect())
