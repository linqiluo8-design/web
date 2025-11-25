import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

// 申请成为分销商
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body = await req.json()
    const { contactName, contactPhone, contactEmail, bankName, bankAccount, bankAccountName } = body

    // 验证必填字段
    if (!contactName || !contactPhone || !contactEmail) {
      return NextResponse.json({ error: "请填写完整的联系信息" }, { status: 400 })
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { distributor: true }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 检查是否已经是分销商
    if (user.distributor) {
      if (user.distributor.status === "pending") {
        return NextResponse.json({ error: "您的分销商申请正在审核中" }, { status: 400 })
      } else if (user.distributor.status === "active") {
        return NextResponse.json({ error: "您已经是分销商了" }, { status: 400 })
      } else if (user.distributor.status === "rejected") {
        return NextResponse.json({
          error: `您的申请已被拒绝：${user.distributor.rejectedReason || "未说明原因"}`
        }, { status: 400 })
      } else if (user.distributor.status === "suspended") {
        return NextResponse.json({ error: "您的分销商账户已被暂停" }, { status: 400 })
      }
    }

    // 生成唯一的分销商代码（8位随机字符串）
    const generateCode = () => {
      return crypto.randomBytes(4).toString('hex').toUpperCase()
    }

    let code = generateCode()
    // 确保代码唯一
    while (await prisma.distributor.findUnique({ where: { code } })) {
      code = generateCode()
    }

    // 创建分销商申请
    const distributor = await prisma.distributor.create({
      data: {
        userId: user.id,
        code,
        contactName,
        contactPhone,
        contactEmail,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        bankAccountName: bankAccountName || null,
        status: "pending",
        commissionRate: 0.1, // 默认10%佣金
      }
    })

    return NextResponse.json({
      success: true,
      message: "申请已提交，等待审核",
      distributor: {
        id: distributor.id,
        code: distributor.code,
        status: distributor.status,
        appliedAt: distributor.appliedAt
      }
    })
  } catch (error) {
    console.error("分销商申请失败:", error)
    return NextResponse.json(
      { error: "申请失败，请稍后重试" },
      { status: 500 }
    )
  }
}
