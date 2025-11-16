/**
 * 用户管理 API（管理员专用）
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/permissions'

/**
 * GET /api/admin/users - 获取所有用户列表
 * 查询参数：
 * - status: 筛选账号状态 (PENDING, APPROVED, REJECTED)
 */
export async function GET(req: Request) {
  try {
    // 检查管理员权限
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const users = await prisma.user.findMany({
      where: status
        ? { accountStatus: status as any }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          select: {
            module: true,
            level: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('获取用户列表失败:', error)
    return NextResponse.json(
      { error: error.message || '获取用户列表失败' },
      { status: error.message === '未登录' ? 401 : error.message === '需要管理员权限' ? 403 : 500 }
    )
  }
}
