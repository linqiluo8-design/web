import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    console.log('=== 测试登录 API ===')
    console.log('邮箱:', email)

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.log('❌ 用户不存在')
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    console.log('✓ 找到用户:', user.email)
    console.log('角色:', user.role)
    console.log('状态:', user.accountStatus)

    if (!user.password) {
      console.log('❌ 密码未设置')
      return NextResponse.json({ error: '密码未设置' }, { status: 400 })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    console.log('密码验证:', isPasswordValid ? '✓ 正确' : '❌ 错误')

    if (!isPasswordValid) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    // 检查账号状态（管理员跳过）
    if (user.role !== 'ADMIN') {
      if (user.accountStatus !== 'APPROVED') {
        console.log('❌ 账号未审核:', user.accountStatus)
        return NextResponse.json({ error: '账号未审核' }, { status: 403 })
      }
    } else {
      console.log('✓ 管理员账号，跳过审核')
    }

    console.log('✓ 认证成功')

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accountStatus: user.accountStatus
      }
    })

  } catch (error) {
    console.error('测试登录失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
