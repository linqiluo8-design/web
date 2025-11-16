import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 获取公开的系统配置（只返回需要暴露给前端的配置）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const keys = searchParams.get("keys")?.split(",") || []

    // 定义允许公开访问的配置键
    const allowedPublicKeys = [
      "banner_enabled",
      "payment_alipay_enabled",
      "payment_wechat_enabled",
      "payment_paypal_enabled",
    ]

    // 过滤只返回允许公开的配置
    const keysToFetch = keys.length > 0
      ? keys.filter(k => allowedPublicKeys.includes(k))
      : allowedPublicKeys

    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: keysToFetch
        }
      },
      select: {
        key: true,
        value: true,
        type: true,
      }
    })

    // 转换为键值对格式
    const configMap: Record<string, any> = {}
    configs.forEach(config => {
      // 根据类型转换值
      switch (config.type) {
        case "boolean":
          configMap[config.key] = config.value === "true"
          break
        case "number":
          configMap[config.key] = parseFloat(config.value)
          break
        case "json":
          try {
            configMap[config.key] = JSON.parse(config.value)
          } catch {
            configMap[config.key] = config.value
          }
          break
        default:
          configMap[config.key] = config.value
      }
    })

    // 设置默认值（如果配置不存在）
    const defaults: Record<string, any> = {
      banner_enabled: true,
      payment_alipay_enabled: true,
      payment_wechat_enabled: true,
      payment_paypal_enabled: true,
    }

    // 合并默认值
    const result = { ...defaults, ...configMap }

    return NextResponse.json(result)
  } catch (error) {
    console.error("获取系统配置失败:", error)
    return NextResponse.json(
      { error: "获取系统配置失败" },
      { status: 500 }
    )
  }
}
