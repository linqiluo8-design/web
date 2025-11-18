import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canWrite, canRead } from "@/lib/permissions"

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
      // 验证管理员身份或客服聊天写权限
      const authSession = await getServerSession(authOptions)
      if (!authSession?.user?.id) {
        return NextResponse.json(
          { error: "需要登录" },
          { status: 401 }
        )
      }

      // 获取用户角色
      const user = await prisma.user.findUnique({
        where: { id: authSession.user.id },
        select: { role: true }
      })

      // 管理员自动拥有所有权限，或检查客服聊天写权限
      const hasPermission = user?.role === 'ADMIN' || await canWrite('CUSTOMER_CHAT', authSession.user.id)
      if (!hasPermission) {
        return NextResponse.json(
          { error: "需要客服聊天权限" },
          { status: 403 }
        )
      }

      senderId = authSession.user.id
      senderName = "客服"
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

    // 检查是否有客服聊天权限
    const authSession = await getServerSession(authOptions)
    const hasPermission = authSession?.user?.id
      ? await canRead('CUSTOMER_CHAT', authSession.user.id)
      : false

    // 安全检查：验证访问权限
    if (!hasPermission) {
      // 非管理员用户需要验证是否是会话的所有者
      const chatSession = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { visitorId: true }
      })

      if (!chatSession) {
        return NextResponse.json(
          { error: "会话不存在" },
          { status: 404 }
        )
      }

      // 验证visitorId是否匹配（从请求头或查询参数获取）
      const requestVisitorId = searchParams.get("visitorId")
      if (chatSession.visitorId !== requestVisitorId) {
        return NextResponse.json(
          { error: "无权访问此会话" },
          { status: 403 }
        )
      }
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

    // 标记对方消息为已读
    if (hasPermission) {
      // 有权限的用户查看时，将访客的未读消息标记为已读
      await prisma.chatMessage.updateMany({
        where: {
          sessionId,
          senderType: "visitor",
          isRead: false
        },
        data: {
          isRead: true
        }
      })
    } else {
      // 访客查看时，将管理员的未读消息标记为已读
      await prisma.chatMessage.updateMany({
        where: {
          sessionId,
          senderType: "admin",
          isRead: false
        },
        data: {
          isRead: true
        }
      })
    }

    return NextResponse.json({ messages })
  } catch (error) {
    console.error("获取消息失败:", error)
    return NextResponse.json(
      { error: "获取消息失败" },
      { status: 500 }
    )
  }
}
