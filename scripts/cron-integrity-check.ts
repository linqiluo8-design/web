/**
 * 定时数据完整性检查任务
 *
 * 可配置为 cron job 定期运行，例如每天凌晨检查一次
 *
 * Crontab 配置示例:
 * # 每天凌晨 2:00 检查并修复
 * 0 2 * * * cd /path/to/project && npm run cron:integrity-check >> /var/log/integrity-check.log 2>&1
 *
 * # 每周日凌晨 3:00 检查并修复
 * 0 3 * * 0 cd /path/to/project && npm run cron:integrity-check >> /var/log/integrity-check.log 2>&1
 *
 * 或使用 Node.js 定时器（适合开发环境）:
 * npm run cron:integrity-check
 */

import { validateProductCategories, repairProductCategories } from '../lib/product-helpers'
import { prisma } from '../lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

interface CheckLog {
  timestamp: string
  autoFixed: boolean
  issues: number
  fixed: number
  cleared: number
  errors: number
  details?: any
}

async function logCheck(log: CheckLog) {
  const logDir = path.join(process.cwd(), 'logs')
  const logFile = path.join(logDir, 'integrity-checks.json')

  // 确保日志目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  // 读取现有日志
  let logs: CheckLog[] = []
  if (fs.existsSync(logFile)) {
    try {
      const content = fs.readFileSync(logFile, 'utf-8')
      logs = JSON.parse(content)
    } catch (error) {
      console.warn('⚠️  读取日志文件失败，将创建新日志:', error)
    }
  }

  // 添加新日志
  logs.push(log)

  // 只保留最近 30 天的日志
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  logs = logs.filter(l => new Date(l.timestamp) > thirtyDaysAgo)

  // 写入日志文件
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2))

  console.log(`📝 日志已保存: ${logFile}`)
}

async function sendAlert(log: CheckLog) {
  // 如果发现严重问题，可以在这里发送告警
  // 例如发送邮件、Slack 通知、钉钉通知等

  if (log.issues > 0) {
    console.log('\n🚨 发现数据完整性问题，建议尽快处理!')
    console.log(`   问题数量: ${log.issues}`)
    console.log(`   已修复: ${log.fixed}`)
    console.log(`   已清除: ${log.cleared}`)
    console.log(`   修复失败: ${log.errors}`)

    // TODO: 在这里添加告警通知逻辑
    // 例如:
    // await sendEmail({
    //   to: 'admin@example.com',
    //   subject: '数据完整性检查发现问题',
    //   body: `发现 ${log.issues} 个数据完整性问题...`
    // })
  }
}

async function cronIntegrityCheck() {
  const startTime = new Date()
  console.log('=' .repeat(70))
  console.log('🕐 定时数据完整性检查')
  console.log('=' .repeat(70))
  console.log(`开始时间: ${startTime.toLocaleString('zh-CN')}\n`)

  try {
    // 1. 检查问题
    console.log('🔍 步骤 1: 检查数据完整性...')
    const issues = await validateProductCategories()

    console.log(`\n📊 检查结果: 发现 ${issues.length} 个问题`)

    if (issues.length === 0) {
      console.log('✅ 数据完整性良好，无需修复\n')

      const log: CheckLog = {
        timestamp: startTime.toISOString(),
        autoFixed: false,
        issues: 0,
        fixed: 0,
        cleared: 0,
        errors: 0
      }

      await logCheck(log)

      console.log('=' .repeat(70))
      console.log('✅ 检查完成')
      console.log('=' .repeat(70))
      return
    }

    // 2. 自动修复
    console.log('\n🔧 步骤 2: 自动修复问题...')
    const result = await repairProductCategories()

    console.log(`\n✅ 修复完成:`)
    console.log(`   - 已同步: ${result.fixed} 个商品`)
    console.log(`   - 已清除: ${result.cleared} 个商品`)
    console.log(`   - 失败: ${result.errors} 个商品`)

    // 3. 记录日志
    const log: CheckLog = {
      timestamp: startTime.toISOString(),
      autoFixed: true,
      issues: issues.length,
      fixed: result.fixed,
      cleared: result.cleared,
      errors: result.errors,
      details: issues.slice(0, 10) // 只保留前 10 个问题的详情
    }

    await logCheck(log)

    // 4. 发送告警（如果需要）
    await sendAlert(log)

    const endTime = new Date()
    const duration = (endTime.getTime() - startTime.getTime()) / 1000

    console.log(`\n⏱️  耗时: ${duration.toFixed(2)} 秒`)
    console.log('=' .repeat(70))
    console.log('✅ 定时检查完成')
    console.log('=' .repeat(70))

  } catch (error) {
    console.error('\n❌ 定时检查失败:', error)

    // 记录错误日志
    const log: CheckLog = {
      timestamp: startTime.toISOString(),
      autoFixed: false,
      issues: -1,
      fixed: 0,
      cleared: 0,
      errors: 1,
      details: { error: String(error) }
    }

    await logCheck(log)

    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 执行定时任务
cronIntegrityCheck()
  .then(() => {
    console.log('\n✅ 脚本执行成功')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error)
    process.exit(1)
  })
