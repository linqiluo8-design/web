/**
 * 用户权限管理 API
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, setUserPermissions } from '@/lib/permissions'
import { z } from 'zod'

const permissionSchema = z.object({
  permissions: z.array(
    z.object({
      module: z.enum(['CATEGORIES', 'MEMBERSHIPS', 'ORDERS', 'PRODUCTS']),
      level: z.enum(['NONE', 'READ', 'WRITE']),
    })
  ),
})

/**
 * GET /api/backendmanager/users/[id]/permissions - 获取用户权限
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    // Next.js 16: params 是 Promise，需要 await
    const { id: userId } = await params

    const permissions = await prisma.permission.findMany({
      where: { userId },
      select: {
        module: true,
        level: true,
      },
    })

    return NextResponse.json({ permissions })
  } catch (error: any) {
    console.error('获取用户权限失败:', error)
    return NextResponse.json(
      { error: error.message || '获取用户权限失败' },
      { status: error.message === '未登录' ? 401 : error.message === '需要管理员权限' ? 403 : 500 }
    )
  }
}

/**
 * POST /api/backendmanager/users/[id]/permissions - 设置用户权限
 * Body: {
 *   permissions: [
 *     { module: 'CATEGORIES', level: 'READ' },
 *     { module: 'PRODUCTS', level: 'WRITE' }
 *   ]
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    // Next.js 16: params 是 Promise，需要 await
    const { id: userId } = await params
    const body = await req.json()
    const { permissions } = permissionSchema.parse(body)

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 不能修改管理员的权限
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: '管理员拥有所有权限，无需单独设置' },
        { status: 400 }
      )
    }

    // 设置权限
    await setUserPermissions(userId, permissions)

    // 返回更新后的权限
    const updatedPermissions = await prisma.permission.findMany({
      where: { userId },
      select: {
        module: true,
        level: true,
      },
    })

    return NextResponse.json({
      message: '权限更新成功',
      permissions: updatedPermissions,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    console.error('设置用户权限失败:', error)
    return NextResponse.json(
      { error: error.message || '设置用户权限失败' },
      { status: error.message === '未登录' ? 401 : error.message === '需要管理员权限' ? 403 : 500 }
    )
  }
}
