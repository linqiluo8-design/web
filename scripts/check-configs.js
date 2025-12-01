// 简单检查数据库配置的脚本
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log("正在检查提现配置...")

  const configs = await prisma.systemConfig.findMany({
    where: {
      category: {
        in: ['withdrawal', 'withdrawal_risk']
      }
    }
  })

  console.log(`找到 ${configs.length} 个配置项:`)
  configs.forEach(config => {
    console.log(`- ${config.key}: ${config.value} (${config.description})`)
  })

  if (configs.length === 0) {
    console.log("\n❌ 没有找到任何配置！需要运行初始化脚本。")
  }
}

main()
  .catch(e => {
    console.error("检查失败:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
