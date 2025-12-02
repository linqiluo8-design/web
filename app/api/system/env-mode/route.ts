import { NextResponse } from "next/server"

/**
 * 获取环境模式
 * test/development: 允许 0 天冷静期（用于测试）
 * production: 要求至少 7 天冷静期（安全要求）
 */
export async function GET() {
  const nodeEnv = process.env.NODE_ENV || 'development'

  // test 或 development 环境允许测试模式
  const isTestMode = nodeEnv === 'test' || nodeEnv === 'development'

  return NextResponse.json({
    mode: nodeEnv,
    isTestMode,
    cooldownMinDays: isTestMode ? 0 : 7
  })
}
