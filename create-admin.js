const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const email = 'admin@example.com'
  const password = 'admin123'
  
  const existingUser = await prisma.user.findUnique({
    where: { email }
  })
  
  if (existingUser) {
    console.log('✓ 管理员账号已存在')
    console.log('邮箱:', email)
    console.log('密码: admin123')
    return
  }
  
  const hashedPassword = await bcrypt.hash(password, 10)
  
  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: '管理员',
      role: 'ADMIN'
    }
  })
  
  console.log('✓ 管理员账号创建成功！')
  console.log('邮箱:', email)
  console.log('密码:', password)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
