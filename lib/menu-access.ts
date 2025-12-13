/**
 * 菜单访问控制辅助函数
 */
import { prisma } from './prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

// 菜单配置键值映射
const MENU_KEYS = {
  products: "menu_products_enabled",
  cart: "menu_cart_enabled",
  membership: "menu_membership_enabled",
  membershipOrders: "menu_membership_orders_enabled",
  myOrders: "menu_my_orders_enabled",
  distribution: "menu_distribution_enabled"
}

export type MenuModule =
  | 'products'
  | 'cart'
  | 'membership'
  | 'membershipOrders'
  | 'myOrders'
  | 'distribution'

/**
 * 检查菜单模块是否启用
 */
export async function isMenuEnabled(module: MenuModule): Promise<boolean> {
  try {
    const configKey = MENU_KEYS[module]
    if (!configKey) return true // 如果没有配置键，默认启用

    const config = await prisma.systemConfig.findUnique({
      where: { key: configKey },
      select: { value: true }
    })

    // 默认启用
    return config ? config.value === "true" : true
  } catch (error) {
    console.error(`检查菜单 ${module} 状态失败:`, error)
    // 出错时默认启用
    return true
  }
}

/**
 * 要求菜单模块启用（抛出错误）
 * 管理员不受此限制
 */
export async function requireMenuEnabled(module: MenuModule) {
  // 检查是否是管理员
  const session = await getServerSession(authOptions)
  if (session?.user?.role === 'ADMIN') {
    return // 管理员不受限制
  }

  const enabled = await isMenuEnabled(module)
  if (!enabled) {
    throw new Error(`该功能暂未开放`)
  }
}

/**
 * 获取所有菜单配置
 */
export async function getMenuConfig(): Promise<Record<string, boolean>> {
  try {
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

    const menuConfig: Record<string, boolean> = {}
    Object.entries(MENU_KEYS).forEach(([menuKey, configKey]) => {
      const config = configs.find(c => c.key === configKey)
      menuConfig[menuKey] = config ? config.value === "true" : true
    })

    return menuConfig
  } catch (error) {
    console.error('获取菜单配置失败:', error)
    // 返回默认配置（全部启用）
    return {
      products: true,
      cart: true,
      membership: true,
      membershipOrders: true,
      myOrders: true,
      distribution: true
    }
  }
}
