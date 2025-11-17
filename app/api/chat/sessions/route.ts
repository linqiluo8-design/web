import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET /api/chat/sessions - 获取或创建聊天会话
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const visitorId = searchParams.get("visitorId")

    if (!visitorId) {
      return NextResponse.json(
        { error: "缺少访客ID" },
        { status: 400 }
      )
    }

    // 尝试获取当前用户
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null

    // 查找现有的活跃会话
    let chatSession = await prisma.chatSession.findFirst({
      where: {
        visitorId,
        status: "active"
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100 // 最近100条消息
        }
      }
    })

    // 如果没有会话，创建新会话
    if (!chatSession) {
      chatSession = await prisma.chatSession.create({
        data: {
          visitorId,
          userId,
          status: "active"
        },
        include: {
          messages: true
        }
      })
    }

    return NextResponse.json({ session: chatSession })
  } catch (error) {
    console.error("获取聊天会话失败:", error)
    return NextResponse.json(
      { error: "获取聊天会话失败" },
      { status: 500 }
    )
  }
}

// POST /api/chat/sessions - 创建新会话（显式创建）
export async function POST(req: Request) {
  try {
    const { visitorId, visitorName, visitorEmail } = await req.json()

    if (!visitorId) {
      return NextResponse.json(
        { error: "缺少访客ID" },
        { status: 400 }
      )
    }

    // 尝试获取当前用户
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null

    // 创建新会话
    const chatSession = await prisma.chatSession.create({
      data: {
        visitorId,
        userId,
        visitorName,
        visitorEmail,
        status: "active"
      },
      include: {
        messages: true
      }
    })

    return NextResponse.json({ session: chatSession })
  } catch (error) {
    console.error("创建聊天会话失败:", error)
    return NextResponse.json(
      { error: "创建聊天会话失败" },
      { status: 500 }
    )
  }
}
