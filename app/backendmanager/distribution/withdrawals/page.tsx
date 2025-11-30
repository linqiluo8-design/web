"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

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
  transactionId?: string
  // 自动审核相关
  isAutoApproved: boolean
  autoApprovedAt?: string
  riskScore?: number
  riskCheckResult?: string
  distributor: {
    id: string
    code: string
    user: {
      name: string | null
      email: string
    }
  }
}

export default function WithdrawalsManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [hasPermission, setHasPermission] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)

  // 筛选
  const [statusFilter, setStatusFilter] = useState("all")

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // 处理状态
  const [processing, setProcessing] = useState<string | null>(null)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [transactionId, setTransactionId] = useState("")

  // 检查权限
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (session?.user) {
      fetch('/api/auth/permissions')
        .then(res => res.json())
        .then(data => {
          const permissions = data.permissions || {}
          const level = permissions['DISTRIBUTION']
          const hasAccess = data.role === 'ADMIN' || level === 'WRITE'

          setHasPermission(hasAccess)
          setPermissionChecked(true)

          if (!hasAccess) {
            router.push("/")
          } else {
            fetchWithdrawals()
          }
        })
        .catch(err => {
          console.error('权限检查失败:', err)
          setPermissionChecked(true)
          router.push("/")
        })
    }
  }, [status, session, router])

  // 获取提现列表
  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: "20",
        ...(statusFilter !== "all" && { status: statusFilter })
      })

      const response = await fetch(`/api/backendmanager/distribution/withdrawals?${params}`)
      if (!response.ok) throw new Error("获取提现列表失败")

      const data = await response.json()
      setWithdrawals(data.withdrawals)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (error) {
      console.error("获取提现列表失败:", error)
      alert("获取提现列表失败，请刷新重试")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasPermission) {
      fetchWithdrawals()
    }
  }, [currentPage, statusFilter, hasPermission])

  // 批准提现（标记为处理中）
  const handleApprove = async (withdrawal: Withdrawal) => {
    if (!confirm(`确定批准此提现申请？\n提现金额：¥${withdrawal.amount}\n到账金额：¥${withdrawal.actualAmount}`)) {
      return
    }

    setProcessing(withdrawal.id)
    try {
      const response = await fetch(`/api/backendmanager/distribution/withdrawals/${withdrawal.id}/approve`, {
        method: "POST"
      })

      const data = await response.json()

      if (response.ok) {
        alert("已批准，状态更新为处理中")
        fetchWithdrawals()
      } else {
        alert(data.error || "批准失败")
      }
    } catch (error) {
      console.error("批准失败:", error)
      alert("批准失败，请重试")
    } finally {
      setProcessing(null)
    }
  }

  // 拒绝提现
  const handleReject = async () => {
    if (!selectedWithdrawal) return

    if (!rejectReason.trim()) {
      alert("请输入拒绝原因")
      return
    }

    setProcessing(selectedWithdrawal.id)
    try {
      const response = await fetch(`/api/backendmanager/distribution/withdrawals/${selectedWithdrawal.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason })
      })

      const data = await response.json()

      if (response.ok) {
        alert("提现申请已拒绝")
        setShowRejectModal(false)
        setSelectedWithdrawal(null)
        setRejectReason("")
        fetchWithdrawals()
      } else {
        alert(data.error || "拒绝失败")
      }
    } catch (error) {
      console.error("拒绝失败:", error)
      alert("拒绝失败，请重试")
    } finally {
      setProcessing(null)
    }
  }

  // 完成提现
  const handleComplete = async () => {
    if (!selectedWithdrawal) return

    if (!transactionId.trim()) {
      alert("请输入交易凭证号")
      return
    }

    setProcessing(selectedWithdrawal.id)
    try {
      const response = await fetch(`/api/backendmanager/distribution/withdrawals/${selectedWithdrawal.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId })
      })

      const data = await response.json()

      if (response.ok) {
        alert("提现已完成")
        setShowCompleteModal(false)
        setSelectedWithdrawal(null)
        setTransactionId("")
        fetchWithdrawals()
      } else {
        alert(data.error || "完成失败")
      }
    } catch (error) {
      console.error("完成失败:", error)
      alert("完成失败，请重试")
    } finally {
      setProcessing(null)
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
      pending: "text-yellow-600 bg-yellow-50 border-yellow-200",
      processing: "text-blue-600 bg-blue-50 border-blue-200",
      completed: "text-green-600 bg-green-50 border-green-200",
      rejected: "text-red-600 bg-red-50 border-red-200"
    }
    return colorMap[status] || "text-gray-600 bg-gray-50 border-gray-200"
  }

  if (!permissionChecked || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  if (!hasPermission) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="mb-8">
          <Link
            href="/backendmanager/distribution"
            className="text-blue-600 hover:text-blue-700 mb-2 inline-block"
          >
            ← 返回分销管理
          </Link>
          <h1 className="text-3xl font-bold">提现审核管理</h1>
        </div>

        {/* 筛选栏 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="font-medium">状态筛选：</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部</option>
              <option value="pending">待审核</option>
              <option value="processing">处理中</option>
              <option value="completed">已完成</option>
              <option value="rejected">已拒绝</option>
            </select>

            <div className="ml-auto text-sm text-gray-600">
              共 {total} 条记录
            </div>
          </div>
        </div>

        {/* 提现列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {withdrawals.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p>暂无提现申请</p>
            </div>
          ) : (
            <div className="divide-y">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">
                          ¥{withdrawal.amount.toFixed(2)}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(withdrawal.status)}`}>
                          {getStatusText(withdrawal.status)}
                        </span>
                        {withdrawal.isAutoApproved && (
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                            🤖 自动审核
                          </span>
                        )}
                        {withdrawal.riskScore !== undefined && withdrawal.riskScore > 0 && (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
                            withdrawal.riskScore >= 30 ? 'bg-red-100 text-red-800 border-red-200' :
                            withdrawal.riskScore >= 10 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                            'bg-green-100 text-green-800 border-green-200'
                          }`}>
                            风险评分: {withdrawal.riskScore.toFixed(0)}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-600 space-y-1 mb-3">
                        <p>
                          分销商：{withdrawal.distributor.user.name || withdrawal.distributor.user.email}
                          （{withdrawal.distributor.code}）
                        </p>
                        <p>
                          手续费：¥{withdrawal.fee.toFixed(2)} |
                          实际到账：¥{withdrawal.actualAmount.toFixed(2)}
                        </p>
                        <p>
                          申请时间：{new Date(withdrawal.createdAt).toLocaleString("zh-CN")}
                        </p>
                      </div>

                      <div className="bg-gray-100 rounded-lg p-4 space-y-2">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">银行：</span>
                            <span className="font-medium">{withdrawal.bankName}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">账号：</span>
                            <span className="font-medium">{withdrawal.bankAccount}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">户名：</span>
                            <span className="font-medium">{withdrawal.bankAccountName}</span>
                          </div>
                        </div>

                        {withdrawal.transactionId && (
                          <div className="text-sm">
                            <span className="text-gray-600">交易凭证：</span>
                            <span className="font-medium">{withdrawal.transactionId}</span>
                          </div>
                        )}

                        {withdrawal.status === "rejected" && withdrawal.rejectedReason && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                            <p className="text-red-800">
                              <strong>拒绝原因：</strong>{withdrawal.rejectedReason}
                            </p>
                          </div>
                        )}

                        {withdrawal.riskCheckResult && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                            <p className="text-blue-800 font-semibold mb-1">风险检查详情：</p>
                            <pre className="text-xs text-blue-700 whitespace-pre-wrap">
                              {(() => {
                                try {
                                  const riskData = JSON.parse(withdrawal.riskCheckResult)
                                  return `风险等级: ${riskData.riskLevel}\n触发因素: ${riskData.risks.join(', ')}`
                                } catch {
                                  return withdrawal.riskCheckResult
                                }
                              })()}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="ml-6 flex flex-col gap-2">
                      {withdrawal.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(withdrawal)}
                            disabled={processing === withdrawal.id}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm font-medium whitespace-nowrap"
                          >
                            {processing === withdrawal.id ? "处理中..." : "批准"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal)
                              setShowRejectModal(true)
                            }}
                            disabled={processing === withdrawal.id}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors text-sm font-medium whitespace-nowrap"
                          >
                            拒绝
                          </button>
                        </>
                      )}

                      {withdrawal.status === "processing" && (
                        <button
                          onClick={() => {
                            setSelectedWithdrawal(withdrawal)
                            setShowCompleteModal(true)
                          }}
                          disabled={processing === withdrawal.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors text-sm font-medium whitespace-nowrap"
                        >
                          {processing === withdrawal.id ? "处理中..." : "标记完成"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="border-t p-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-4 py-2">
                第 {currentPage} / {totalPages} 页
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 拒绝模态框 */}
      {showRejectModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">拒绝提现申请</h2>
            <p className="text-gray-600 mb-4">
              提现金额：¥{selectedWithdrawal.amount.toFixed(2)}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                拒绝原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="请输入拒绝原因"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={processing === selectedWithdrawal.id || !rejectReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                {processing === selectedWithdrawal.id ? "处理中..." : "确认拒绝"}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedWithdrawal(null)
                  setRejectReason("")
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 完成模态框 */}
      {showCompleteModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">标记提现完成</h2>
            <p className="text-gray-600 mb-4">
              到账金额：¥{selectedWithdrawal.actualAmount.toFixed(2)}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                交易凭证号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="请输入交易凭证号"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleComplete}
                disabled={processing === selectedWithdrawal.id || !transactionId.trim()}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {processing === selectedWithdrawal.id ? "处理中..." : "确认完成"}
              </button>
              <button
                onClick={() => {
                  setShowCompleteModal(false)
                  setSelectedWithdrawal(null)
                  setTransactionId("")
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
