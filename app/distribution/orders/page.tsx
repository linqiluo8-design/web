"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface DistributionOrder {
  id: string
  orderNumber: string
  orderAmount: number
  commissionAmount: number
  commissionRate: number
  status: string
  products: Array<{
    title: string
    quantity: number
    price: number
  }>
  createdAt: string
  confirmedAt?: string
  settledAt?: string
}

interface OrdersResponse {
  orders: DistributionOrder[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export default function DistributionOrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<DistributionOrder[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [pageSize, setPageSize] = useState(5)
  const [searchQuery, setSearchQuery] = useState("")
  const [jumpToPage, setJumpToPage] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/distribution/orders")
      return
    }

    if (status === "authenticated") {
      fetchOrders(1, pageSize, searchQuery)
    }
  }, [status])

  const fetchOrders = async (page: number, size: number = pageSize, search: string = searchQuery) => {
    try {
      setLoading(true)
      const url = `/api/distribution/stats?type=orders&page=${page}&pageSize=${size}${search ? `&search=${encodeURIComponent(search)}` : ""}`
      const response = await fetch(url)

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 404) {
          // 用户还不是分销商
          router.push("/distribution")
          return
        }
        throw new Error(error.error || "获取订单失败")
      }

      const data: OrdersResponse = await response.json()
      setOrders(data.orders)
      setPagination(data.pagination)
    } catch (error) {
      console.error("获取订单失败:", error)
      alert(error instanceof Error ? error.message : "获取订单失败")
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    fetchOrders(newPage, pageSize, searchQuery)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    fetchOrders(1, newSize, searchQuery)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchOrders(1, pageSize, searchQuery)
  }

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault()
    const page = parseInt(jumpToPage)
    if (!isNaN(page) && page >= 1 && page <= pagination.totalPages) {
      fetchOrders(page, pageSize, searchQuery)
      setJumpToPage("")
    } else {
      alert(`请输入有效的页码 (1-${pagination.totalPages})`)
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "待确认",
      confirmed: "已确认",
      settled: "已结算",
      cancelled: "已取消"
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: "text-yellow-600 bg-yellow-50",
      confirmed: "text-blue-600 bg-blue-50",
      settled: "text-green-600 bg-green-50",
      cancelled: "text-gray-600 bg-gray-50"
    }
    return colorMap[status] || "text-gray-600 bg-gray-50"
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/distribution"
            className="text-gray-600 hover:text-gray-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold">推广订单</h1>
        </div>
        <div className="text-sm text-gray-600">
          共 {pagination.total} 条记录
        </div>
      </div>

      {/* 搜索和控制面板 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* 搜索框 */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索订单号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  handleSearch(e)
                }}
                className="absolute left-3 top-2.5 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                aria-label="搜索"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </form>

          {/* 每页显示数量 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">每页显示:</label>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5条</option>
              <option value={10}>10条</option>
              <option value={20}>20条</option>
              <option value={50}>50条</option>
              <option value={100}>100条</option>
            </select>
          </div>

          {/* 跳转页面 */}
          {pagination.totalPages > 1 && (
            <form onSubmit={handleJumpToPage} className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">跳转到:</label>
              <input
                type="number"
                min="1"
                max={pagination.totalPages}
                placeholder="页码"
                value={jumpToPage}
                onChange={(e) => setJumpToPage(e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                跳转
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 订单列表 */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-gray-600 mb-4">
            {searchQuery ? `未找到包含 "${searchQuery}" 的订单` : "暂无推广订单"}
          </p>
          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery("")
                fetchOrders(1, pageSize, "")
              }}
              className="text-blue-600 hover:text-blue-700"
            >
              清除搜索条件
            </button>
          ) : (
            <Link
              href="/distribution"
              className="text-blue-600 hover:text-blue-700"
            >
              返回分销中心
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* 订单卡片 */}
          <div className="space-y-4 mb-8">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                {/* 订单头部 */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      订单号: <span className="font-mono text-gray-900">{order.orderNumber}</span>
                    </span>
                    <span className="text-sm text-gray-600">
                      下单时间: {new Date(order.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>

                {/* 订单内容 */}
                <div className="px-6 py-4">
                  {/* 商品列表 */}
                  <div className="mb-4">
                    {order.products.map((product, index) => (
                      <div key={index} className="flex items-center justify-between py-2">
                        <div className="flex-1">
                          <span className="text-gray-800">{product.title}</span>
                          <span className="text-gray-500 text-sm ml-2">x{product.quantity}</span>
                        </div>
                        <span className="text-gray-600">¥{product.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* 金额信息 */}
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-8">
                        <div>
                          <p className="text-sm text-gray-600">订单金额</p>
                          <p className="text-lg font-semibold text-gray-900">
                            ¥{order.orderAmount.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">佣金比例</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {(order.commissionRate * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">获得佣金</p>
                          <p className="text-lg font-semibold text-green-600">
                            ¥{order.commissionAmount.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* 时间信息 */}
                      <div className="text-right text-sm text-gray-500">
                        {order.confirmedAt && (
                          <p>确认时间: {new Date(order.confirmedAt).toLocaleString('zh-CN')}</p>
                        )}
                        {order.settledAt && (
                          <p>结算时间: {new Date(order.settledAt).toLocaleString('zh-CN')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i
                  } else {
                    pageNum = pagination.page - 2 + i
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-4 py-2 border rounded-md ${
                        pageNum === pagination.page
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
