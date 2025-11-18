import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET /api/debug/fix-user-role - 检查并修复用户角色
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    // 获取当前用户信息
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true
      }
    })

    console.log('[DEBUG] Current user:', currentUser)

    // 查找所有没有 role 的用户（使用 Prisma 的原始查询）
    const usersWithNullRole = await prisma.$queryRaw<any[]>`
      SELECT id, email, name, role FROM "User" WHERE role IS NULL
    `

    console.log('[DEBUG] Users with NULL role:', usersWithNullRole)

    // 如果当前用户的 role 是 null，修复它
    if (currentUser && currentUser.role === null) {
      await prisma.user.update({
        where: { id: currentUser.id },
        data: { role: 'ADMIN' } // 假设第一个用户应该是管理员
      })

      console.log('[DEBUG] Fixed role for user:', currentUser.id)
    }

    // 修复所有没有 role 的用户
    const fixedUsers = []
    for (const user of usersWithNullRole) {
      const fixed = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' } // 设置为 ADMIN，您可以根据需要修改
      })
      fixedUsers.push(fixed)
      console.log('[DEBUG] Fixed role for user:', user.id)
    }

    return NextResponse.json({
      currentUser,
      usersWithNullRole,
      fixedUsers,
      message: `Fixed ${fixedUsers.length} users`
    })
  } catch (error) {
    console.error("修复用户角色失败:", error)
    return NextResponse.json(
      { error: "修复失败", details: String(error) },
      { status: 500 }
    )
  }
}
