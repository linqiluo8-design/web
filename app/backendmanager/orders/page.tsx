"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AdvancedFilter, { type FilterGroup } from "@/components/AdvancedFilter"

interface OrderStats {
  total: number
  pending: number
  paid: number
  completed: number
  cancelled: number
  refunded: number
}

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    title: string
    networkDiskLink: string | null
  }
}

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  status: string
  createdAt: string
  userId: string | null
  orderItems: OrderItem[]
  user?: {
    name: string | null
    email: string
  } | null
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function OrderManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [userPermission, setUserPermission] = useState<"NONE" | "READ" | "WRITE">("NONE")
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    paid: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0
  })

  // 订单列表相关状态
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [jumpToPage, setJumpToPage] = useState("")

  // 导出配置
  const [exportFormat, setExportFormat] = useState("csv")
  const [exportStartDate, setExportStartDate] = useState("")
  const [exportEndDate, setExportEndDate] = useState("")
  const [exportStatus, setExportStatus] = useState("all")
  const [exportType, setExportType] = useState<"custom" | "month">("month")
  const [customDays, setCustomDays] = useState(30)
  const [exportPaymentMethod, setExportPaymentMethod] = useState("all")
  const [exportMinPrice, setExportMinPrice] = useState("")
  const [exportMaxPrice, setExportMaxPrice] = useState("")

  // 高级筛选
  const [useAdvancedFilter, setUseAdvancedFilter] = useState(false)
  const [advancedFilter, setAdvancedFilter] = useState<FilterGroup>({
    logic: 'AND',
    conditions: []
  })

  // 清理配置
  const [cleanupStartDate, setCleanupStartDate] = useState("")
  const [cleanupEndDate, setCleanupEndDate] = useState("")
  const [cleanupStatus, setCleanupStatus] = useState("all")
  const [cleanupType, setCleanupType] = useState<"custom" | "month">("month")
  const [cleanupCustomDays, setCleanupCustomDays] = useState(30)

  // 导出状态追踪（用于控制是否可以清理）
  const [lastExportConfig, setLastExportConfig] = useState<{
    startDate: string
    endDate: string
    status: string
  } | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (status === "authenticated" && session?.user) {
      checkPermissionAndFetch()
    }
  }, [status, session, router])

  const checkPermissionAndFetch = async () => {
    try {
      if (session?.user?.role === "ADMIN") {
        setUserPermission("WRITE")
        initializePage()
        return
      }

      const res = await fetch("/api/auth/permissions")
      const data = await res.json()
      const permission = data.permissions?.ORDERS || "NONE"

      setUserPermission(permission)

      if (permission === "NONE") {
        router.push("/")
        return
      }

      initializePage()
    } catch (error) {
      console.error("检查权限失败:", error)
      router.push("/")
    }
  }

  const initializePage = () => {
    fetchStats()
    fetchOrders()

    // 自动设置默认的日期范围（当月）
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    setExportStartDate(firstDay.toISOString().split('T')[0])
    setExportEndDate(lastDay.toISOString().split('T')[0])
    setCleanupStartDate(firstDay.toISOString().split('T')[0])
    setCleanupEndDate(lastDay.toISOString().split('T')[0])
  }

  // 监听分页和筛选变化
  useEffect(() => {
    if (userPermission !== "NONE") {
      fetchOrders()
    }
  }, [pagination.page, pagination.limit, statusFilter, userPermission])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/backendmanager/orders")
      if (response.ok) {
        const data = await response.json()
        const orders = data.orders || []

        setStats({
          total: orders.length,
          pending: orders.filter((o: any) => o.status === "pending").length,
          paid: orders.filter((o: any) => o.status === "paid").length,
          completed: orders.filter((o: any) => o.status === "completed").length,
          cancelled: orders.filter((o: any) => o.status === "cancelled").length,
          refunded: orders.filter((o: any) => o.status === "refunded").length,
        })
      }
    } catch (err) {
      console.error("获取订单统计失败:", err)
    }
  }

  const fetchOrders = async () => {
    try {
      setOrdersLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (searchQuery) {
        params.append("search", searchQuery)
      }

      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }

      const response = await fetch(`/api/backendmanager/orders?${params}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error("获取订单列表失败:", err)
    } finally {
      setOrdersLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 })
    fetchOrders()
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

  // 更新日期范围（按类型）
  const updateExportDateRange = (type: "custom" | "month") => {
    setExportType(type)
    const now = new Date()

    if (type === "month") {
      // 自然月
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setExportStartDate(firstDay.toISOString().split('T')[0])
      setExportEndDate(lastDay.toISOString().split('T')[0])
    } else {
      // 自定义天数
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - customDays)
      setExportStartDate(startDate.toISOString().split('T')[0])
      setExportEndDate(now.toISOString().split('T')[0])
    }
  }

  const updateCleanupDateRange = (type: "custom" | "month") => {
    setCleanupType(type)
    const now = new Date()

    if (type === "month") {
      // 自然月
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setCleanupStartDate(firstDay.toISOString().split('T')[0])
      setCleanupEndDate(lastDay.toISOString().split('T')[0])
    } else {
      // 自定义天数
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - cleanupCustomDays)
      setCleanupStartDate(startDate.toISOString().split('T')[0])
      setCleanupEndDate(now.toISOString().split('T')[0])
    }
  }

  const handleExport = async () => {
    try {
      setLoading(true)

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
      const response = await fetch(`/api/backendmanager/orders/export?${params}`)

      if (!response.ok) {
        throw new Error("导出失败")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `orders_${Date.now()}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // 记录导出配置，允许后续清理
      setLastExportConfig({
        startDate: exportStartDate,
        endDate: exportEndDate,
        status: exportStatus
      })

      alert("✓ 导出成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "导出失败")
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    // 检查是否已导出相同配置的数据
    const configMatches = lastExportConfig &&
      lastExportConfig.startDate === cleanupStartDate &&
      lastExportConfig.endDate === cleanupEndDate &&
      lastExportConfig.status === cleanupStatus

    if (!configMatches) {
      alert("⚠️ 请先导出当前配置的订单数据！\n\n为了数据安全，必须先导出要清理的订单数据，才能执行清理操作。")
      return
    }

    if (!confirm(`确定要删除 ${cleanupStartDate} 至 ${cleanupEndDate} 期间的订单吗？\n\n此操作不可恢复，请确保已经导出备份！`)) {
      return
    }

    if (!confirm("再次确认：你确定要删除这些订单数据吗？")) {
      return
    }

    try {
      setLoading(true)

      const response = await fetch("/api/backendmanager/orders/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: cleanupStartDate,
          endDate: cleanupEndDate,
          status: cleanupStatus !== "all" ? cleanupStatus : undefined,
          confirmDelete: true
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "清理失败")
      }

      const data = await response.json()
      alert(`✓ ${data.message}`)

      // 清除导出记录（清理完成后需要重新导出）
      setLastExportConfig(null)

      // 刷新统计数据
      await fetchStats()
      await fetchOrders()
    } catch (err) {
      alert(err instanceof Error ? err.message : "清理失败")
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">订单数据管理</h1>
      </div>

      {/* 订单统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">订单总数</div>
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">待支付</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">已支付</div>
          <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">已完成</div>
          <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">已取消</div>
          <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">已退款</div>
          <div className="text-2xl font-bold text-red-600">{stats.refunded}</div>
        </div>
      </div>

      {/* 订单列表 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">订单列表</h2>

        {/* 搜索和筛选 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              搜索订单号
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入订单号搜索..."
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                搜索
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              订单状态
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
              <option value="refunded">已退款</option>
            </select>
          </div>
        </div>

        {ordersLoading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无订单</div>
        ) : (
          <>
            {/* 订单表格 */}
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      订单号
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      用户
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      商品
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      网盘信息
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      金额
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      创建时间
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {order.user ? (
                          <div>
                            <div>{order.user.name || "未命名"}</div>
                            <div className="text-xs text-gray-400">{order.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">匿名用户</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="max-w-xs">
                          {order.orderItems.map((item, idx) => (
                            <div key={item.id} className="text-xs">
                              {item.product.title} x{item.quantity}
                              {idx < order.orderItems.length - 1 && <br />}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="max-w-xs">
                          {order.orderItems.map((item, idx) => (
                            <div key={item.id} className="text-xs">
                              {item.product.networkDiskLink ? (
                                <div className="text-green-600 font-mono whitespace-pre-wrap break-words">
                                  {item.product.networkDiskLink}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                              {idx < order.orderItems.length - 1 && <br />}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-600">
                        ¥{order.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          order.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          order.status === "paid" ? "bg-green-100 text-green-800" :
                          order.status === "completed" ? "bg-blue-100 text-blue-800" :
                          order.status === "cancelled" ? "bg-gray-100 text-gray-800" :
                          order.status === "refunded" ? "bg-red-100 text-red-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {order.status === "pending" ? "待支付" :
                           order.status === "paid" ? "已支付" :
                           order.status === "completed" ? "已完成" :
                           order.status === "cancelled" ? "已取消" :
                           order.status === "refunded" ? "已退款" :
                           order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页控制 */}
            {pagination.totalPages > 0 && (
              <div className="space-y-4">
                {/* 每页数量选择 */}
                <div className="flex justify-center items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-600">每页显示：</span>
                  <div className="flex gap-2">
                    {[10, 15, 20, 30, 50].map((num) => (
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
                    共 {pagination.total} 条订单
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

                    <span className="px-4 py-2">
                      第 {pagination.page} / {pagination.totalPages} 页
                    </span>

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
      </div>

      {/* 导出订单数据 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">导出订单数据</h2>

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
              导出范围
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => updateExportDateRange("month")}
                className={`px-4 py-2 border rounded-md ${
                  exportType === "month" ? "bg-blue-600 text-white" : "bg-white"
                }`}
              >
                按自然月
              </button>
              <button
                onClick={() => updateExportDateRange("custom")}
                className={`px-4 py-2 border rounded-md ${
                  exportType === "custom" ? "bg-blue-600 text-white" : "bg-white"
                }`}
              >
                自定义天数
              </button>
            </div>
            {exportType === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value))}
                  className="w-20 px-3 py-2 border rounded-md"
                  min="1"
                />
                <span className="text-sm text-gray-600">天</span>
                <button
                  onClick={() => updateExportDateRange("custom")}
                  className="px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  应用
                </button>
              </div>
            )}
          </div>

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
              订单状态
            </label>
            <select
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="all">全部状态</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
              <option value="refunded">已退款</option>
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
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "导出中..." : "导出订单数据"}
        </button>
      </div>

      {/* 清理订单数据 */}
      <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
        <h2 className="text-xl font-semibold mb-2 text-red-600">清理订单数据</h2>
        <p className="text-sm text-gray-600 mb-4">
          警告：此操作将永久删除订单数据，无法恢复！请确保已经导出备份后再执行清理操作。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              清理范围
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => updateCleanupDateRange("month")}
                className={`px-4 py-2 border rounded-md ${
                  cleanupType === "month" ? "bg-red-600 text-white" : "bg-white"
                }`}
              >
                按自然月
              </button>
              <button
                onClick={() => updateCleanupDateRange("custom")}
                className={`px-4 py-2 border rounded-md ${
                  cleanupType === "custom" ? "bg-red-600 text-white" : "bg-white"
                }`}
              >
                自定义天数
              </button>
            </div>
            {cleanupType === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={cleanupCustomDays}
                  onChange={(e) => setCleanupCustomDays(parseInt(e.target.value))}
                  className="w-20 px-3 py-2 border rounded-md"
                  min="1"
                />
                <span className="text-sm text-gray-600">天</span>
                <button
                  onClick={() => updateCleanupDateRange("custom")}
                  className="px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  应用
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              订单状态
            </label>
            <select
              value={cleanupStatus}
              onChange={(e) => setCleanupStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="all">全部状态</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
              <option value="refunded">已退款</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开始日期
            </label>
            <input
              type="date"
              value={cleanupStartDate}
              onChange={(e) => setCleanupStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束日期
            </label>
            <input
              type="date"
              value={cleanupEndDate}
              onChange={(e) => setCleanupEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        {/* 导出状态提示 */}
        {lastExportConfig && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              ✓ 已导出数据：{lastExportConfig.startDate} 至 {lastExportConfig.endDate}
              {lastExportConfig.status !== "all" && ` (${lastExportConfig.status})`}
            </p>
          </div>
        )}

        {!lastExportConfig && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              ⚠️ 请先导出要清理的订单数据，才能执行清理操作
            </p>
          </div>
        )}

        <button
          onClick={handleCleanup}
          disabled={loading}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "清理中..." : "清理订单数据"}
        </button>
      </div>

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
          <li>• 按自然月导出：导出当前自然月的所有订单</li>
          <li>• 自定义天数：导出最近N天的订单（默认30天）</li>
          <li>• <strong>高级筛选示例</strong>：
            <ul className="ml-4 mt-1 space-y-1">
              <li>- 筛选微信支付且金额大于100的已支付订单：添加3个条件，使用 AND 逻辑</li>
              <li>- 筛选已支付或已完成的订单：添加2个状态条件，使用 OR 逻辑</li>
              <li>- 复杂组合：可添加多个条件，灵活切换 AND/OR 关系</li>
            </ul>
          </li>
          <li>• <strong>安全机制</strong>：清理前必须先导出相同配置的订单数据，系统会自动验证</li>
          <li>• 导出和清理的配置（日期范围、状态）必须完全一致才能执行清理</li>
          <li>• 清理成功后，导出记录会被清除，需要重新导出才能再次清理</li>
          <li>• 建议定期导出订单数据作为备份，可按月或按自定义周期进行</li>
          <li>• 已清理的订单数据无法恢复，请谨慎操作</li>
        </ul>
      </div>
    </div>
  )
}
