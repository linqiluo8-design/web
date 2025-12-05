/**
 * 本地开发环境自动定时结算服务
 * 每4小时自动调用结算API
 */

const SETTLEMENT_API_URL = 'http://localhost:3000/api/cron/settle-commissions'
const INTERVAL_MS = 4 * 60 * 60 * 1000 // 4小时

let consecutiveFailures = 0
const MAX_FAILURES = 3

async function runSettlement() {
  const now = new Date().toLocaleString('zh-CN')
  console.log(`\n[${now}] 🔄 开始执行佣金结算...`)

  try {
    const response = await fetch(SETTLEMENT_API_URL)
    const data = await response.json()

    if (data.success) {
      consecutiveFailures = 0
      console.log(`✅ 结算成功: ${data.message}`)
      console.log(`   - 已结算: ${data.settled} 个订单`)
      if (data.failed > 0) {
        console.log(`   - 失败: ${data.failed} 个订单`)
        if (data.errors && data.errors.length > 0) {
          data.errors.forEach((err: string) => {
            console.log(`     ❌ ${err}`)
          })
        }
      }
    } else {
      consecutiveFailures++
      console.error(`❌ 结算失败: ${data.error || data.message}`)

      if (consecutiveFailures >= MAX_FAILURES) {
        console.error(`\n⚠️  警告：连续失败 ${consecutiveFailures} 次，请检查服务状态！\n`)
      }
    }
  } catch (error) {
    consecutiveFailures++
    console.error(`❌ 调用结算API失败:`, error)

    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error(`\n⚠️  提示：开发服务器未运行，请先启动: npm run dev\n`)
    }

    if (consecutiveFailures >= MAX_FAILURES) {
      console.error(`\n⚠️  警告：连续失败 ${consecutiveFailures} 次，请检查：`)
      console.error(`   1. 开发服务器是否正在运行`)
      console.error(`   2. 数据库连接是否正常`)
      console.error(`   3. ${SETTLEMENT_API_URL} 是否可访问\n`)
    }
  }

  console.log(`⏰ 下次结算时间: ${new Date(Date.now() + INTERVAL_MS).toLocaleString('zh-CN')}`)
}

async function start() {
  console.log('╔═══════════════════════════════════════════════════╗')
  console.log('║   🤖 佣金自动结算服务（开发环境）                  ║')
  console.log('╚═══════════════════════════════════════════════════╝')
  console.log(``)
  console.log(`⚙️  配置:`)
  console.log(`   - API地址: ${SETTLEMENT_API_URL}`)
  console.log(`   - 结算间隔: 每 4 小时`)
  console.log(`   - 立即执行: 是`)
  console.log(``)
  console.log(`💡 提示:`)
  console.log(`   - 测试用户 (test001@example.com, test002@example.com) 享有0天冷静期`)
  console.log(`   - 普通用户订单需等待冷静期（默认15天）后结算`)
  console.log(`   - 按 Ctrl+C 停止服务`)
  console.log(``)

  // 立即执行一次
  await runSettlement()

  // 设置定时任务
  setInterval(runSettlement, INTERVAL_MS)

  console.log(`\n✅ 自动结算服务已启动！`)
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 收到退出信号，正在停止服务...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\n👋 收到终止信号，正在停止服务...')
  process.exit(0)
})

// 启动服务
start().catch((error) => {
  console.error('❌ 启动失败:', error)
  process.exit(1)
})
