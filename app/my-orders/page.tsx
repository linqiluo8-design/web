"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import OrderCountdown from "@/components/OrderCountdown"

interface OrderRecord {
  orderNumber: string
  createdAt: number
  totalAmount: number
}

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  status: string
  createdAt: string
  expiresAt: string | null
  orderItems: {
    id: string
    quantity: number
    price: number
    product: {
      id: string
      title: string
      coverImage: string | null
    }
  }[]
}

const ORDER_STORAGE_KEY = "my_orders"

export default function MyOrdersPage() {
  const [allOrders, setAllOrders] = useState<Order[]>([]) // 所有订单
  const [displayedOrders, setDisplayedOrders] = useState<Order[]>([]) // 当前页显示的订单
  const [loading, setLoading] = useState(true)
  const [orderRecords, setOrderRecords] = useState<OrderRecord[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(5) // 默认每页5条
  const [jumpToPage, setJumpToPage] = useState("")
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set()) // 选中的订单ID
  const [openExportMenu, setOpenExportMenu] = useState<string | null>(null) // 当前打开的导出菜单订单ID
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
    loadOrders()
  }, [])

  // 处理分页和搜索
  useEffect(() => {
    updateDisplayedOrders()
  }, [allOrders, page, limit, searchQuery])

  // 定期检查并取消过期订单
  useEffect(() => {
    const cancelExpiredOrders = async () => {
      try {
        await fetch("/api/orders/cancel-expired")
        // 静默处理，不需要提示用户
      } catch (err) {
        console.error("取消过期订单失败:", err)
      }
    }

    // 初始化时执行一次
    cancelExpiredOrders()

    // 每30秒检查一次过期订单
    const interval = setInterval(() => {
      cancelExpiredOrders()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openExportMenu])

  const loadOrders = async () => {
    try {
      setLoading(true)
      // 从localStorage获取订单号列表
      const stored = localStorage.getItem(ORDER_STORAGE_KEY)
      const records: OrderRecord[] = stored ? JSON.parse(stored) : []
      setOrderRecords(records)

      if (records.length === 0) {
        setLoading(false)
        return
      }

      // 批量查询订单详情
      const orderPromises = records.map(record =>
        fetch(`/api/orders/lookup?orderNumber=${record.orderNumber}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => data?.order)
      )

      const orderResults = await Promise.all(orderPromises)
      const validOrders = orderResults.filter(order => order != null) // Filter both null and undefined

      // 清理localStorage中不存在的订单记录
      const validOrderNumbers = validOrders.map(o => o.orderNumber)
      const cleanedRecords = records.filter(r => validOrderNumbers.includes(r.orderNumber))

      if (cleanedRecords.length !== records.length) {
        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(cleanedRecords))
        setOrderRecords(cleanedRecords)
      }

      // 按创建时间倒序排序
      validOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      setAllOrders(validOrders)
    } catch (error) {
      console.error("加载订单失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateDisplayedOrders = () => {
    // 搜索过滤
    let filtered = allOrders
    if (searchQuery.trim()) {
      filtered = allOrders.filter(order =>
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // 分页
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginated = filtered.slice(startIndex, endIndex)

    setDisplayedOrders(paginated)
  }

  const handleSearch = () => {
    setPage(1) // 搜索时回到第一页
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1)
  }

  const handleJumpToPage = () => {
    const totalPages = getTotalPages()
    const pageNum = parseInt(jumpToPage)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum)
      setJumpToPage("")
    }
  }

  const getTotalPages = () => {
    const filtered = searchQuery.trim()
      ? allOrders.filter(order => order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      : allOrders
    return Math.ceil(filtered.length / limit)
  }

  const getFilteredTotal = () => {
    const filtered = searchQuery.trim()
      ? allOrders.filter(order => order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      : allOrders
    return filtered.length
  }

  // 获取过滤后的订单
  const getFilteredOrders = () => {
    if (searchQuery.trim()) {
      return allOrders.filter(order =>
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return allOrders
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "待支付",
      paid: "已支付",
      cancelled: "已取消",
      refunded: "已退款"
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      cancelled: "bg-gray-100 text-gray-800",
      refunded: "bg-red-100 text-red-800"
    }
    return colorMap[status] || "bg-gray-100 text-gray-800"
  }

  const handleOrderExpire = () => {
    // 订单过期后重新加载订单列表
    loadOrders()
  }

  const clearOrders = () => {
    if (confirm("确定要清空所有订单记录吗？\n\n注意：这只会清除本地记录，不会删除实际订单。")) {
      localStorage.removeItem(ORDER_STORAGE_KEY)
      setAllOrders([])
      setDisplayedOrders([])
      setOrderRecords([])
    }
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
    if (selectedOrders.size === displayedOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(displayedOrders.map(o => o.id)))
    }
  }

  // 调用后端API导出订单
  const exportOrdersViaAPI = async (
    orderNumbersToExport: string[],
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
        orderNumbers: orderNumbersToExport.join(',')
      })

      const response = await fetch(`/api/backendmanager/orders/export?${params}`)

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
      let filename = `orders_${Date.now()}.${format}`
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
  const exportSingleOrder = async (order: Order, format: "json" | "csv") => {
    // 调用后端API导出
    await exportOrdersViaAPI([order.orderNumber], format)
  }

  // 导出选中的订单
  const exportSelectedOrders = async (format: "json" | "csv") => {
    const filteredOrders = getFilteredOrders()
    const ordersToExport = filteredOrders.filter(order => selectedOrders.has(order.id))
    if (ordersToExport.length === 0) {
      alert("请先选择要导出的订单")
      return
    }

    // 获取订单号列表
    const orderNumbers = ordersToExport.map(order => order.orderNumber)

    // 调用后端API导出
    await exportOrdersViaAPI(orderNumbers, format)

    // 导出后清除选择
    setSelectedOrders(new Set())
  }

  // 导出全部订单（导出当前搜索结果的所有订单）
  const exportAllOrders = async (format: "json" | "csv") => {
    const filteredOrders = getFilteredOrders()
    if (filteredOrders.length === 0) {
      alert("没有可导出的订单")
      return
    }

    // 获取订单号列表
    const orderNumbers = filteredOrders.map(order => order.orderNumber)

    // 调用后端API导出
    await exportOrdersViaAPI(orderNumbers, format)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  const totalPages = getTotalPages()
  const filteredTotal = getFilteredTotal()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">我的订单</h1>
        {allOrders.length > 0 && (
          <button
            onClick={clearOrders}
            className="text-sm text-gray-600 hover:text-red-600"
          >
            清空记录
          </button>
        )}
      </div>

      {/* 搜索框 */}
      {allOrders.length > 0 && (
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch()
                }
              }}
              placeholder="搜索订单号..."
              className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              搜索
            </button>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("")
                  setPage(1)
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                清除搜索
              </button>
            )}
          </div>
        </div>
      )}

      {allOrders.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-gray-500 mb-6">暂无订单记录</p>
          <p className="text-sm text-gray-400 mb-6">
            购买商品后，订单会自动保存在这里
          </p>
          <Link
            href="/products"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            去购物
          </Link>
        </div>
      ) : filteredTotal === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-500 mb-6">未找到匹配的订单</p>
          <button
            onClick={() => {
              setSearchQuery("")
              setPage(1)
            }}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            清除搜索
          </button>
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
                    checked={selectedOrders.size === displayedOrders.length && displayedOrders.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">全选本页</span>
                </label>
                {selectedOrders.size > 0 && (
                  <span className="text-sm text-gray-600">
                    已选择 {selectedOrders.size} 条订单
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
            {displayedOrders.map((order) => (
              <div
              key={order.id}
              className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 overflow-hidden relative"
            >
              {/* 状态装饰条 */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                order.status === 'paid' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                order.status === 'pending' ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                order.status === 'refunded' ? 'bg-gradient-to-r from-red-400 to-pink-500' :
                'bg-gradient-to-r from-gray-400 to-gray-500'
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
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-6 py-4 border-b-2 border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-gray-600 font-medium">订单号:</span>
                        </div>
                        <span className="font-mono font-semibold text-gray-800 bg-white px-3 py-1 rounded-lg shadow-sm">{order.orderNumber}</span>
                        <span className="text-gray-300">•</span>
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-md ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </div>
                    {/* 待支付订单显示倒计时 */}
                    {order.status === "pending" && order.expiresAt && (
                      <div className="mt-3 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-3">
                        <div className="flex items-center justify-start mb-1">
                          <OrderCountdown
                            expiresAt={order.expiresAt}
                            onExpire={handleOrderExpire}
                            showIcon={true}
                            className="text-sm font-semibold text-orange-700"
                          />
                        </div>
                        <p className="text-xs text-orange-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          订单将在倒计时结束后自动取消，请尽快完成支付
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 订单商品列表 */}
                  <div className="p-6 bg-gradient-to-b from-white to-gray-50">
                    {order.orderItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 mb-4 last:mb-0 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100">
                        <Link
                          href={`/products/${item.product.id}`}
                          className="relative w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex-shrink-0 overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                        >
                          {item.product.coverImage ? (
                            <Image
                              src={item.product.coverImage}
                              alt={item.product.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                              <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs">暂无图片</span>
                            </div>
                          )}
                        </Link>

                        <div className="flex-1">
                          <Link
                            href={`/products/${item.product.id}`}
                            className="font-semibold text-gray-800 hover:text-blue-600 transition-colors duration-200 block mb-2"
                          >
                            {item.product.title}
                          </Link>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                              ¥{item.price.toFixed(2)}
                            </span>
                            <span className="text-gray-400">×</span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">
                              {item.quantity}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-gray-500 mb-1">小计</div>
                          <p className="text-lg font-bold text-gray-900">¥{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 订单底部 - 使用渐变背景 */}
                  <div className="bg-gradient-to-r from-gray-50 via-blue-50 to-purple-50 px-6 py-5 border-t-2 border-gray-100 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <span>共 <span className="text-blue-600 font-bold">{order.orderItems.reduce((sum, item) => sum + item.quantity, 0)}</span> 件商品</span>
                    </div>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="text-right bg-white px-4 py-2 rounded-xl shadow-sm border-2 border-gray-100">
                        <span className="text-sm text-gray-600 mr-2">订单总额</span>
                        <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                          ¥{order.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        {/* 导出按钮 - 更酷炫的设计 */}
                        <div className="relative export-menu-container">
                          <button
                            onClick={() => setOpenExportMenu(openExportMenu === order.id ? null : order.id)}
                            disabled={isExporting}
                            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                          >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                            {isExporting ? '导出中...' : '导出'}
                            <svg className={`w-4 h-4 transition-transform duration-200 ${openExportMenu === order.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {/* 下拉菜单 - 更酷炫的设计 */}
                          {openExportMenu === order.id && !isExporting && (
                            <div className="absolute right-0 top-full mt-2 bg-white shadow-2xl rounded-xl border-2 border-gray-100 z-50 min-w-[160px] overflow-hidden">
                              <button
                                onClick={async () => {
                                  await exportSingleOrder(order, "csv")
                                  setOpenExportMenu(null)
                                }}
                                className="w-full px-4 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 flex items-center gap-3 transition-colors duration-200 font-medium"
                              >
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-gray-700">导出CSV</span>
                              </button>
                              <button
                                onClick={async () => {
                                  await exportSingleOrder(order, "json")
                                  setOpenExportMenu(null)
                                }}
                                className="w-full px-4 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 flex items-center gap-3 border-t border-gray-100 transition-colors duration-200 font-medium"
                              >
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                <span className="text-gray-700">导出JSON</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {order.status === "pending" && (
                          <Link
                            href={`/payment/${order.id}`}
                            className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            去支付
                          </Link>
                        )}
                        <Link
                          href={`/order-lookup?orderNumber=${order.orderNumber}`}
                          className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          订单详情
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页控制 */}
          {totalPages > 0 && (
            <div className="mt-8 space-y-4">
              {/* 每页数量选择 */}
              <div className="flex justify-center items-center gap-3 flex-wrap">
                <span className="text-sm text-gray-600">每页显示：</span>
                <div className="flex gap-2">
                  {[5, 10, 15, 20, 25, 30, 40, 50].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleLimitChange(num)}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        limit === num
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  共 {filteredTotal} 条订单
                </span>
              </div>

              {/* 分页导航 */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>

                  <span className="px-4 py-2">
                    第 {page} / {totalPages} 页
                  </span>

                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
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
                      max={totalPages}
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
                当前第 {page}/{totalPages} 页
              </div>
            </div>
          )}
        </>
      )}

      {/* 温馨提示 */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-900">💡 温馨提示</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 未支付订单将在15分钟后自动取消，请及时完成支付</li>
          <li>• 订单记录保存在浏览器本地，清除浏览器数据会导致记录丢失</li>
          <li>• 请妥善保管订单号，可随时在"订单查询"页面查询</li>
          <li>• 换电脑或换浏览器需要使用订单号手动查询</li>
          <li>• <strong>导出限制：</strong>只有已支付订单支持导出，每个已支付订单最多可导出2次</li>
        </ul>
      </div>
    </div>
  )
}

// 导出工具函数：保存订单号到localStorage
export function saveOrderToLocal(orderNumber: string, totalAmount: number) {
  try {
    const stored = localStorage.getItem(ORDER_STORAGE_KEY)
    const orders: OrderRecord[] = stored ? JSON.parse(stored) : []

    // 避免重复
    if (!orders.find(o => o.orderNumber === orderNumber)) {
      orders.unshift({
        orderNumber,
        createdAt: Date.now(),
        totalAmount
      })

      // 只保留最近50个订单
      if (orders.length > 50) {
        orders.splice(50)
      }

      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders))
    }
  } catch (error) {
    console.error("保存订单记录失败:", error)
  }
}
