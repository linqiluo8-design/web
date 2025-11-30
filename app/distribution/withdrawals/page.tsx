"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface DistributorInfo {
  id: string
  code: string
  status: string
  commissionRate: number
  totalEarnings: number
  availableBalance: number
  withdrawnAmount: number
  pendingCommission: number
}

interface Withdrawal {
  id: string
  amount: number
  fee: number
  actualAmount: number
  status: string
  bankName: string
  bankAccount: string
  bankAccountName: string
  rejectedReason?: string
  createdAt: string
  processedAt?: string
  completedAt?: string
}

export default function WithdrawalsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [distributor, setDistributor] = useState<DistributorInfo | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // 提现表单
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    bankName: "",
    bankAccount: "",
    bankAccountName: ""
  })

  useEffect(() => {
    if (status === "authenticated") {
      fetchData()
    } else if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/distribution/withdrawals")
    }
  }, [status, router])

  const fetchData = async () => {
    try {
      const [distributorRes, withdrawalsRes] = await Promise.all([
        fetch("/api/distribution/info"),
        fetch("/api/distribution/withdrawals")
      ])

      const distributorData = await distributorRes.json()
      const withdrawalsData = await withdrawalsRes.json()

      setDistributor(distributorData.distributor)
      setWithdrawals(withdrawalsData.withdrawals || [])
    } catch (error) {
      console.error("获取数据失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(withdrawForm.amount)

    if (isNaN(amount) || amount <= 0) {
      alert("请输入有效的提现金额")
      return
    }

    if (!distributor) {
      alert("获取分销商信息失败")
      return
    }

    if (amount > distributor.availableBalance) {
      alert(`可提现余额不足，当前余额：¥${distributor.availableBalance.toFixed(2)}`)
      return
    }

    if (amount < 100) {
      alert("最低提现金额为 ¥100")
      return
    }

    if (!withdrawForm.bankName || !withdrawForm.bankAccount || !withdrawForm.bankAccountName) {
      alert("请填写完整的银行信息")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/distribution/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          bankName: withdrawForm.bankName,
          bankAccount: withdrawForm.bankAccount,
          bankAccountName: withdrawForm.bankAccountName
        })
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message || "提现申请已提交")
        setShowForm(false)
        setWithdrawForm({
          amount: "",
          bankName: "",
          bankAccount: "",
          bankAccountName: ""
        })
        fetchData()
      } else {
        alert(data.error || "提现申请失败")
      }
    } catch (error) {
      console.error("提现申请失败:", error)
      alert("提现申请失败，请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: "待审核",
      processing: "处理中",
      completed: "已完成",
      rejected: "已拒绝"
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      pending: "text-yellow-600 bg-yellow-50",
      processing: "text-blue-600 bg-blue-50",
      completed: "text-green-600 bg-green-50",
      rejected: "text-red-600 bg-red-50"
    }
    return colorMap[status] || "text-gray-600 bg-gray-50"
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  if (!distributor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">您还不是分销商</h2>
          <p className="text-gray-600 mb-6">
            请先申请成为分销商
          </p>
          <Link
            href="/distribution"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            前往申请
          </Link>
        </div>
      </div>
    )
  }

  if (distributor.status !== "active") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">分销商账户未激活</h2>
          <p className="text-gray-600 mb-6">
            您的分销商账户状态：{distributor.status === "pending" ? "待审核" : distributor.status}
          </p>
          <Link
            href="/distribution"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回分销中心
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 头部导航 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/distribution"
              className="text-blue-600 hover:text-blue-700 mb-2 inline-block"
            >
              ← 返回分销中心
            </Link>
            <h1 className="text-3xl font-bold">佣金提现</h1>
          </div>
        </div>

        {/* 余额卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <p className="text-green-100 text-sm mb-2">可提现余额</p>
            <p className="text-4xl font-bold mb-1">
              ¥{distributor.availableBalance.toFixed(2)}
            </p>
            <p className="text-green-100 text-xs">最低提现金额：¥100</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-2">总收益</p>
            <p className="text-3xl font-bold text-gray-800">
              ¥{distributor.totalEarnings.toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-2">已提现金额</p>
            <p className="text-3xl font-bold text-gray-800">
              ¥{distributor.withdrawnAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* 申请提现按钮/表单 */}
        {!showForm ? (
          <div className="mb-8">
            <button
              onClick={() => setShowForm(true)}
              disabled={distributor.availableBalance < 100}
              className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium shadow-lg transition-all text-lg"
            >
              {distributor.availableBalance < 100
                ? "余额不足（最低¥100）"
                : "申请提现"}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">申请提现</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕ 取消
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  提现金额 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                    ¥
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="100"
                    max={distributor.availableBalance}
                    value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm({...withdrawForm, amount: e.target.value})}
                    className="w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="请输入提现金额"
                    required
                  />
                </div>
                {withdrawForm.amount && parseFloat(withdrawForm.amount) > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    手续费（2%）：¥{(parseFloat(withdrawForm.amount) * 0.02).toFixed(2)} |
                    实际到账：¥{(parseFloat(withdrawForm.amount) * 0.98).toFixed(2)}
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">银行信息</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      银行名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={withdrawForm.bankName}
                      onChange={(e) => setWithdrawForm({...withdrawForm, bankName: e.target.value})}
                      className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="例如：中国工商银行"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      银行账号 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={withdrawForm.bankAccount}
                      onChange={(e) => setWithdrawForm({...withdrawForm, bankAccount: e.target.value})}
                      className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="请输入银行账号"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      账户名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={withdrawForm.bankAccountName}
                      onChange={(e) => setWithdrawForm({...withdrawForm, bankAccountName: e.target.value})}
                      className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="请输入账户名"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ 提示：<br />
                  1. 提现申请提交后，我们会在1-3个工作日内审核<br />
                  2. 审核通过后，款项将在3-5个工作日内到账<br />
                  3. 请确保银行信息准确无误，否则可能导致提现失败<br />
                  4. 每次提现收取2%的手续费
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                  {submitting ? "提交中..." : "确认提现"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 提现记录 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">提现记录</h2>
          </div>

          {withdrawals.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>暂无提现记录</p>
            </div>
          ) : (
            <div className="divide-y">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold">
                          ¥{withdrawal.amount.toFixed(2)}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(withdrawal.status)}`}>
                          {getStatusText(withdrawal.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        手续费：¥{withdrawal.fee.toFixed(2)} |
                        实际到账：¥{withdrawal.actualAmount.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <p>申请时间</p>
                      <p>{new Date(withdrawal.createdAt).toLocaleString("zh-CN")}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">银行：</span>
                        <span className="font-medium">{withdrawal.bankName}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">账号：</span>
                        <span className="font-medium">****{withdrawal.bankAccount}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">户名：</span>
                        <span className="font-medium">{withdrawal.bankAccountName}</span>
                      </div>
                      {withdrawal.completedAt && (
                        <div>
                          <span className="text-gray-600">完成时间：</span>
                          <span className="font-medium">
                            {new Date(withdrawal.completedAt).toLocaleString("zh-CN")}
                          </span>
                        </div>
                      )}
                    </div>

                    {withdrawal.status === "rejected" && withdrawal.rejectedReason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm">
                        <p className="text-red-800">
                          <strong>拒绝原因：</strong>{withdrawal.rejectedReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
