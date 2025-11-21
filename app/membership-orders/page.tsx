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
  const [openExportMenu, setOpenExportMenu] = useState<string | null>(null) // 控制打开的导出菜单
  const [visitorId, setVisitorId] = useState<string>('') // 访客ID
  const [isExporting, setIsExporting] = useState(false) // 导出中状态

  // 初始化或获取访客ID
  useEffect(() => {
    const getOrCreateVisitorId = () => {
      const stored = localStorage.getItem('visitor_id')
      if (stored) {
        return stored
      }
      // 生成新的访客ID
      const newId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('visitor_id', newId)
      return newId
    }
    setVisitorId(getOrCreateVisitorId())
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [pagination.page, pagination.limit])

  // 点击外部关闭导出菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openExportMenu) {
        const target = event.target as HTMLElement
        if (!target.closest('.export-menu-container')) {
          setOpenExportMenu(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openExportMenu])

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

  // 调用后端API导出会员订单
  const exportOrdersViaAPI = async (
    membershipCodesToExport: string[],
    format: 'json' | 'csv'
  ) => {
    if (isExporting) {
      return // 防止重复点击
    }

    try {
      setIsExporting(true)

      // 构建API URL
      const params = new URLSearchParams({
        format,
        visitorId,
        membershipCodes: membershipCodesToExport.join(',')
      })

      const response = await fetch(`/api/membership-orders/export?${params}`)

      if (!response.ok) {
        // 处理错误响应
        const errorData = await response.json().catch(() => ({ error: '导出失败' }))

        if (response.status === 403) {
          // 超过导出限制
          alert(errorData.error || '导出次数已用完')
        } else {
          alert(errorData.error || '导出失败，请稍后重试')
        }
        return
      }

      // 成功，下载文件
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // 从响应头获取文件名，或使用默认文件名
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `membership_orders_${Date.now()}.${format}`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=(.+)/)
        if (match) {
          filename = match[1]
        }
      }

      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      alert('导出成功！')
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败，请稍后重试')
    } finally {
      setIsExporting(false)
    }
  }

  // 导出单个订单
  const exportSingleOrder = async (order: MembershipOrder, format: "json" | "csv") => {
    // 调用后端API导出
    await exportOrdersViaAPI([order.membershipCode], format)
  }

  // 导出选中的订单
  const exportSelectedOrders = async (format: "json" | "csv") => {
    const ordersToExport = orders.filter(order => selectedOrders.has(order.id))
    if (ordersToExport.length === 0) {
      alert("请先选择要导出的会员订单")
      return
    }

    // 获取会员码列表
    const membershipCodes = ordersToExport.map(order => order.membershipCode)

    // 调用后端API导出
    await exportOrdersViaAPI(membershipCodes, format)

    // 导出后清除选择
    setSelectedOrders(new Set())
  }

  // 导出全部订单
  const exportAllOrders = async (format: "json" | "csv") => {
    if (pagination.total === 0) {
      alert("没有可导出的会员订单")
      return
    }

    // 获取所有会员码
    const membershipCodes = getMembershipCodesFromStorage()

    // 调用后端API导出
    await exportOrdersViaAPI(membershipCodes, format)
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
                      disabled={isExporting}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {isExporting ? '导出中...' : '导出选中 (CSV)'}
                    </button>
                    <button
                      onClick={() => exportSelectedOrders("json")}
                      disabled={isExporting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {isExporting ? '导出中...' : '导出选中 (JSON)'}
                    </button>
                  </div>
                )}

                {/* 导出全部按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => exportAllOrders("csv")}
                    disabled={isExporting}
                    className="px-4 py-2 border border-green-600 text-green-600 rounded-md hover:bg-green-50 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {isExporting ? '导出中...' : '导出全部 (CSV)'}
                  </button>
                  <button
                    onClick={() => exportAllOrders("json")}
                    disabled={isExporting}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {isExporting ? '导出中...' : '导出全部 (JSON)'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {orders.map((order) => {
              const statusInfo = statusMap[order.status] || statusMap.active
              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 overflow-hidden relative">
                  {/* 状态装饰条 */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    order.status === 'active' ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                    order.status === 'expired' ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                    'bg-gradient-to-r from-blue-400 to-indigo-500'
                  }`}></div>

                  <div className="flex">
                    {/* 复选框区域 */}
                    <div className="flex items-center justify-center px-6 bg-gradient-to-b from-gray-50 to-gray-100 border-r-2 border-gray-100">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => toggleSelectOrder(order.id)}
                        className="w-6 h-6 text-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer transition-transform hover:scale-110"
                      />
                    </div>

                    {/* 订单内容 */}
                    <div className="flex-1">
                      {/* 订单头部 - 使用渐变背景 */}
                      <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 px-6 py-5 border-b-2 border-gray-100">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                              <h3 className="font-bold text-2xl text-gray-800">
                                {order.plan.name}
                              </h3>
                              <span className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-md ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>购买时间: {formatDate(order.createdAt)}</span>
                            </div>
                          </div>
                          <div className="text-right bg-white px-5 py-3 rounded-xl shadow-md border-2 border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">支付金额</div>
                            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                              ¥{order.purchasePrice.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 订单信息 */}
                      <div className="bg-gradient-to-b from-white to-gray-50 px-6 py-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {order.orderNumber && (
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-xs text-gray-500 font-medium">会员订单号</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-sm font-semibold text-gray-800 flex-1">
                                  {order.orderNumber}
                                </p>
                                <button
                                  onClick={() => copyToClipboard(order.orderNumber!, "订单号")}
                                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                  title="复制订单号"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                              <p className="text-xs text-gray-500 font-medium">会员码</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex-1">
                                {order.membershipCode}
                              </p>
                              <button
                                onClick={() => copyToClipboard(order.membershipCode, "会员码")}
                                className="p-2 text-pink-600 hover:text-pink-700 hover:bg-pink-50 rounded-lg transition-all duration-200"
                                title="复制会员码"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {order.paymentMethod && (
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                <p className="text-xs text-gray-500 font-medium">支付方式</p>
                              </div>
                              <p className="text-sm font-semibold text-gray-800">
                                {paymentMethodMap[order.paymentMethod] || order.paymentMethod}
                              </p>
                            </div>
                          )}

                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-xs text-gray-500 font-medium">会员套餐</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                                {getDurationDisplay(order.duration)}
                              </span>
                              <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                                {(order.discount * 10).toFixed(1)}折
                              </span>
                              <span className="px-3 py-1 bg-pink-50 text-pink-700 rounded-full text-xs font-medium">
                                每日{order.dailyLimit}次
                              </span>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-xs text-gray-500 font-medium">开始时间</p>
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{formatDate(order.startDate)}</p>
                          </div>

                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-xs text-gray-500 font-medium">到期时间</p>
                            </div>
                            <p className="text-sm font-semibold text-gray-800">
                              {order.endDate ? formatDate(order.endDate) : (
                                <span className="bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent font-bold">
                                  永久有效
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 底部操作栏 */}
                      <div className="bg-gradient-to-r from-gray-50 via-purple-50 to-pink-50 px-6 py-4 border-t-2 border-gray-100">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          {/* 提示信息 */}
                          {order.status === "active" && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex-1 shadow-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">💡</span>
                                <span className="font-medium">使用会员码在购物车中享受折扣优惠</span>
                              </div>
                            </div>
                          )}

                          {/* 导出按钮 */}
                          <div className="relative export-menu-container">
                            <button
                              onClick={() => setOpenExportMenu(openExportMenu === order.id ? null : order.id)}
                              disabled={isExporting}
                              className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {isExporting ? '导出中...' : '导出订单'}
                            </button>
                            {/* 下拉菜单 */}
                            {openExportMenu === order.id && !isExporting && (
                              <div className="absolute right-0 bottom-full mb-2 bg-white shadow-2xl rounded-xl border-2 border-gray-100 z-50 min-w-[160px] overflow-hidden">
                                <button
                                  onClick={async () => {
                                    await exportSingleOrder(order, "csv")
                                    setOpenExportMenu(null)
                                  }}
                                  className="w-full px-5 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 flex items-center gap-3 transition-all duration-200"
                                >
                                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="font-medium text-gray-700">导出CSV</span>
                                </button>
                                <button
                                  onClick={async () => {
                                    await exportSingleOrder(order, "json")
                                    setOpenExportMenu(null)
                                  }}
                                  className="w-full px-5 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 flex items-center gap-3 border-t border-gray-100 transition-all duration-200"
                                >
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                  </svg>
                                  <span className="font-medium text-gray-700">导出JSON</span>
                                </button>
                              </div>
                            )}
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
