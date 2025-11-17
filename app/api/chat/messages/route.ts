import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// POST /api/chat/messages - 发送聊天消息
export async function POST(req: Request) {
  try {
    const { sessionId, message, senderType, visitorId } = await req.json()

    if (!sessionId || !message || !senderType) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 验证会话是否存在
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    })

    if (!session) {
      return NextResponse.json(
        { error: "聊天会话不存在" },
        { status: 404 }
      )
    }

    // 获取发送者信息
    let senderId: string | null = null
    let senderName: string | null = null

    if (senderType === "admin") {
      // 验证管理员身份
      const authSession = await getServerSession(authOptions)
      if (!authSession || authSession.user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "需要管理员权限" },
          { status: 403 }
        )
      }
      senderId = authSession.user.id
      senderName = authSession.user.name || "管理员"
    } else if (senderType === "visitor") {
      senderId = visitorId || null
      senderName = session.visitorName || "访客"
    }

    // 创建消息
    const chatMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        senderType,
        senderId,
        senderName,
        message
      }
    })

    // 更新会话的最后消息时间
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { lastMessageAt: new Date() }
    })

    return NextResponse.json({ message: chatMessage })
  } catch (error) {
    console.error("发送消息失败:", error)
    return NextResponse.json(
      { error: "发送消息失败" },
      { status: 500 }
    )
  }
}

// GET /api/chat/messages - 获取会话消息
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get("sessionId")
    const since = searchParams.get("since") // 获取某个时间之后的消息

    if (!sessionId) {
      return NextResponse.json(
        { error: "缺少会话ID" },
        { status: 400 }
      )
    }

    // 构建查询条件
    const where: any = { sessionId }
    if (since) {
      where.createdAt = {
        gt: new Date(since)
      }
    }

    // 获取消息
    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 100 // 限制最多100条
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error("获取消息失败:", error)
    return NextResponse.json(
      { error: "获取消息失败" },
      { status: 500 }
    )
  }
}
