import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/backendmanager/chat - 获取所有聊天会话（管理员）
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "需要管理员权限" },
        { status: 403 }
      )
    }

    // 获取所有活跃的聊天会话
    const sessions = await prisma.chatSession.findMany({
      where: {
        status: "active"
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1 // 只获取最后一条消息
        }
      },
      orderBy: {
        lastMessageAt: "desc"
      }
    })

    // 统计未读消息数
    const sessionsWithUnread = await Promise.all(
      sessions.map(async (session) => {
        const unreadCount = await prisma.chatMessage.count({
          where: {
            sessionId: session.id,
            senderType: "visitor",
            isRead: false
          }
        })

        return {
          ...session,
          unreadCount
        }
      })
    )

    return NextResponse.json({ sessions: sessionsWithUnread })
  } catch (error) {
    console.error("获取聊天会话失败:", error)
    return NextResponse.json(
      { error: "获取聊天会话失败" },
      { status: 500 }
    )
  }
}
