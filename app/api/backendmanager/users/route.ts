/**
 * 用户管理 API
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRead } from '@/lib/permissions'

/**
 * GET /api/backendmanager/users - 获取所有用户列表
 * 查询参数：
 * - status: 筛选账号状态 (PENDING, APPROVED, REJECTED)
 */
export async function GET(req: Request) {
  try {
    // 检查用户管理的读权限
    await requireRead('USER_MANAGEMENT')

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
      { status: error.message === '未登录' ? 401 : error.message?.includes('权限') ? 403 : 500 }
    )
  }
}
