"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    title: string
    coverImage: string | null
  }
}

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  status: string
  paymentMethod: string | null
  createdAt: string
  orderItems: OrderItem[]
  payment: {
    status: string
    transactionId: string | null
  } | null
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "待支付", color: "text-yellow-600 bg-yellow-50" },
  paid: { label: "已支付", color: "text-green-600 bg-green-50" },
  completed: { label: "已完成", color: "text-blue-600 bg-blue-50" },
  cancelled: { label: "已取消", color: "text-gray-600 bg-gray-50" },
  refunded: { label: "已退款", color: "text-red-600 bg-red-50" },
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  })
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [jumpToPage, setJumpToPage] = useState("")

  useEffect(() => {
    fetchOrders()
  }, [pagination.page, pagination.limit, statusFilter])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) {
        params.append("search", search)
      }

      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }

      const res = await fetch(`/api/orders?${params}`)

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("请先登录")
        }
        throw new Error("获取订单列表失败")
      }

      const data = await res.json()
      setOrders(data.orders || [])
      setPagination(data.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取订单列表失败")
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

  const createPayment = async (orderId: string) => {
    const paymentMethod = prompt("请选择支付方式：\n1. alipay (支付宝)\n2. wechat (微信)\n3. paypal (PayPal)")

    if (!paymentMethod || !["alipay", "wechat", "paypal"].includes(paymentMethod)) {
      alert("无效的支付方式")
      return
    }

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, paymentMethod }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "创建支付失败")
      }

      const data = await res.json()

      if (data.paymentUrl) {
        // 跳转到支付页面
        window.location.href = data.paymentUrl
      } else {
        alert("支付创建成功，请按提示完成支付")
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建支付失败")
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/auth/signin" className="text-blue-600 hover:underline">
            去登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">我的订单</h1>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              搜索订单号
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">暂无订单</p>
          <Link
            href="/products"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            去购物
          </Link>
        </div>
      ) : (
        <>
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = statusMap[order.status] || statusMap.pending
            return (
              <div key={order.id} className="bg-white rounded-lg shadow p-6">
                {/* 订单头部 */}
                <div className="flex justify-between items-start mb-4 pb-4 border-b">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">
                        订单号: {order.orderNumber}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      下单时间: {new Date(order.createdAt).toLocaleString("zh-CN")}
                    </p>
                    {order.paymentMethod && (
                      <p className="text-sm text-gray-600">
                        支付方式: {order.paymentMethod}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      ¥{order.totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* 订单商品 */}
                <div className="space-y-3 mb-4">
                  {order.orderItems.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <Link
                        href={`/products/${item.product.id}`}
                        className="text-blue-600 hover:underline flex-1"
                      >
                        {item.product.title}
                      </Link>
                      <div className="text-gray-600">
                        x{item.quantity}
                      </div>
                      <div className="font-semibold w-24 text-right">
                        ¥{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 订单操作 */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  {order.status === "pending" && (
                    <button
                      onClick={() => createPayment(order.id)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      去支付
                    </button>
                  )}
                  {order.payment && order.payment.transactionId && (
                    <span className="text-sm text-gray-600">
                      交易号: {order.payment.transactionId}
                    </span>
                  )}
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

                  <div className="flex gap-1">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
                      // 只显示当前页附近的页码
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
