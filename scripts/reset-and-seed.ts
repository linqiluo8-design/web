/**
 * 一键重置数据库并生成测试数据
 *
 * 功能：
 * 1. 清理旧数据库文件
 * 2. 运行迁移创建新数据库结构
 * 3. 生成测试数据：
 *    - 管理员账户
 *    - 测试用户账户
 *    - 会员方案
 *    - 商品分类
 *    - 测试商品
 *    - 系统配置
 *
 * 使用方法：
 * npm run reset-db
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function main() {
  try {
    log('\n🚀 开始重置数据库...\n', 'bright')

    // 1. 删除旧数据库文件
    log('📁 步骤 1/7: 删除旧数据库文件', 'cyan')
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    const dbJournalPath = path.join(process.cwd(), 'prisma', 'dev.db-journal')

    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
      log('  ✓ 删除 dev.db', 'green')
    }

    if (fs.existsSync(dbJournalPath)) {
      fs.unlinkSync(dbJournalPath)
      log('  ✓ 删除 dev.db-journal', 'green')
    }

    // 2. 创建数据库结构（使用 db push 直接根据 schema 创建，避免迁移历史问题）
    log('\n📦 步骤 2/7: 创建数据库结构', 'cyan')
    execSync('npx prisma db push --force-reset --skip-generate', {
      stdio: 'pipe',  // 隐藏输出以保持界面整洁
      env: { ...process.env, DATABASE_URL: 'file:./dev.db' }
    })
    log('  ✓ 数据库结构创建完成', 'green')

    // 3. 生成 Prisma Client
    log('\n🔧 步骤 3/7: 生成 Prisma Client', 'cyan')
    execSync('npx prisma generate', { stdio: 'pipe' })
    log('  ✓ Prisma Client 生成完成', 'green')

    // 4. 创建管理员账户
    log('\n👤 步骤 4/7: 创建管理员账户', 'cyan')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: '管理员',
        password: hashedPassword,
        role: 'ADMIN',
        accountStatus: 'APPROVED',
      }
    })
    log(`  ✓ 管理员账户: admin@example.com / admin123`, 'green')
    log(`  ✓ 用户ID: ${admin.id}`, 'green')

    // 5. 创建测试用户
    log('\n👥 步骤 5/7: 创建测试用户', 'cyan')
    const testUserPassword = await bcrypt.hash('user123', 10)
    const testUser = await prisma.user.create({
      data: {
        email: 'user@example.com',
        name: '测试用户',
        password: testUserPassword,
        role: 'USER',
        accountStatus: 'APPROVED',
      }
    })
    log(`  ✓ 测试用户: user@example.com / user123`, 'green')

    // 6. 创建会员方案
    log('\n💎 步骤 6/7: 创建会员方案', 'cyan')
    const membershipPlans = [
      {
        name: '月度会员',
        price: 29,
        duration: 30,
        discount: 0.9,
        dailyLimit: 5,
        sortOrder: 1,
        status: 'active'
      },
      {
        name: '年度会员',
        price: 88,
        duration: 365,
        discount: 0.8,
        dailyLimit: 10,
        sortOrder: 2,
        status: 'active'
      },
      {
        name: '三年会员',
        price: 188,
        duration: 1095,
        discount: 0.7,
        dailyLimit: 8,
        sortOrder: 3,
        status: 'active'
      },
      {
        name: '终身会员',
        price: 288,
        duration: -1,
        discount: 0.7,
        dailyLimit: 8,
        sortOrder: 4,
        status: 'active'
      }
    ]

    for (const plan of membershipPlans) {
      await prisma.membershipPlan.create({ data: plan })
      log(`  ✓ ${plan.name}: ¥${plan.price} - ${plan.discount * 10}折`, 'green')
    }

    // 7. 创建商品分类
    log('\n📂 步骤 7/7: 创建商品分类', 'cyan')
    const categories = [
      { name: '在线课程', description: '专业技能培训课程', sortOrder: 1 },
      { name: '电子书籍', description: '各类电子书籍资源', sortOrder: 2 },
      { name: '软件工具', description: '实用软件和工具', sortOrder: 3 },
      { name: '会员服务', description: '各类会员权益', sortOrder: 4 },
    ]

    for (const category of categories) {
      await prisma.category.create({ data: category })
      log(`  ✓ ${category.name}`, 'green')
    }

    // 8. 创建系统配置
    log('\n⚙️  步骤 8/7: 创建系统配置', 'cyan')
    const configs = [
      {
        key: 'payment_mode',
        value: 'mock',
        type: 'string',
        category: 'payment',
        description: '支付模式：mock=模拟支付，real=真实支付'
      },
      {
        key: 'payment_alipay_enabled',
        value: 'true',
        type: 'boolean',
        category: 'payment',
        description: '是否启用支付宝支付'
      },
      {
        key: 'payment_wechat_enabled',
        value: 'true',
        type: 'boolean',
        category: 'payment',
        description: '是否启用微信支付'
      },
      {
        key: 'payment_paypal_enabled',
        value: 'true',
        type: 'boolean',
        category: 'payment',
        description: '是否启用PayPal支付'
      },
      {
        key: 'banner_enabled',
        value: 'true',
        type: 'boolean',
        category: 'general',
        description: '是否启用首页轮播图'
      }
    ]

    for (const config of configs) {
      await prisma.systemConfig.create({ data: config })
      log(`  ✓ ${config.key}: ${config.value}`, 'green')
    }

    // 完成
    log('\n✅ 数据库重置完成！\n', 'bright')
    log('📝 测试账户信息：', 'yellow')
    log('   管理员: admin@example.com / admin123', 'yellow')
    log('   用户: user@example.com / user123', 'yellow')
    log('\n📊 数据统计：', 'yellow')
    log(`   👤 用户: 2个`, 'yellow')
    log(`   💎 会员方案: ${membershipPlans.length}个`, 'yellow')
    log(`   📂 商品分类: ${categories.length}个`, 'yellow')
    log(`   ⚙️  系统配置: ${configs.length}个`, 'yellow')
    log('\n🎉 现在可以启动开发服务器了: npm run dev\n', 'bright')

  } catch (error) {
    log('\n❌ 重置失败:', 'red')
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
