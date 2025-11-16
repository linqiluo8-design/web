const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 开始创建测试数据...\n')

  // 1. 创建管理员账号
  console.log('1️⃣ 创建管理员账号...')
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
      name: 'Admin User'
    }
  })
  console.log(`   ✓ 管理员创建成功: ${admin.email} (密码: admin123)\n`)

  // 2. 创建测试用户
  console.log('2️⃣ 创建测试用户...')
  const testUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: await bcrypt.hash('user123', 10),
      role: 'USER',
      name: 'Test User'
    }
  })
  console.log(`   ✓ 测试用户创建成功: ${testUser.email} (密码: user123)\n`)

  // 3. 创建分类
  console.log('3️⃣ 创建商品分类...')
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: '课程' },
      update: {},
      create: {
        name: '课程',
        description: '各类在线课程',
        coverImage: 'https://picsum.photos/seed/course/400/300',
        sortOrder: 1
      }
    }),
    prisma.category.upsert({
      where: { name: '电子书' },
      update: {},
      create: {
        name: '电子书',
        description: '电子书籍资源',
        coverImage: 'https://picsum.photos/seed/ebook/400/300',
        sortOrder: 2
      }
    }),
    prisma.category.upsert({
      where: { name: '工具' },
      update: {},
      create: {
        name: '工具',
        description: '实用工具和软件',
        coverImage: 'https://picsum.photos/seed/tools/400/300',
        sortOrder: 3
      }
    }),
    prisma.category.upsert({
      where: { name: '模板' },
      update: {},
      create: {
        name: '模板',
        description: '各类模板资源',
        coverImage: 'https://picsum.photos/seed/template/400/300',
        sortOrder: 4
      }
    })
  ])
  console.log(`   ✓ 创建了 ${categories.length} 个分类\n`)

  // 4. 创建商品
  console.log('4️⃣ 创建测试商品...')
  const products = [
    {
      title: 'Python入门课程',
      description: '从零开始学习Python编程，适合初学者',
      content: '## 课程简介\n\n本课程将带你从零开始学习Python编程语言。\n\n### 课程内容\n- 基础语法\n- 数据结构\n- 面向对象编程\n- 实战项目',
      price: 99.00,
      coverImage: 'https://picsum.photos/seed/python/400/300',
      categoryId: categories[0].id,
      status: 'active',
      showImage: true
    },
    {
      title: 'React前端开发',
      description: 'React全栈开发从入门到精通',
      content: '## React开发课程\n\n掌握现代前端开发技术。\n\n### 学习内容\n- React基础\n- Hooks\n- 状态管理\n- 项目实战',
      price: 159.00,
      coverImage: 'https://picsum.photos/seed/react/400/300',
      categoryId: categories[0].id,
      status: 'active',
      showImage: true
    },
    {
      title: 'JavaScript高级编程',
      description: '深入理解JavaScript核心概念',
      content: '## JavaScript进阶\n\n提升你的JavaScript技能。\n\n### 核心内容\n- 闭包\n- 原型链\n- 异步编程\n- 性能优化',
      price: 129.00,
      coverImage: 'https://picsum.photos/seed/javascript/400/300',
      categoryId: categories[0].id,
      status: 'active',
      showImage: true
    },
    {
      title: 'Web开发完全指南',
      description: '全栈开发工程师必备技能',
      content: '## 全栈开发指南\n\n成为全栈开发工程师。\n\n### 涵盖内容\n- 前端技术\n- 后端开发\n- 数据库\n- 部署运维',
      price: 299.00,
      coverImage: 'https://picsum.photos/seed/webdev/400/300',
      categoryId: categories[0].id,
      status: 'active',
      showImage: true
    },
    {
      title: 'AI人工智能电子书',
      description: '深度学习与人工智能实战',
      content: '## AI电子书\n\n探索人工智能的奥秘。',
      price: 79.00,
      coverImage: 'https://picsum.photos/seed/ai/400/300',
      categoryId: categories[1].id,
      status: 'active',
      showImage: true
    },
    {
      title: '数据科学指南',
      description: '数据分析与机器学习',
      content: '## 数据科学\n\n成为数据科学家。',
      price: 149.00,
      coverImage: 'https://picsum.photos/seed/datascience/400/300',
      categoryId: categories[1].id,
      status: 'active',
      showImage: true
    },
    {
      title: '代码编辑器VSCode插件包',
      description: '提升开发效率的必备工具',
      content: '## VSCode插件\n\n增强你的开发体验。',
      price: 49.00,
      coverImage: 'https://picsum.photos/seed/vscode/400/300',
      categoryId: categories[2].id,
      status: 'active',
      showImage: true
    },
    {
      title: '项目管理工具包',
      description: '敏捷开发必备工具集',
      content: '## 项目管理\n\n提升团队协作效率。',
      price: 199.00,
      coverImage: 'https://picsum.photos/seed/pm/400/300',
      categoryId: categories[2].id,
      status: 'active',
      showImage: true
    },
    {
      title: '网站UI设计模板',
      description: '精美的网站设计模板',
      content: '## UI模板\n\n快速搭建精美网站。',
      price: 89.00,
      coverImage: 'https://picsum.photos/seed/uitemplate/400/300',
      categoryId: categories[3].id,
      status: 'active',
      showImage: true
    },
    {
      title: '移动应用UI套件',
      description: '移动端设计资源',
      content: '## 移动UI\n\n完整的移动端设计方案。',
      price: 119.00,
      coverImage: 'https://picsum.photos/seed/mobileui/400/300',
      categoryId: categories[3].id,
      status: 'active',
      showImage: true
    },
    {
      title: 'Docker容器化教程',
      description: 'Docker从入门到实战',
      content: '## Docker教程\n\n掌握容器化技术。',
      price: 169.00,
      coverImage: 'https://picsum.photos/seed/docker/400/300',
      categoryId: categories[0].id,
      status: 'active',
      showImage: true
    },
    {
      title: 'Node.js后端开发',
      description: '服务端JavaScript开发',
      content: '## Node.js开发\n\n构建高性能后端服务。',
      price: 139.00,
      coverImage: 'https://picsum.photos/seed/nodejs/400/300',
      categoryId: categories[0].id,
      status: 'active',
      showImage: true
    }
  ]

  let createdCount = 0
  for (const productData of products) {
    await prisma.product.create({
      data: productData
    })
    createdCount++
  }
  console.log(`   ✓ 创建了 ${createdCount} 个商品\n`)

  // 5. 创建会员方案
  console.log('5️⃣ 创建会员方案...')
  const plans = await Promise.all([
    prisma.membershipPlan.upsert({
      where: { name: '月度会员' },
      update: {},
      create: {
        name: '月度会员',
        price: 29.00,
        duration: 30,
        discount: 0.9, // 9折
        dailyLimit: 5,
        status: 'active',
        sortOrder: 1
      }
    }),
    prisma.membershipPlan.upsert({
      where: { name: '季度会员' },
      update: {},
      create: {
        name: '季度会员',
        price: 79.00,
        duration: 90,
        discount: 0.85, // 8.5折
        dailyLimit: 10,
        status: 'active',
        sortOrder: 2
      }
    }),
    prisma.membershipPlan.upsert({
      where: { name: '年度会员' },
      update: {},
      create: {
        name: '年度会员',
        price: 299.00,
        duration: 365,
        discount: 0.8, // 8折
        dailyLimit: 20,
        status: 'active',
        sortOrder: 3
      }
    })
  ])
  console.log(`   ✓ 创建了 ${plans.length} 个会员方案\n`)

  console.log('✅ 所有测试数据创建完成!\n')
  console.log('📊 数据统计:')
  console.log(`   - 管理员: 1 个`)
  console.log(`   - 用户: 1 个`)
  console.log(`   - 分类: ${categories.length} 个`)
  console.log(`   - 商品: ${createdCount} 个`)
  console.log(`   - 会员方案: ${plans.length} 个\n`)

  console.log('🔑 登录信息:')
  console.log(`   管理员: admin@example.com / admin123`)
  console.log(`   用户: user@example.com / user123\n`)
}

main()
  .catch((e) => {
    console.error('❌ 创建测试数据失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
