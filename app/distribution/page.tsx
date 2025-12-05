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
  totalOrders: number
  totalDistributionOrders: number
  totalClicks: number
  appliedAt: string
  approvedAt?: string
  rejectedReason?: string
}

interface Stats {
  overview: {
    totalOrders: number
    pendingOrders: number
    confirmedOrders: number
    settledOrders: number
    totalCommission: number
    pendingCommission: number
    settledCommission: number
    availableBalance: number
    withdrawnAmount: number
  }
  recentOrders: Array<{
    id: string
    orderNumber: string
    orderAmount: number
    commissionAmount: number
    status: string
    createdAt: string
  }>
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

export default function DistributionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [distributor, setDistributor] = useState<DistributorInfo | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'orders' | 'withdrawals'>('orders')

  // 申请表单
  const [applyForm, setApplyForm] = useState({
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    bankName: "",
    bankAccount: "",
    bankAccountName: ""
  })

  // 提现表单
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    bankName: "",
    bankAccount: "",
    bankAccountName: ""
  })

  useEffect(() => {
    // 允许匿名用户访问页面，只在登录时才获取分销商信息
    if (status === "authenticated" && session?.user) {
      fetchDistributorInfo()
    } else if (status === "unauthenticated") {
      // 匿名用户也能看到页面，只是不加载分销商信息
      setLoading(false)
    }
  }, [status, session])

  useEffect(() => {
    if (distributor?.status === "active") {
      fetchStats()
      fetchWithdrawals()
    }
  }, [distributor])

  const fetchDistributorInfo = async () => {
    try {
      const response = await fetch("/api/distribution/info")
      const data = await response.json()
      setDistributor(data.distributor)
      setLoading(false)
    } catch (error) {
      console.error("获取分销商信息失败:", error)
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/distribution/stats?type=overview")
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("获取统计数据失败:", error)
    }
  }

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch("/api/distribution/withdrawals")
      const data = await response.json()
      setWithdrawals(data.withdrawals || [])
    } catch (error) {
      console.error("获取提现记录失败:", error)
    }
  }

  const handleApply = async () => {
    // 检查用户是否已登录
    if (!session?.user) {
      if (confirm("申请成为分销商需要先登录，是否前往登录页面？")) {
        router.push("/auth/signin?callbackUrl=/distribution")
      }
      return
    }

    if (!applyForm.contactName || !applyForm.contactPhone || !applyForm.contactEmail) {
      alert("请填写完整的联系信息")
      return
    }

    setApplying(true)
    try {
      const response = await fetch("/api/distribution/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applyForm)
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        fetchDistributorInfo()
        setShowApplyForm(false)
      } else {
        alert(data.error || "申请失败")
      }
    } catch (error) {
      console.error("申请失败:", error)
      alert("申请失败，请稍后重试")
    } finally {
      setApplying(false)
    }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
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
        setShowWithdrawModal(false)
        setWithdrawForm({
          amount: "",
          bankName: "",
          bankAccount: "",
          bankAccountName: ""
        })
        // 刷新数据
        fetchDistributorInfo()
        fetchWithdrawals()
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

  const copyLink = (productId?: string) => {
    const baseUrl = window.location.origin
    const link = productId
      ? `${baseUrl}/products/${productId}?dist=${distributor?.code}`
      : `${baseUrl}/products?dist=${distributor?.code}`

    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: "待审核",
      processing: "处理中",
      completed: "已完成",
      rejected: "已拒绝",
      confirmed: "已确认",
      settled: "已结算"
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      pending: "text-yellow-600 bg-yellow-50",
      processing: "text-blue-600 bg-blue-50",
      completed: "text-green-600 bg-green-50",
      rejected: "text-red-600 bg-red-50",
      confirmed: "text-blue-600 bg-blue-50",
      settled: "text-green-600 bg-green-50"
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

  // 未申请状态 - 显示申请表单
  if (!distributor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8">
            <h1 className="text-3xl font-bold mb-2">成为分销商</h1>
            <p className="text-gray-600 mb-6">
              推广我们的课程，获得丰厚佣金收益
            </p>

            {/* 未登录提示 */}
            {!session?.user && (
              <div className="mb-6 bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900 mb-1">需要登录才能申请</h3>
                    <p className="text-sm text-orange-800 mb-3">
                      您当前未登录。提交申请前需要先登录账号，以便我们审核并管理您的分销商账户。
                    </p>
                    <Link
                      href="/auth/signin?callbackUrl=/distribution"
                      className="inline-block px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm font-medium"
                    >
                      前往登录 →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">💰 分销商权益</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 默认佣金比例：10%（可根据业绩调整）</li>
                <li>• 专属分销链接和推广码</li>
                <li>• 实时查看订单和收益数据</li>
                <li>• 灵活的提现方式</li>
                <li>• 专业的技术支持</li>
              </ul>
            </div>

            {/* 只有登录用户才显示申请表单 */}
            {session?.user && (
              <>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      联系人姓名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={applyForm.contactName}
                      onChange={(e) => setApplyForm({...applyForm, contactName: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入您的姓名"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      联系电话 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={applyForm.contactPhone}
                      onChange={(e) => setApplyForm({...applyForm, contactPhone: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入联系电话"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      联系邮箱 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={applyForm.contactEmail}
                      onChange={(e) => setApplyForm({...applyForm, contactEmail: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入联系邮箱"
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-3">银行信息（可选，用于提现）</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">银行名称</label>
                        <input
                          type="text"
                          value={applyForm.bankName}
                          onChange={(e) => setApplyForm({...applyForm, bankName: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="例如：中国工商银行"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">银行账号</label>
                        <input
                          type="text"
                          value={applyForm.bankAccount}
                          onChange={(e) => setApplyForm({...applyForm, bankAccount: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="请输入银行账号"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">账户名</label>
                        <input
                          type="text"
                          value={applyForm.bankAccountName}
                          onChange={(e) => setApplyForm({...applyForm, bankAccountName: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="请输入账户名"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                  {applying ? "提交中..." : "提交申请"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 待审核状态
  if (distributor.status === "pending") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">申请审核中</h2>
            <p className="text-gray-600 mb-4">
              您的分销商申请正在审核中，我们会尽快处理
            </p>
            <p className="text-sm text-gray-500">
              申请时间：{new Date(distributor.appliedAt).toLocaleString("zh-CN")}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 被拒绝状态
  if (distributor.status === "rejected") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">申请未通过</h2>
            {distributor.rejectedReason && (
              <p className="text-gray-600 mb-4">
                原因：{distributor.rejectedReason}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-4">
              如有疑问，请联系客服
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 激活状态 - 显示分销中心
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">分销中心</h1>
        <Link
          href="/distribution/orders"
          className="text-blue-600 hover:text-blue-700"
        >
          查看全部订单 →
        </Link>
      </div>

      {/* 统计卡片 - 添加"已提现金额" */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">总收益</p>
          <p className="text-3xl font-bold text-blue-600">
            ¥{distributor.totalEarnings.toFixed(2)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6 border-2 border-green-200">
          <p className="text-gray-600 text-sm mb-2">可提现余额</p>
          <p className="text-3xl font-bold text-green-600 mb-3">
            ¥{distributor.availableBalance.toFixed(2)}
          </p>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={distributor.availableBalance < 100}
            className="inline-block w-full text-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            立即提现
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">待结算佣金</p>
          <p className="text-3xl font-bold text-yellow-600">
            ¥{distributor.pendingCommission.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">已提现金额</p>
          <p className="text-3xl font-bold text-purple-600">
            ¥{distributor.withdrawnAmount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* 分销链接 */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">您的分销码</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="bg-gray-50 px-4 py-3 rounded-lg border-2 border-blue-200">
              <p className="text-2xl font-mono font-bold text-blue-600 text-center">
                {distributor.code}
              </p>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              在任何产品链接后添加 ?dist={distributor.code} 即可追踪订单
            </p>
          </div>
          <button
            onClick={() => copyLink()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {copied ? "已复制！" : "复制推广链接"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              💡 佣金比例：{(distributor.commissionRate * 100).toFixed(0)}% |
              总点击数：{distributor.totalClicks} |
              转化率：{distributor.totalClicks > 0
                ? ((distributor.totalDistributionOrders / distributor.totalClicks) * 100).toFixed(2)
                : "0.00"}%
            </p>
          </div>

          {distributor.pendingCommission > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ⏳ <strong>待结算佣金说明：</strong>订单支付成功后，佣金会进入15天的结算冷静期，
                期间如果订单退款，佣金将自动取消。超过冷静期后，佣金会自动转入可提现余额。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs - 最近订单 / 提现记录 */}
      <div className="bg-white rounded-lg shadow">
        {/* Tab 标签 */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              最近订单
            </button>
            <button
              onClick={() => setActiveTab('withdrawals')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'withdrawals'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              提现记录
            </button>
          </div>
        </div>

        {/* Tab 内容 */}
        <div className="p-6">
          {/* 最近订单 Tab */}
          {activeTab === 'orders' && (
            <>
              {stats && stats.recentOrders.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleString("zh-CN")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          +¥{order.commissionAmount.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {getStatusText(order.status)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="text-center pt-4">
                    <Link
                      href="/distribution/orders"
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      查看全部订单 →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>暂无订单记录</p>
                </div>
              )}
            </>
          )}

          {/* 提现记录 Tab */}
          {activeTab === 'withdrawals' && (
            <>
              {withdrawals.length > 0 ? (
                <div className="space-y-4">
                  {withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
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

                      <div className="bg-white rounded-lg p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">银行：</span>
                            <span className="font-medium">{withdrawal.bankName}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">账号：</span>
                            <span className="font-medium">****{withdrawal.bankAccount.slice(-4)}</span>
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
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>暂无提现记录</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 提现弹窗 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">申请提现</h2>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="p-6 space-y-6">
              {/* 余额信息 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200">
                <p className="text-green-700 text-sm mb-2">可提现余额</p>
                <p className="text-4xl font-bold text-green-600">
                  ¥{distributor.availableBalance.toFixed(2)}
                </p>
                <p className="text-green-700 text-xs mt-2">最低提现金额：¥100</p>
              </div>

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
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
