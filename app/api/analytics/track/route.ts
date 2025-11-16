import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import crypto from "crypto"

// 生成访客指纹
function generateVisitorId(ip: string, userAgent: string): string {
  const data = `${ip}-${userAgent}`
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32)
}

// 从 IP 获取地理位置信息（简化版，实际可以对接第三方服务）
function getLocationFromIP(ip: string): { country: string | null; city: string | null } {
  // 简化实现：本地IP返回本地，其他返回未知
  // 实际生产环境可以对接 MaxMind GeoIP、IP-API 等服务
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local', city: 'Local' }
  }
  return { country: null, city: null }
}

// 获取客户端真实 IP
function getClientIP(headersList: Headers): string {
  const xForwardedFor = headersList.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }

  const xRealIp = headersList.get('x-real-ip')
  if (xRealIp) {
    return xRealIp
  }

  return '127.0.0.1'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { path, referer, userId } = body

    // 获取请求头
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || 'Unknown'
    const ipAddress = getClientIP(headersList)

    // 生成访客唯一标识
    const visitorId = generateVisitorId(ipAddress, userAgent)

    // 获取地理位置
    const { country, city } = getLocationFromIP(ipAddress)

    // 记录访问
    await prisma.pageView.create({
      data: {
        visitorId,
        userId: userId || null,
        ipAddress,
        userAgent,
        path,
        referer: referer || null,
        country,
        city,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("记录访问失败:", error)
    // 不要因为统计失败而影响用户体验，返回成功
    return NextResponse.json({ success: true })
  }
}
