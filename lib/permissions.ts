/**
 * 权限管理工具
 */
import { prisma } from './prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export type PermissionModule = 'CATEGORIES' | 'MEMBERSHIPS' | 'ORDERS' | 'PRODUCTS'
export type PermissionLevel = 'NONE' | 'READ' | 'WRITE'

/**
 * 获取当前登录用户
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      permissions: true,
    },
  })

  return user
}

/**
 * 检查用户是否有管理员权限
 */
export async function isAdmin(userId?: string): Promise<boolean> {
  if (!userId) {
    const user = await getCurrentUser()
    if (!user) return false
    return user.role === 'ADMIN'
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  return user?.role === 'ADMIN'
}

/**
 * 获取用户在特定模块的权限级别
 */
export async function getUserPermission(
  module: PermissionModule,
  userId?: string
): Promise<PermissionLevel> {
  // 如果没有提供 userId，从当前会话获取
  let user
  if (!userId) {
    user = await getCurrentUser()
    if (!user) return 'NONE'
    userId = user.id
  }

  // 管理员拥有所有权限
  if (!user) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
  }

  if (user?.role === 'ADMIN') {
    return 'WRITE'
  }

  // 查询用户在该模块的权限
  const permission = await prisma.permission.findUnique({
    where: {
      userId_module: {
        userId: userId!,
        module,
      },
    },
  })

  return permission?.level || 'NONE'
}

/**
 * 检查用户是否有读权限
 */
export async function canRead(module: PermissionModule, userId?: string): Promise<boolean> {
  const level = await getUserPermission(module, userId)
  return level === 'READ' || level === 'WRITE'
}

/**
 * 检查用户是否有写权限
 */
export async function canWrite(module: PermissionModule, userId?: string): Promise<boolean> {
  const level = await getUserPermission(module, userId)
  return level === 'WRITE'
}

/**
 * 要求管理员权限（抛出错误）
 */
export async function requireAdmin() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('未登录')
  }

  if (user.role !== 'ADMIN') {
    throw new Error('需要管理员权限')
  }

  return user
}

/**
 * 要求读权限（抛出错误）
 */
export async function requireRead(module: PermissionModule) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('未登录')
  }

  // 管理员拥有所有权限
  if (user.role === 'ADMIN') {
    return user
  }

  const hasPermission = await canRead(module, user.id)
  if (!hasPermission) {
    throw new Error(`您没有访问${getModuleName(module)}的权限`)
  }

  return user
}

/**
 * 要求写权限（抛出错误）
 */
export async function requireWrite(module: PermissionModule) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('未登录')
  }

  // 管理员拥有所有权限
  if (user.role === 'ADMIN') {
    return user
  }

  const hasPermission = await canWrite(module, user.id)
  if (!hasPermission) {
    throw new Error(`您没有修改${getModuleName(module)}的权限`)
  }

  return user
}

/**
 * 获取模块中文名称
 */
function getModuleName(module: PermissionModule): string {
  const names: Record<PermissionModule, string> = {
    CATEGORIES: '分类管理',
    MEMBERSHIPS: '会员管理',
    ORDERS: '订单数据',
    PRODUCTS: '商品管理',
  }
  return names[module] || module
}

/**
 * 批量设置用户权限
 */
export async function setUserPermissions(
  userId: string,
  permissions: { module: PermissionModule; level: PermissionLevel }[]
) {
  // 删除现有权限
  await prisma.permission.deleteMany({
    where: { userId },
  })

  // 创建新权限（跳过 NONE 级别）
  const validPermissions = permissions.filter((p) => p.level !== 'NONE')
  if (validPermissions.length > 0) {
    await prisma.permission.createMany({
      data: validPermissions.map((p) => ({
        userId,
        module: p.module,
        level: p.level,
      })),
    })
  }
}
