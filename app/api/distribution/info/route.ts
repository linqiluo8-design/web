import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// 获取当前用户的分销商信息
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        distributor: {
          include: {
            _count: {
              select: {
                orders: true,
                distributionOrders: true,
                clicks: true,
                withdrawals: true
              }
            }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    if (!user.distributor) {
      return NextResponse.json({ distributor: null })
    }

    // 获取待结算佣金
    const pendingCommission = await prisma.distributionOrder.aggregate({
      where: {
        distributorId: user.distributor.id,
        status: "confirmed"
      },
      _sum: {
        commissionAmount: true
      }
    })

    return NextResponse.json({
      distributor: {
        id: user.distributor.id,
        code: user.distributor.code,
        status: user.distributor.status,
        commissionRate: user.distributor.commissionRate,
        totalEarnings: user.distributor.totalEarnings,
        availableBalance: user.distributor.availableBalance,
        withdrawnAmount: user.distributor.withdrawnAmount,
        pendingCommission: pendingCommission._sum.commissionAmount || 0,
        totalOrders: user.distributor._count.orders,
        totalDistributionOrders: user.distributor._count.distributionOrders,
        totalClicks: user.distributor._count.clicks,
        totalWithdrawals: user.distributor._count.withdrawals,
        appliedAt: user.distributor.appliedAt,
        approvedAt: user.distributor.approvedAt,
        rejectedReason: user.distributor.rejectedReason,
        contactName: user.distributor.contactName,
        contactPhone: user.distributor.contactPhone,
        contactEmail: user.distributor.contactEmail,
        bankName: user.distributor.bankName,
        bankAccount: user.distributor.bankAccount,
        bankAccountName: user.distributor.bankAccountName,
      }
    })
  } catch (error) {
    console.error("获取分销商信息失败:", error)
    return NextResponse.json(
      { error: "获取信息失败，请稍后重试" },
      { status: 500 }
    )
  }
}

// 更新分销商信息
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body = await req.json()
    const { contactName, contactPhone, contactEmail, bankName, bankAccount, bankAccountName } = body

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { distributor: true }
    })

    if (!user || !user.distributor) {
      return NextResponse.json({ error: "您还不是分销商" }, { status: 404 })
    }

    // 更新分销商信息
    const distributor = await prisma.distributor.update({
      where: { id: user.distributor.id },
      data: {
        contactName: contactName || user.distributor.contactName,
        contactPhone: contactPhone || user.distributor.contactPhone,
        contactEmail: contactEmail || user.distributor.contactEmail,
        bankName: bankName !== undefined ? bankName : user.distributor.bankName,
        bankAccount: bankAccount !== undefined ? bankAccount : user.distributor.bankAccount,
        bankAccountName: bankAccountName !== undefined ? bankAccountName : user.distributor.bankAccountName,
      }
    })

    return NextResponse.json({
      success: true,
      message: "信息更新成功",
      distributor: {
        contactName: distributor.contactName,
        contactPhone: distributor.contactPhone,
        contactEmail: distributor.contactEmail,
        bankName: distributor.bankName,
        bankAccount: distributor.bankAccount,
        bankAccountName: distributor.bankAccountName,
      }
    })
  } catch (error) {
    console.error("更新分销商信息失败:", error)
    return NextResponse.json(
      { error: "更新失败，请稍后重试" },
      { status: 500 }
    )
  }
}
