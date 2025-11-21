import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { withRateLimit, RateLimitPresets } from "@/lib/rate-limit"

const registerSchema = z.object({
  name: z.string()
    .min(2, "名字至少2个字符")
    .max(100, "名字长度不能超过100个字符"),
  email: z.string()
    .email("请输入有效的邮箱地址")
    .max(254, "邮箱长度不能超过254个字符"), // RFC 5321标准
  password: z.string()
    .min(6, "密码至少6个字符")
    .max(128, "密码长度不能超过128个字符"),
})

export async function POST(req: Request) {
  // 应用速率限制：每小时最多 3 次注册
  return withRateLimit(req, RateLimitPresets.REGISTER, async () => {
    try {
      const body = await req.json()
      const { name, email, password } = registerSchema.parse(body)

      // 检查用户是否已存在
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        return NextResponse.json(
          { error: "该邮箱已被注册" },
          { status: 400 }
        )
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10)

      // 创建用户（默认状态为 PENDING，需要管理员审核）
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          // accountStatus 默认为 PENDING（在 schema 中定义）
        },
        select: {
          id: true,
          name: true,
          email: true,
          accountStatus: true,
          createdAt: true,
        }
      })

      return NextResponse.json(
        {
          user,
          message: "注册成功！您的账号需要管理员审核后才能登录，请耐心等待。"
        },
        { status: 201 }
      )
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: error.errors[0].message },
          { status: 400 }
        )
      }

      console.error("注册错误:", error)
      return NextResponse.json(
        { error: "注册失败，请稍后重试" },
        { status: 500 }
      )
    }
  })
}
