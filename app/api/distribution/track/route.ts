import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { headers } from "next/headers"

// 分销链接点击追踪
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { code, productId, visitorId } = body

    if (!code || !visitorId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 })
    }

    // 查找分销商
    const distributor = await prisma.distributor.findUnique({
      where: { code }
    })

    if (!distributor) {
      return NextResponse.json({ error: "无效的分销商代码" }, { status: 404 })
    }

    if (distributor.status !== "active") {
      return NextResponse.json({ error: "分销商未激活" }, { status: 403 })
    }

    // 获取请求头信息
    const headersList = headers()
    const ipAddress = headersList.get("x-forwarded-for") ||
                     headersList.get("x-real-ip") ||
                     "unknown"
    const userAgent = headersList.get("user-agent") || ""
    const referer = headersList.get("referer") || ""

    // 记录点击
    const click = await prisma.distributionClick.create({
      data: {
        distributorId: distributor.id,
        productId: productId || null,
        visitorId,
        ipAddress,
        userAgent,
        referer
      }
    })

    // 更新分销商点击统计
    await prisma.distributor.update({
      where: { id: distributor.id },
      data: {
        totalClicks: { increment: 1 }
      }
    })

    // 将分销商代码存储到 cookie 中（有效期7天）
    const response = NextResponse.json({
      success: true,
      distributorCode: code
    })

    response.cookies.set("dist_code", code, {
      maxAge: 7 * 24 * 60 * 60, // 7天
      path: "/"
    })

    return response
  } catch (error) {
    console.error("记录分销点击失败:", error)
    return NextResponse.json(
      { error: "记录失败" },
      { status: 500 }
    )
  }
}

// 获取分销商信息（用于验证分销链接）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json({ error: "缺少分销商代码" }, { status: 400 })
    }

    const distributor = await prisma.distributor.findUnique({
      where: { code },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!distributor) {
      return NextResponse.json({ error: "无效的分销商代码" }, { status: 404 })
    }

    if (distributor.status !== "active") {
      return NextResponse.json({ error: "分销商未激活" }, { status: 403 })
    }

    return NextResponse.json({
      code: distributor.code,
      commissionRate: distributor.commissionRate,
      distributorName: distributor.contactName || distributor.user.name,
      isValid: true
    })
  } catch (error) {
    console.error("获取分销商信息失败:", error)
    return NextResponse.json(
      { error: "获取信息失败" },
      { status: 500 }
    )
  }
}
