/**
 * 批准用户 API
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/permissions'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 检查管理员权限
    await requireAdmin()

    const userId = params.id

    // 更新用户状态为已批准
    const user = await prisma.user.update({
      where: { id: userId },
      data: { accountStatus: 'APPROVED' },
      select: {
        id: true,
        name: true,
        email: true,
        accountStatus: true,
      },
    })

    return NextResponse.json({
      message: '用户已批准',
      user,
    })
  } catch (error: any) {
    console.error('批准用户失败:', error)
    return NextResponse.json(
      { error: error.message || '批准用户失败' },
      { status: error.message === '未登录' ? 401 : error.message === '需要管理员权限' ? 403 : 500 }
    )
  }
}
