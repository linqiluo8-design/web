import { NextResponse } from "next/server"
import { requireRead } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

// GET /api/backendmanager/chat - 获取所有聊天会话
export async function GET() {
  try {
    // 需要客服聊天的读权限
    await requireRead('CUSTOMER_CHAT')

    // 计算15天前的时间
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

    // 获取所有活跃的聊天会话（排除超过15天未活跃的会话）
    const sessions = await prisma.chatSession.findMany({
      where: {
        status: "active",
        lastMessageAt: {
          gte: fifteenDaysAgo // 只显示最后消息时间在15天内的会话
        }
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
