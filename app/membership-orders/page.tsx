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
    limit: 10,
    totalPages: 0
  })
  const [search, setSearch] = useState("")
  const [jumpToPage, setJumpToPage] = useState("")

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
          <div className="space-y-4">
            {orders.map((order) => {
              const statusInfo = statusMap[order.status] || statusMap.active
              return (
                <div key={order.id} className="bg-white rounded-lg shadow p-6">
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

                  {/* 提示信息 */}
                  {order.status === "active" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                      💡 使用会员码在购物车中享受折扣优惠
                    </div>
                  )}
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
