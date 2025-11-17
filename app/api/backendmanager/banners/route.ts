import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

// 安全常量配置
const SECURITY_LIMITS = {
  MAX_BANNERS: 50, // 最大轮播图数量
  MAX_TITLE_LENGTH: 200, // 标题最大长度
  MAX_DESCRIPTION_LENGTH: 1000, // 描述最大长度
  MAX_URL_LENGTH: 2000, // URL最大长度
  MAX_SORT_ORDER: 9999, // 最大排序值
  MIN_SORT_ORDER: -100, // 最小排序值（允许少量负数用于置顶）
}

// 恶意URL模式检测
const SUSPICIOUS_URL_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /vbscript:/i,
  /file:/i,
  /<script/i,
  /onclick/i,
  /onerror/i,
]

// URL安全验证函数
function validateURL(url: string, fieldName: string): { valid: boolean; error?: string } {
  // 长度检查
  if (url.length > SECURITY_LIMITS.MAX_URL_LENGTH) {
    return { valid: false, error: `${fieldName}过长` }
  }

  // 恶意模式检查
  for (const pattern of SUSPICIOUS_URL_PATTERNS) {
    if (pattern.test(url)) {
      return { valid: false, error: `${fieldName}包含可疑内容` }
    }
  }

  // 必须是 http/https 协议
  try {
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: `${fieldName}协议不安全` }
    }
  } catch {
    return { valid: false, error: `${fieldName}格式无效` }
  }

  return { valid: true }
}

const bannerSchema = z.object({
  title: z.string()
    .min(1, "标题不能为空")
    .max(SECURITY_LIMITS.MAX_TITLE_LENGTH, `标题不能超过${SECURITY_LIMITS.MAX_TITLE_LENGTH}个字符`),
  image: z.string()
    .url("请输入有效的图片URL")
    .max(SECURITY_LIMITS.MAX_URL_LENGTH, "图片URL过长"),
  link: z.string()
    .max(SECURITY_LIMITS.MAX_URL_LENGTH, "链接URL过长")
    .optional(),
  description: z.string()
    .max(SECURITY_LIMITS.MAX_DESCRIPTION_LENGTH, `描述不能超过${SECURITY_LIMITS.MAX_DESCRIPTION_LENGTH}个字符`)
    .optional(),
  sortOrder: z.number()
    .int("排序值必须是整数")
    .min(SECURITY_LIMITS.MIN_SORT_ORDER, `排序值不能小于${SECURITY_LIMITS.MIN_SORT_ORDER}`)
    .max(SECURITY_LIMITS.MAX_SORT_ORDER, `排序值不能大于${SECURITY_LIMITS.MAX_SORT_ORDER}`)
    .default(0),
  status: z.enum(["active", "inactive"]).default("active"),
})

// 获取所有轮播图
export async function GET(req: Request) {
  try {
    const user = await requireAuth()

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "需要管理员权限" },
        { status: 403 }
      )
    }

    const banners = await prisma.banner.findMany({
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "desc" }
      ]
    })

    return NextResponse.json({ banners })
  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("获取轮播图列表失败:", error)
    return NextResponse.json(
      { error: "获取轮播图列表失败" },
      { status: 500 }
    )
  }
}

// 创建轮播图
export async function POST(req: Request) {
  try {
    const user = await requireAuth()

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "需要管理员权限" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const data = bannerSchema.parse(body)

    // 🔒 安全检查1: 轮播图数量限制
    const bannerCount = await prisma.banner.count()
    if (bannerCount >= SECURITY_LIMITS.MAX_BANNERS) {
      await prisma.securityAlert.create({
        data: {
          type: "EXCESSIVE_BANNER_COUNT",
          severity: "medium",
          userId: user.id,
          ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
          userAgent: req.headers.get("user-agent") || "unknown",
          description: `轮播图数量已达上限 (${bannerCount}/${SECURITY_LIMITS.MAX_BANNERS})`,
          metadata: JSON.stringify({
            currentCount: bannerCount,
            maxAllowed: SECURITY_LIMITS.MAX_BANNERS,
            attemptedData: data,
          }),
        },
      })

      return NextResponse.json(
        { error: `轮播图数量已达上限（${SECURITY_LIMITS.MAX_BANNERS}个）`, code: "EXCESSIVE_BANNER_COUNT" },
        { status: 400 }
      )
    }

    // 🔒 安全检查2: 图片URL安全验证
    const imageValidation = validateURL(data.image, "图片URL")
    if (!imageValidation.valid) {
      await prisma.securityAlert.create({
        data: {
          type: "SUSPICIOUS_URL",
          severity: "high",
          userId: user.id,
          ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
          userAgent: req.headers.get("user-agent") || "unknown",
          description: `轮播图图片URL安全检查失败: ${imageValidation.error}`,
          metadata: JSON.stringify({
            url: data.image,
            error: imageValidation.error,
            field: "image",
          }),
        },
      })

      return NextResponse.json(
        { error: imageValidation.error, code: "SUSPICIOUS_URL" },
        { status: 400 }
      )
    }

    // 🔒 安全检查3: 链接URL安全验证（如果提供）
    if (data.link) {
      const linkValidation = validateURL(data.link, "链接URL")
      if (!linkValidation.valid) {
        await prisma.securityAlert.create({
          data: {
            type: "SUSPICIOUS_URL",
            severity: "high",
            userId: user.id,
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            description: `轮播图链接URL安全检查失败: ${linkValidation.error}`,
            metadata: JSON.stringify({
              url: data.link,
              error: linkValidation.error,
              field: "link",
            }),
          },
        })

        return NextResponse.json(
          { error: linkValidation.error, code: "SUSPICIOUS_URL" },
          { status: 400 }
        )
      }
    }

    // ✅ 创建轮播图
    const banner = await prisma.banner.create({
      data
    })

    // 📝 记录审计日志
    await prisma.securityAlert.create({
      data: {
        type: "BANNER_CREATED",
        severity: "info",
        userId: user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        description: `管理员创建了新轮播图: ${data.title}`,
        metadata: JSON.stringify({
          bannerId: banner.id,
          title: data.title,
          status: data.status,
          sortOrder: data.sortOrder,
        }),
      },
    })

    return NextResponse.json({
      banner,
      message: "轮播图创建成功"
    }, { status: 201 })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("创建轮播图失败:", error)
    return NextResponse.json(
      { error: "创建轮播图失败" },
      { status: 500 }
    )
  }
}
