import { NextResponse } from 'next/server'
import { getCurrentUser, getUserPermission, PermissionModule } from '@/lib/permissions'

const ALL_MODULES: PermissionModule[] = [
  'CATEGORIES',
  'MEMBERSHIPS',
  'ORDERS',
  'PRODUCTS',
  'BANNERS',
  'SYSTEM_SETTINGS',
  'SECURITY_ALERTS',
  'CUSTOMER_CHAT',
]

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ permissions: {} }, { status: 200 })
    }

    // 获取所有模块的权限
    const permissions: Record<string, string> = {}
    for (const module of ALL_MODULES) {
      const level = await getUserPermission(module, user.id)
      permissions[module] = level
    }

    return NextResponse.json({
      permissions,
      role: user.role,
    })
  } catch (error) {
    console.error('获取权限失败:', error)
    return NextResponse.json({ error: '获取权限失败' }, { status: 500 })
  }
}
