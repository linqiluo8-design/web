import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 菜单配置键值映射
const MENU_KEYS = {
  products: "menu_products_enabled",
  cart: "menu_cart_enabled",
  membership: "menu_membership_enabled",
  membershipOrders: "menu_membership_orders_enabled",
  myOrders: "menu_my_orders_enabled",
  distribution: "menu_distribution_enabled"
}

// GET - 获取菜单配置（公开接口，无需登录）
export async function GET() {
  try {
    // 获取所有菜单配置
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: Object.values(MENU_KEYS)
        }
      },
      select: {
        key: true,
        value: true
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
    // 出错时返回默认配置（全部开启）
    return NextResponse.json({
      success: true,
      config: {
        products: true,
        cart: true,
        membership: true,
        membershipOrders: true,
        myOrders: true,
        distribution: true
      }
    })
  }
}
