"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Distributor {
  id: string
  code: string
  status: string
  commissionRate: number
  totalEarnings: number
  availableBalance: number
  withdrawnAmount: number
  totalOrders: number
  totalClicks: number
  totalWithdrawals: number
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  appliedAt: string
  approvedAt: string | null
  rejectedReason: string | null
  user: {
    id: string
    name: string | null
    email: string
  }
}

export default function DistributionManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [hasPermission, setHasPermission] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)

  // 筛选和搜索
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // 审核状态
  const [processing, setProcessing] = useState<string | null>(null)

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
          const hasAccess = data.role === 'ADMIN' || level === 'READ' || level === 'WRITE'

          setHasPermission(hasAccess)
          setPermissionChecked(true)

          if (!hasAccess) {
            router.push("/")
          } else {
            fetchDistributors()
          }
        })
        .catch(err => {
          console.error('权限检查失败:', err)
          setPermissionChecked(true)
          router.push("/")
        })
    }
  }, [status, session, router])

  // 获取分销商列表
  const fetchDistributors = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: "20",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery })
      })

      const response = await fetch(`/api/backendmanager/distribution/distributors?${params}`)
      if (!response.ok) throw new Error("获取分销商列表失败")

      const data = await response.json()
      setDistributors(data.distributors)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      setLoading(false)
    } catch (error) {
      console.error("获取分销商列表失败:", error)
      setLoading(false)
    }
  }

  // 当筛选条件改变时重新获取
  useEffect(() => {
    if (hasPermission) {
      setCurrentPage(1)
      fetchDistributors()
    }
  }, [statusFilter, searchQuery])

  // 当页码改变时重新获取
  useEffect(() => {
    if (hasPermission && currentPage > 1) {
      fetchDistributors()
    }
  }, [currentPage])

  // 审核通过
  const handleApprove = async (id: string, commissionRate?: number) => {
    if (processing) return

    const rate = commissionRate || prompt("请输入佣金比例（例如：0.1 表示 10%）")
    if (!rate) return

    const rateNum = parseFloat(rate.toString())
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 1) {
      alert("请输入有效的佣金比例（0-1之间）")
      return
    }

    setProcessing(id)
    try {
      const response = await fetch(`/api/backendmanager/distribution/distributors/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: rateNum })
      })

      const data = await response.json()

      if (response.ok) {
        alert("审核通过！")
        fetchDistributors()
      } else {
        alert(data.error || "审核失败")
      }
    } catch (error) {
      console.error("审核失败:", error)
      alert("审核失败，请稍后重试")
    } finally {
      setProcessing(null)
    }
  }

  // 拒绝申请
  const handleReject = async (id: string) => {
    if (processing) return

    const reason = prompt("请输入拒绝原因：")
    if (!reason || reason.trim().length === 0) {
      alert("请填写拒绝原因")
      return
    }

    setProcessing(id)
    try {
      const response = await fetch(`/api/backendmanager/distribution/distributors/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        alert("已拒绝申请")
        fetchDistributors()
      } else {
        alert(data.error || "操作失败")
      }
    } catch (error) {
      console.error("拒绝申请失败:", error)
      alert("操作失败，请稍后重试")
    } finally {
      setProcessing(null)
    }
  }

  // 获取状态标签
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">待审核</span>
      case "active":
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">已激活</span>
      case "suspended":
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">已暂停</span>
      case "rejected":
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">已拒绝</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">{status}</span>
    }
  }

  if (loading || !permissionChecked) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  if (!hasPermission) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">您没有访问此页面的权限</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/backendmanager"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
      >
        <span className="mr-2">←</span>
        返回后台管理
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">分销管理</h1>
          <p className="text-gray-600">管理分销商申请和佣金</p>
        </div>
        <Link
          href="/backendmanager/distribution/withdrawals"
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          提现管理
        </Link>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">总分销商</p>
          <p className="text-3xl font-bold text-blue-600">{total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">待审核</p>
          <p className="text-3xl font-bold text-yellow-600">
            {distributors.filter(d => d.status === "pending").length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">已激活</p>
          <p className="text-3xl font-bold text-green-600">
            {distributors.filter(d => d.status === "active").length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">总佣金支出</p>
          <p className="text-3xl font-bold text-red-600">
            ¥{distributors.reduce((sum, d) => sum + d.totalEarnings, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* 筛选和搜索 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索分销商（姓名、邮箱、电话、分销码）"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="active">已激活</option>
            <option value="suspended">已暂停</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>
      </div>

      {/* 分销商列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                分销商信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                分销码
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                佣金比例
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                统计数据
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                申请时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {distributors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  暂无分销商数据
                </td>
              </tr>
            ) : (
              distributors.map((distributor) => (
                <tr key={distributor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {distributor.contactName || distributor.user.name || "未设置"}
                      </p>
                      <p className="text-sm text-gray-600">{distributor.user.email}</p>
                      {distributor.contactPhone && (
                        <p className="text-sm text-gray-600">{distributor.contactPhone}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                      {distributor.code}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(distributor.status)}
                    {distributor.status === "rejected" && distributor.rejectedReason && (
                      <p className="text-xs text-red-600 mt-1">
                        {distributor.rejectedReason}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium">
                      {(distributor.commissionRate * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-gray-900">订单: {distributor.totalOrders}</p>
                      <p className="text-gray-600">点击: {distributor.totalClicks}</p>
                      <p className="text-green-600">收益: ¥{distributor.totalEarnings.toFixed(2)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(distributor.appliedAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-6 py-4">
                    {distributor.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(distributor.id)}
                          disabled={processing === distributor.id}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleReject(distributor.id)}
                          disabled={processing === distributor.id}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400"
                        >
                          拒绝
                        </button>
                      </div>
                    )}
                    {distributor.status === "active" && (
                      <span className="text-sm text-gray-500">已激活</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            上一页
          </button>
          <span className="px-4 py-2">
            第 {currentPage} / {totalPages} 页
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
