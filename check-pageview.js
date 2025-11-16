const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPageViewModel() {
  console.log('=== 检查 PageView 模型 ===\n')

  try {
    // 检查 prisma.pageView 是否存在
    if (!prisma.pageView) {
      console.log('❌ prisma.pageView 未定义')
      console.log('请运行: npx prisma generate')
      return
    }

    console.log('✓ prisma.pageView 已定义')

    // 尝试创建测试数据
    console.log('\n测试创建 PageView...')
    const testView = await prisma.pageView.create({
      data: {
        visitorId: 'test-visitor-id',
        ipAddress: '127.0.0.1',
        path: '/test',
        userAgent: 'Test Agent'
      }
    })

    console.log('✓ PageView 创建成功')
    console.log('  ID:', testView.id)

    // 测试查询
    console.log('\n测试查询 PageView...')
    const count = await prisma.pageView.count()
    console.log('✓ 当前 PageView 记录数:', count)

    // 删除测试数据
    console.log('\n清理测试数据...')
    await prisma.pageView.delete({
      where: { id: testView.id }
    })
    console.log('✓ 测试数据已清理')

    console.log('\n=== 检查完成 ===')
    console.log('✓ PageView 模型工作正常！')

  } catch (error) {
    console.error('\n❌ 错误:', error.message)
    console.error('\n请执行以下命令修复：')
    console.error('  1. npx prisma generate')
    console.error('  2. npx prisma db push')
  }
}

checkPageViewModel()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
