import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWrite } from "@/lib/permissions"
import { z } from "zod"

// 安全常量配置
const SECURITY_LIMITS = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_URL_LENGTH: 2000,
  MAX_SORT_ORDER: 9999,
  MIN_SORT_ORDER: -100,
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
  if (url.length > SECURITY_LIMITS.MAX_URL_LENGTH) {
    return { valid: false, error: `${fieldName}过长` }
  }

  for (const pattern of SUSPICIOUS_URL_PATTERNS) {
    if (pattern.test(url)) {
      return { valid: false, error: `${fieldName}包含可疑内容` }
    }
  }

  // 支持本地上传路径（以 / 开头）
  if (url.startsWith('/')) {
    // 验证本地路径格式（只允许 /uploads/ 开头的路径）
    if (!url.startsWith('/uploads/')) {
      return { valid: false, error: `${fieldName}路径不安全，仅允许 /uploads/ 路径` }
    }
    // 检查路径遍历攻击
    if (url.includes('..') || url.includes('//')) {
      return { valid: false, error: `${fieldName}包含非法字符` }
    }
    return { valid: true }
  }

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

const updateBannerSchema = z.object({
  title: z.string()
    .min(1, "标题不能为空")
    .max(SECURITY_LIMITS.MAX_TITLE_LENGTH, `标题不能超过${SECURITY_LIMITS.MAX_TITLE_LENGTH}个字符`)
    .optional(),
  image: z.string()
    .min(1, "图片URL不能为空")
    .max(SECURITY_LIMITS.MAX_URL_LENGTH, "图片URL过长")
    .refine(
      (val) => val.startsWith('/uploads/') || val.startsWith('http://') || val.startsWith('https://'),
      "图片必须是有效的URL或上传路径"
    )
    .optional(),
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
    .optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

// 更新轮播图
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 需要轮播图管理的写权限
    const user = await requireWrite('BANNERS')

    const { id } = await params
    const body = await req.json()
    const data = updateBannerSchema.parse(body)

    // 🔒 安全检查1: 验证轮播图是否存在
    const existingBanner = await prisma.banner.findUnique({
      where: { id }
    })

    if (!existingBanner) {
      return NextResponse.json(
        { error: "轮播图不存在" },
        { status: 404 }
      )
    }

    // 🔒 安全检查2: 图片URL安全验证（如果更新）
    if (data.image) {
      const imageValidation = validateURL(data.image, "图片URL")
      if (!imageValidation.valid) {
        await prisma.securityAlert.create({
          data: {
            type: "SUSPICIOUS_URL",
            severity: "high",
            userId: user.id,
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            description: `更新轮播图时图片URL安全检查失败: ${imageValidation.error}`,
            metadata: JSON.stringify({
              bannerId: id,
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
    }

    // 🔒 安全检查3: 链接URL安全验证（如果更新）
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
            description: `更新轮播图时链接URL安全检查失败: ${linkValidation.error}`,
            metadata: JSON.stringify({
              bannerId: id,
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

    // ✅ 更新轮播图
    const banner = await prisma.banner.update({
      where: { id },
      data
    })

    // 📝 记录审计日志
    await prisma.securityAlert.create({
      data: {
        type: "BANNER_UPDATED",
        severity: "info",
        userId: user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        description: `管理员更新了轮播图: ${banner.title}`,
        metadata: JSON.stringify({
          bannerId: id,
          updatedFields: Object.keys(data),
          oldData: {
            title: existingBanner.title,
            status: existingBanner.status,
            sortOrder: existingBanner.sortOrder,
          },
          newData: {
            title: banner.title,
            status: banner.status,
            sortOrder: banner.sortOrder,
          },
        }),
      },
    })

    return NextResponse.json({
      banner,
      message: "轮播图更新成功"
    })

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

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "轮播图不存在" },
        { status: 404 }
      )
    }

    console.error("更新轮播图失败:", error)
    return NextResponse.json(
      { error: "更新轮播图失败" },
      { status: 500 }
    )
  }
}

// 删除轮播图
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 需要轮播图管理的写权限
    const user = await requireWrite('BANNERS')

    const { id } = await params

    // 🔒 安全检查: 获取轮播图信息用于审计日志
    const banner = await prisma.banner.findUnique({
      where: { id }
    })

    if (!banner) {
      return NextResponse.json(
        { error: "轮播图不存在" },
        { status: 404 }
      )
    }

    // ✅ 删除轮播图
    await prisma.banner.delete({
      where: { id }
    })

    // 📝 记录审计日志
    await prisma.securityAlert.create({
      data: {
        type: "BANNER_DELETED",
        severity: "info",
        userId: user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        description: `管理员删除了轮播图: ${banner.title}`,
        metadata: JSON.stringify({
          bannerId: id,
          deletedBanner: {
            title: banner.title,
            image: banner.image,
            link: banner.link,
            status: banner.status,
            sortOrder: banner.sortOrder,
          },
        }),
      },
    })

    return NextResponse.json({
      message: "轮播图删除成功"
    })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "轮播图不存在" },
        { status: 404 }
      )
    }

    console.error("删除轮播图失败:", error)
    return NextResponse.json(
      { error: "删除轮播图失败" },
      { status: 500 }
    )
  }
}
