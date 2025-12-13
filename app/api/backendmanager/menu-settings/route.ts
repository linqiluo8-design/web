import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/permissions"

// 菜单配置键值映射
const MENU_KEYS = {
  products: "menu_products_enabled",
  cart: "menu_cart_enabled",
  membership: "menu_membership_enabled",
  membershipOrders: "menu_membership_orders_enabled",
  myOrders: "menu_my_orders_enabled",
  distribution: "menu_distribution_enabled"
}

// GET - 获取菜单配置
export async function GET() {
  try {
    await requireAdmin()

    // 获取所有菜单配置
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: Object.values(MENU_KEYS)
        }
      }
    })

    // 构建配置对象
    const menuConfig: Record<string, boolean> = {}
    Object.entries(MENU_KEYS).forEach(([menuKey, configKey]) => {
      const config = configs.find(c => c.key === configKey)
      // 默认都是开启的
      menuConfig[menuKey] = config ? config.value === "true" : true
    })

    return NextResponse.json({
      success: true,
      config: menuConfig
    })
  } catch (error: any) {
    console.error("获取菜单配置失败:", error)
    return NextResponse.json(
      { error: error.message || "获取配置失败" },
      {
        status: error.message === '未登录' ? 401 :
                error.message?.includes('管理员') ? 403 :
                500
      }
    )
  }
}

// POST - 更新菜单配置
export async function POST(req: Request) {
  try {
    await requireAdmin()

    const body = await req.json()
    const { menuKey, enabled } = body

    if (!menuKey || !Object.keys(MENU_KEYS).includes(menuKey)) {
      return NextResponse.json(
        { error: "无效的菜单键" },
        { status: 400 }
      )
    }

    const configKey = MENU_KEYS[menuKey as keyof typeof MENU_KEYS]
    const now = new Date()

    // 使用事务同时更新配置和时间戳
    await prisma.$transaction([
      // 更新菜单配置
      prisma.systemConfig.upsert({
        where: { key: configKey },
        update: {
          value: enabled.toString(),
          updatedAt: now
        },
        create: {
          key: configKey,
          value: enabled.toString(),
          type: "boolean",
          category: "menu",
          description: `菜单项 ${menuKey} 是否启用`
        }
      }),
      // 更新菜单配置的最后更新时间戳
      prisma.systemConfig.upsert({
        where: { key: "menu_config_updated_at" },
        update: {
          value: now.getTime().toString(),
          updatedAt: now
        },
        create: {
          key: "menu_config_updated_at",
          value: now.getTime().toString(),
          type: "string",
          category: "menu",
          description: "菜单配置最后更新时间戳"
        }
      })
    ])

    return NextResponse.json({
      success: true,
      message: "配置更新成功"
    })
  } catch (error: any) {
    console.error("更新菜单配置失败:", error)
    return NextResponse.json(
      { error: error.message || "更新配置失败" },
      {
        status: error.message === '未登录' ? 401 :
                error.message?.includes('管理员') ? 403 :
                500
      }
    )
  }
}
