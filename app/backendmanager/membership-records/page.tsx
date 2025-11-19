"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AdvancedFilter, { type FilterGroup } from "@/components/AdvancedFilter"

interface User {
  id: string
  name: string | null
  email: string
}

interface Plan {
  id: string
  name: string
}

interface MembershipRecord {
  id: string
  userId: string | null
  user: User | null
  membershipCode: string
  planId: string
  plan: Plan
  planSnapshot: string
  purchasePrice: number
  discount: number
  dailyLimit: number
  duration: number
  startDate: string
  endDate: string | null
  status: string
  orderNumber: string | null
  paymentMethod: string | null
  paymentStatus: string
  createdAt: string
  updatedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function MembershipRecordsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [records, setRecords] = useState<MembershipRecord[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 筛选和搜索状态
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("")
  const [selectedRecord, setSelectedRecord] = useState<MembershipRecord | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [jumpToPage, setJumpToPage] = useState("")
  const [userPermission, setUserPermission] = useState<"NONE" | "READ" | "WRITE">("NONE")

  // 导出配置
  const [exportLoading, setExportLoading] = useState(false)
  const [exportFormat, setExportFormat] = useState("csv")
  const [exportStartDate, setExportStartDate] = useState("")
  const [exportEndDate, setExportEndDate] = useState("")
  const [exportStatus, setExportStatus] = useState("all")
  const [exportPaymentStatus, setExportPaymentStatus] = useState("all")
  const [exportPaymentMethod, setExportPaymentMethod] = useState("all")
  const [exportMinPrice, setExportMinPrice] = useState("")
  const [exportMaxPrice, setExportMaxPrice] = useState("")

  // 高级筛选
  const [useAdvancedFilter, setUseAdvancedFilter] = useState(false)
  const [advancedFilter, setAdvancedFilter] = useState<FilterGroup>({
    logic: 'AND',
    conditions: []
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (status === "authenticated" && session?.user) {
      checkPermissionAndFetch()
    }
  }, [status, session, router])

  useEffect(() => {
    if (userPermission !== "NONE") {
      fetchRecords()
    }
  }, [pagination.page, search, statusFilter, paymentStatusFilter, userPermission])

  const checkPermissionAndFetch = async () => {
    try {
      // 管理员拥有所有权限
      if (session?.user?.role === "ADMIN") {
        setUserPermission("WRITE")
        return
      }

      // 获取用户权限 - 会员记录属于MEMBERSHIPS模块
      const res = await fetch("/api/auth/permissions")
      const data = await res.json()
      const permission = data.permissions?.MEMBERSHIPS || "NONE"

      setUserPermission(permission)

      if (permission === "NONE") {
        // 没有权限，跳转到首页
        router.push("/")
        return
      }
    } catch (error) {
      console.error("检查权限失败:", error)
      router.push("/")
    }
  }

  const fetchRecords = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })

      if (search) params.append("search", search)
      if (statusFilter) params.append("status", statusFilter)
      if (paymentStatusFilter) params.append("paymentStatus", paymentStatusFilter)

      const response = await fetch(`/api/backendmanager/membership-records?${params}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "获取会员购买记录失败")
      }

      const data = await response.json()
      setRecords(data.records)
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    setPagination({ ...pagination, page: newPage })
  }

  const handleLimitChange = (newLimit: number) => {
    setPagination({ ...pagination, limit: newLimit, page: 1 })
  }

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pagination.totalPages) {
      setPagination({ ...pagination, page: pageNum })
      setJumpToPage("")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getDurationDisplay = (duration: number) => {
    if (duration === -1) return "终身"
    if (duration >= 365) return `${Math.floor(duration / 365)}年`
    return `${duration}天`
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: "bg-green-100", text: "text-green-800", label: "有效" },
      expired: { bg: "bg-gray-100", text: "text-gray-800", label: "已过期" },
      cancelled: { bg: "bg-red-100", text: "text-red-800", label: "已取消" }
    }

    const config = statusConfig[status] || { bg: "bg-gray-100", text: "text-gray-800", label: status }

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  const getPaymentStatusBadge = (paymentStatus: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: "bg-yellow-100", text: "text-yellow-800", label: "待支付" },
      completed: { bg: "bg-green-100", text: "text-green-800", label: "已支付" },
      failed: { bg: "bg-red-100", text: "text-red-800", label: "支付失败" }
    }

    const config = statusConfig[paymentStatus] || { bg: "bg-gray-100", text: "text-gray-800", label: paymentStatus }

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  const getPaymentMethodDisplay = (method: string | null) => {
    if (!method) return "-"
    const methodMap: Record<string, string> = {
      alipay: "支付宝",
      wechat: "微信支付",
      paypal: "PayPal"
    }
    return methodMap[method] || method
  }

  const showDetail = (record: MembershipRecord) => {
    setSelectedRecord(record)
    setShowDetailModal(true)
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      alert("会员码已复制到剪贴板")
    })
  }

  const handleExport = async () => {
    try {
      setExportLoading(true)

      const params = new URLSearchParams({
        format: exportFormat,
      })

      // 使用高级筛选
      if (useAdvancedFilter && advancedFilter.conditions.length > 0) {
        params.append("filters", JSON.stringify(advancedFilter))
      } else {
        // 使用简单筛选（兼容旧版）
        if (exportStartDate) {
          params.append("startDate", exportStartDate)
        }

        if (exportEndDate) {
          params.append("endDate", exportEndDate)
        }

        if (exportStatus !== "all") {
          params.append("status", exportStatus)
        }

        if (exportPaymentStatus !== "all") {
          params.append("paymentStatus", exportPaymentStatus)
        }

        if (exportPaymentMethod !== "all") {
          params.append("paymentMethod", exportPaymentMethod)
        }

        if (exportMinPrice) {
          params.append("minPrice", exportMinPrice)
        }

        if (exportMaxPrice) {
          params.append("maxPrice", exportMaxPrice)
        }
      }

      // 下载文件
      const response = await fetch(`/api/backendmanager/membership-records/export?${params}`)

      if (!response.ok) {
        throw new Error("导出失败")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `membership_records_${Date.now()}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // 文件下载成功，立即取消 loading 状态（不使用阻塞的 alert）
      setExportLoading(false)
    } catch (err) {
      setExportLoading(false)
      alert(err instanceof Error ? err.message : "导出失败")
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
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
      {/* 页面标题和导航 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">会员购买记录</h1>
        </div>
        <div className="text-sm text-gray-600">
          共 {pagination.total} 条记录
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              搜索会员码或订单号
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                placeholder="输入会员码或订单号..."
                className="flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                搜索
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              会员状态
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPagination({ ...pagination, page: 1 })
              }}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全部</option>
              <option value="active">有效</option>
              <option value="expired">已过期</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              支付状态
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value)
                setPagination({ ...pagination, page: 1 })
              }}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全部</option>
              <option value="pending">待支付</option>
              <option value="completed">已支付</option>
              <option value="failed">支付失败</option>
            </select>
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      {records.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow">
          暂无会员购买记录
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      会员码
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      用户信息
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      会员方案
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      购买时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      支付方式
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      支付状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      会员状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium text-blue-600">
                            {record.membershipCode}
                          </span>
                          <button
                            onClick={() => handleCopyCode(record.membershipCode)}
                            className="text-gray-400 hover:text-blue-600"
                            title="复制会员码"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.user ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{record.user.name || "未设置"}</div>
                            <div className="text-gray-500">{record.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">匿名用户</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{record.plan.name}</div>
                          <div className="text-gray-500">¥{record.purchasePrice.toFixed(2)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(record.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getPaymentMethodDisplay(record.paymentMethod)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPaymentStatusBadge(record.paymentStatus)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(record.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => showDetail(record)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 分页 */}
          {pagination.totalPages > 0 && (
            <div className="mt-6 space-y-4">
              {/* 每页数量选择 */}
              <div className="flex justify-center items-center gap-3 flex-wrap">
                <span className="text-sm text-gray-600">每页显示：</span>
                <div className="flex gap-2">
                  {[5, 10, 15, 20, 25, 30, 40, 50].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleLimitChange(num)}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        pagination.limit === num
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  共 {pagination.total} 条记录
                </span>
              </div>

              {/* 分页导航 */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === pagination.totalPages ||
                        (page >= pagination.page - 2 && page <= pagination.page + 2)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-2 border rounded-md ${
                              page === pagination.page
                                ? "bg-blue-600 text-white"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            {page}
                          </button>
                        )
                      } else if (
                        page === pagination.page - 3 ||
                        page === pagination.page + 3
                      ) {
                        return <span key={page} className="px-2">...</span>
                      }
                      return null
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>

                  {/* 跳转到指定页 */}
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm text-gray-600">跳转到</span>
                    <input
                      type="number"
                      min="1"
                      max={pagination.totalPages}
                      value={jumpToPage}
                      onChange={(e) => setJumpToPage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleJumpToPage()
                        }
                      }}
                      placeholder="页码"
                      className="w-20 px-2 py-1 border rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">页</span>
                    <button
                      onClick={handleJumpToPage}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      跳转
                    </button>
                  </div>
                </div>
              )}

              {/* 分页信息 */}
              <div className="text-center text-sm text-gray-600">
                当前第 {pagination.page}/{pagination.totalPages} 页
              </div>
            </div>
          )}
        </>
      )}

      {/* 导出会员订单数据 */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">导出会员订单数据</h2>

          {/* 模式切换 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">筛选模式：</span>
            <button
              onClick={() => setUseAdvancedFilter(!useAdvancedFilter)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                useAdvancedFilter
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {useAdvancedFilter ? '高级模式 ⚡' : '简单模式'}
            </button>
          </div>
        </div>

        {/* 高级筛选界面 */}
        {useAdvancedFilter ? (
          <div className="mb-6">
            <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
              <p className="text-sm text-purple-800">
                <strong>高级模式：</strong>支持复杂的筛选条件组合，可使用 AND/OR 逻辑。
              </p>
            </div>
            <AdvancedFilter
              onFilterChange={setAdvancedFilter}
              initialFilter={advancedFilter}
            />
          </div>
        ) : (
          /* 简单筛选界面 */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                导出格式
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="csv">CSV (Excel)</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                会员状态
              </label>
              <select
                value={exportStatus}
                onChange={(e) => setExportStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">全部状态</option>
                <option value="active">有效</option>
                <option value="expired">已过期</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                支付状态
              </label>
              <select
                value={exportPaymentStatus}
                onChange={(e) => setExportPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">全部状态</option>
                <option value="pending">待支付</option>
                <option value="completed">已支付</option>
                <option value="failed">支付失败</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                支付方式
              </label>
              <select
                value={exportPaymentMethod}
                onChange={(e) => setExportPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">全部支付方式</option>
                <option value="wechat">微信支付</option>
                <option value="alipay">支付宝</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                开始日期
              </label>
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                结束日期
              </label>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最低金额
              </label>
              <input
                type="number"
                value={exportMinPrice}
                onChange={(e) => setExportMinPrice(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="留空表示不限"
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最高金额
              </label>
              <input
                type="number"
                value={exportMaxPrice}
                onChange={(e) => setExportMaxPrice(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="留空表示不限"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={exportLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {exportLoading ? "导出中..." : "导出会员订单数据"}
        </button>

        {/* 使用说明 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-blue-900">使用说明</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>筛选模式</strong>：
              <ul className="ml-4 mt-1 space-y-1">
                <li>- 简单模式：快速筛选常用条件（日期、状态、支付方式、价格范围等）</li>
                <li>- 高级模式：支持复杂条件组合，可使用 AND/OR 逻辑，支持多条件嵌套</li>
              </ul>
            </li>
            <li>• 导出功能支持CSV和JSON两种格式，CSV可直接用Excel打开</li>
            <li>• 可根据会员状态、支付状态、购买时间、价格等多个维度进行筛选导出</li>
            <li>• <strong>高级筛选示例</strong>：
              <ul className="ml-4 mt-1 space-y-1">
                <li>- 筛选微信支付且价格大于100的已支付订单：添加3个条件，使用 AND 逻辑</li>
                <li>- 筛选有效或已过期的会员：添加2个状态条件，使用 OR 逻辑</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      {/* 详情模态框 */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">会员购买详情</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 会员码 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">会员码</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-gray-50 border rounded-md text-lg font-mono font-bold text-blue-600">
                    {selectedRecord.membershipCode}
                  </code>
                  <button
                    onClick={() => handleCopyCode(selectedRecord.membershipCode)}
                    className="px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    复制
                  </button>
                </div>
              </div>

              {/* 用户信息 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">购买用户</label>
                {selectedRecord.user ? (
                  <div className="px-4 py-3 bg-gray-50 border rounded-md">
                    <div className="font-medium">{selectedRecord.user.name || "未设置姓名"}</div>
                    <div className="text-sm text-gray-600">{selectedRecord.user.email}</div>
                    <div className="text-xs text-gray-500 mt-1">用户ID: {selectedRecord.user.id}</div>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-gray-50 border rounded-md text-gray-500 italic">
                    匿名用户购买
                  </div>
                )}
              </div>

              {/* 会员方案 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">会员方案</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md">
                    {selectedRecord.plan.name}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">购买价格</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md font-bold text-green-600">
                    ¥{selectedRecord.purchasePrice.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 会员详情 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">折扣率</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md">
                    {(selectedRecord.discount * 10).toFixed(1)}折
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">每日限制</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md">
                    每天{selectedRecord.dailyLimit}次
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">有效期</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md">
                    {getDurationDisplay(selectedRecord.duration)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">到期时间</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md">
                    {selectedRecord.endDate ? formatDate(selectedRecord.endDate) : "永久有效"}
                  </div>
                </div>
              </div>

              {/* 支付信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">支付方式</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md">
                    {getPaymentMethodDisplay(selectedRecord.paymentMethod)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">支付状态</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md">
                    {getPaymentStatusBadge(selectedRecord.paymentStatus)}
                  </div>
                </div>
              </div>

              {/* 订单号 */}
              {selectedRecord.orderNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">关联订单号</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md font-mono">
                    {selectedRecord.orderNumber}
                  </div>
                </div>
              )}

              {/* 时间信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">购买时间</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md text-sm">
                    {formatDate(selectedRecord.createdAt)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">会员状态</label>
                  <div className="px-4 py-3 bg-gray-50 border rounded-md">
                    {getStatusBadge(selectedRecord.status)}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4">
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
