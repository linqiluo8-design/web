import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRead, requireWrite } from "@/lib/permissions"
import { z } from "zod"

const configSchema = z.object({
  key: z.string().min(1, "配置键不能为空"),
  value: z.string(),
  type: z.enum(["boolean", "string", "number", "json"]),
  category: z.string(),
  description: z.string().optional(),
})

// 获取所有系统配置
export async function GET(req: Request) {
  try {
    // 需要系统设置的读权限
    await requireRead('SYSTEM_SETTINGS')

    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")

    const where = category ? { category } : {}

    const configs = await prisma.systemConfig.findMany({
      where,
      orderBy: { key: "asc" }
    })

    return NextResponse.json({ configs })
  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("获取系统配置失败:", error)
    return NextResponse.json(
      { error: "获取系统配置失败" },
      { status: 500 }
    )
  }
}

// 创建或更新系统配置
export async function POST(req: Request) {
  try {
    // 需要系统设置的写权限
    await requireWrite('SYSTEM_SETTINGS')

    const body = await req.json()
    const data = configSchema.parse(body)

    // 使用 upsert 创建或更新配置
    const config = await prisma.systemConfig.upsert({
      where: { key: data.key },
      update: {
        value: data.value,
        type: data.type,
        category: data.category,
        description: data.description,
      },
      create: data
    })

    return NextResponse.json({
      config,
      message: "配置保存成功"
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

    console.error("保存配置失败:", error)
    return NextResponse.json(
      { error: "保存配置失败" },
      { status: 500 }
    )
  }
}

// 批量更新配置
export async function PUT(req: Request) {
  try {
    // 需要系统设置的写权限
    await requireWrite('SYSTEM_SETTINGS')

    const body = await req.json()
    const { configs } = body

    if (!Array.isArray(configs)) {
      return NextResponse.json(
        { error: "configs 必须是数组" },
        { status: 400 }
      )
    }

    // 批量更新
    const results = await Promise.all(
      configs.map((config: any) =>
        prisma.systemConfig.upsert({
          where: { key: config.key },
          update: {
            value: config.value,
          },
          create: {
            key: config.key,
            value: config.value,
            type: config.type || "string",
            category: config.category || "general",
            description: config.description,
          }
        })
      )
    )

    return NextResponse.json({
      configs: results,
      message: "配置批量更新成功"
    })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("批量更新配置失败:", error)
    return NextResponse.json(
      { error: "批量更新配置失败" },
      { status: 500 }
    )
  }
}
