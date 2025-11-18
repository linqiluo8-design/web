"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface Plan {
  id: string
  name: string
}

interface MembershipOrder {
  id: string
  membershipCode: string
  orderNumber: string | null
  planId: string
  plan: Plan
  purchasePrice: number
  discount: number
  dailyLimit: number
  duration: number
  startDate: string
  endDate: string | null
  status: string
  paymentMethod: string | null
  paymentStatus: string
  createdAt: string
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

// 从localStorage获取会员码
const getMembershipCodesFromStorage = (): string[] => {
  if (typeof window === "undefined") return []
  try {
    const codes = localStorage.getItem("membershipCodes")
    return codes ? JSON.parse(codes) : []
  } catch {
    return []
  }
}

// 保存会员码到localStorage
export const saveMembershipCodeToLocal = (code: string) => {
  if (typeof window === "undefined") return
  try {
    const codes = getMembershipCodesFromStorage()
    if (!codes.includes(code)) {
      codes.push(code)
      localStorage.setItem("membershipCodes", JSON.stringify(codes))
    }
  } catch (error) {
    console.error("保存会员码失败:", error)
  }
}

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: "有效", color: "text-green-600 bg-green-50" },
  expired: { label: "已过期", color: "text-gray-600 bg-gray-50" },
  cancelled: { label: "已取消", color: "text-red-600 bg-red-50" },
}

const paymentMethodMap: Record<string, string> = {
  alipay: "支付宝",
  wechat: "微信支付",
  paypal: "PayPal",
}

export default function MembershipOrdersPage() {
  const [orders, setOrders] = useState<MembershipOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 5,
    totalPages: 0
  })
  const [search, setSearch] = useState("")
  const [jumpToPage, setJumpToPage] = useState("")
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set()) // 选中的订单ID

  useEffect(() => {
    fetchOrders()
  }, [pagination.page, pagination.limit])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const codes = getMembershipCodesFromStorage()

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        membershipCodes: codes.join(",")
      })

      if (search) {
        params.append("search", search)
      }

      const res = await fetch(`/api/membership-orders?${params}`)

      if (res.ok) {
        const data = await res.json()
        setOrders(data.memberships || [])
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error("获取会员订单失败:", err)
    } finally {
      setLoading(false)
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    alert(`${label}已复制！`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN")
  }

  const getDurationDisplay = (duration: number) => {
    if (duration === -1) return "终身"
    if (duration >= 365) return `${Math.floor(duration / 365)}年`
    return `${duration}天`
  }

  // 复选框选择功能
  const toggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)))
    }
  }

  // 导出为JSON
  const exportToJSON = (membershipOrders: MembershipOrder[], filename: string) => {
    const dataStr = JSON.stringify(membershipOrders, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filename}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // 导出为CSV
  const exportToCSV = (membershipOrders: MembershipOrder[], filename: string) => {
    // CSV 表头
    const headers = [
      "会员订单号",
      "会员码",
      "会员方案",
      "购买价格",
      "折扣率",
      "每日限制",
      "有效期",
      "开始时间",
      "到期时间",
      "状态",
      "支付方式",
      "支付状态",
      "创建时间"
    ]

    // 构建CSV内容
    const rows = membershipOrders.map(order => [
      order.orderNumber || "无",
      order.membershipCode,
      order.plan.name,
      order.purchasePrice.toFixed(2),
      (order.discount * 10).toFixed(1) + "折",
      order.dailyLimit + "次/天",
      getDurationDisplay(order.duration),
      formatDate(order.startDate),
      order.endDate ? formatDate(order.endDate) : "永久有效",
      statusMap[order.status]?.label || order.status,
      order.paymentMethod ? (paymentMethodMap[order.paymentMethod] || order.paymentMethod) : "未支付",
      order.paymentStatus === "completed" ? "已支付" : order.paymentStatus === "pending" ? "待支付" : "失败",
      formatDate(order.createdAt)
    ])

    // 组合CSV内容
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    // 添加BOM以支持中文
    const BOM = "\uFEFF"
    const dataBlob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filename}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // 导出单个订单
  const exportSingleOrder = (order: MembershipOrder, format: "json" | "csv") => {
    const filename = `会员订单_${order.membershipCode}_${new Date().toISOString().split("T")[0]}`
    if (format === "json") {
      exportToJSON([order], filename)
    } else {
      exportToCSV([order], filename)
    }
  }

  // 导出选中的订单
  const exportSelectedOrders = (format: "json" | "csv") => {
    const ordersToExport = orders.filter(order => selectedOrders.has(order.id))
    if (ordersToExport.length === 0) {
      alert("请先选择要导出的会员订单")
      return
    }
    const filename = `会员订单导出_${ordersToExport.length}条_${new Date().toISOString().split("T")[0]}`
    if (format === "json") {
      exportToJSON(ordersToExport, filename)
    } else {
      exportToCSV(ordersToExport, filename)
    }
    // 导出后清除选择
    setSelectedOrders(new Set())
  }

  // 导出全部订单
  const exportAllOrders = (format: "json" | "csv") => {
    if (orders.length === 0) {
      alert("没有可导出的会员订单")
      return
    }
    const filename = `全部会员订单_${pagination.total}条_${new Date().toISOString().split("T")[0]}`
    if (format === "json") {
      exportToJSON(orders, filename)
    } else {
      exportToCSV(orders, filename)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">我的会员订单</h1>

      {/* 搜索框 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="搜索订单号或会员码..."
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            搜索
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-500 mb-4 text-lg">您还没有购买会员套餐，没有会员订单</p>
          <Link
            href="/membership"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
          >
            还没有会员？立即购买
          </Link>
        </div>
      ) : (
        <>
          {/* 批量操作工具栏 */}
          <div className="bg-white rounded-lg shadow border p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === orders.length && orders.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">全选本页</span>
                </label>
                {selectedOrders.size > 0 && (
                  <span className="text-sm text-gray-600">
                    已选择 {selectedOrders.size} 条会员订单
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 导出选中按钮 */}
                {selectedOrders.size > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportSelectedOrders("csv")}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      导出选中 (CSV)
                    </button>
                    <button
                      onClick={() => exportSelectedOrders("json")}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      导出选中 (JSON)
                    </button>
                  </div>
                )}

                {/* 导出全部按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => exportAllOrders("csv")}
                    className="px-4 py-2 border border-green-600 text-green-600 rounded-md hover:bg-green-50 text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    导出全部 (CSV)
                  </button>
                  <button
                    onClick={() => exportAllOrders("json")}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    导出全部 (JSON)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {orders.map((order) => {
              const statusInfo = statusMap[order.status] || statusMap.active
              return (
                <div key={order.id} className="bg-white rounded-lg shadow flex">
                  {/* 复选框 */}
                  <div className="flex items-center justify-center p-4 bg-gray-50 border-r">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleSelectOrder(order.id)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* 订单内容 */}
                  <div className="flex-1 p-6">
                  {/* 订单头部 */}
                  <div className="border-b pb-4 mb-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">
                            {order.plan.name}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-sm ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          购买时间: {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          ¥{order.purchasePrice.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 订单信息 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {order.orderNumber && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">会员订单号</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-semibold">
                            {order.orderNumber}
                          </p>
                          <button
                            onClick={() => copyToClipboard(order.orderNumber!, "订单号")}
                            className="text-blue-600 hover:text-blue-700"
                            title="复制订单号"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-gray-600 mb-1">会员码</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-semibold text-blue-600">
                          {order.membershipCode}
                        </p>
                        <button
                          onClick={() => copyToClipboard(order.membershipCode, "会员码")}
                          className="text-blue-600 hover:text-blue-700"
                          title="复制会员码"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {order.paymentMethod && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">支付方式</p>
                        <p className="text-sm font-semibold">
                          {paymentMethodMap[order.paymentMethod] || order.paymentMethod}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-gray-600 mb-1">会员套餐</p>
                      <p className="text-sm font-semibold">
                        {getDurationDisplay(order.duration)} • {(order.discount * 10).toFixed(1)}折 • 每日{order.dailyLimit}次
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1">开始时间</p>
                      <p className="text-sm">{formatDate(order.startDate)}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1">到期时间</p>
                      <p className="text-sm">
                        {order.endDate ? formatDate(order.endDate) : "永久有效"}
                      </p>
                    </div>
                  </div>

                  {/* 底部操作栏 */}
                  <div className="border-t pt-4 mt-4 flex items-center justify-between flex-wrap gap-4">
                    {/* 提示信息 */}
                    {order.status === "active" && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex-1">
                        💡 使用会员码在购物车中享受折扣优惠
                      </div>
                    )}

                    {/* 导出按钮 */}
                    <div className="relative group">
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        导出
                      </button>
                      {/* 下拉菜单 */}
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-white shadow-lg rounded-md border z-10 min-w-[120px]">
                        <button
                          onClick={() => exportSingleOrder(order, "csv")}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          导出CSV
                        </button>
                        <button
                          onClick={() => exportSingleOrder(order, "json")}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 border-t"
                        >
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          导出JSON
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 分页控制 */}
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
    </div>
  )
}
