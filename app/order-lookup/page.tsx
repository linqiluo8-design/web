"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    title: string
    description: string
    price: number
    coverImage: string | null
    category: string | null
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
    paymentMethod: string
  } | null
}

export default function OrderLookupPage() {
  const [orderNumber, setOrderNumber] = useState("")
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!orderNumber.trim()) {
      setError("请输入订单号")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setOrder(null)

      const res = await fetch(`/api/orders/lookup?orderNumber=${encodeURIComponent(orderNumber.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "查询失败")
      }

      setOrder(data.order)
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败")
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">订单查询</h1>

      {/* 搜索表单 */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            placeholder="请输入订单号（例如：ORD1234567890ABCDEF）"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "查询中..." : "查询订单"}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* 订单详情 */}
      {order && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* 订单信息头部 */}
          <div className="bg-gray-50 px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2">订单详情</h2>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>订单号: <span className="font-mono font-medium text-gray-900">{order.orderNumber}</span></p>
                  <p>下单时间: {new Date(order.createdAt).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                  {getStatusText(order.status)}
                </span>
              </div>
            </div>
          </div>

          {/* 商品列表 */}
          <div className="px-6 py-4">
            <h3 className="font-semibold mb-4">商品清单</h3>
            <div className="space-y-4">
              {order.orderItems.map((item) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                  <Link
                    href={`/products/${item.product.id}`}
                    className="relative w-20 h-20 bg-gray-100 rounded flex-shrink-0"
                  >
                    {item.product.coverImage ? (
                      <Image
                        src={item.product.coverImage}
                        alt={item.product.title}
                        fill
                        className="object-cover rounded"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                        暂无图片
                      </div>
                    )}
                  </Link>

                  <div className="flex-1">
                    <Link
                      href={`/products/${item.product.id}`}
                      className="font-semibold hover:text-blue-600 block mb-1"
                    >
                      {item.product.title}
                    </Link>
                    {item.product.category && (
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {item.product.category}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="font-medium text-gray-900">¥{item.price.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">x {item.quantity}</div>
                    <div className="text-sm font-medium mt-1">
                      小计: ¥{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 订单总计 */}
          <div className="bg-gray-50 px-6 py-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-gray-600">
                {order.paymentMethod && (
                  <p className="text-sm">支付方式: {order.paymentMethod}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">订单总额</p>
                <p className="text-2xl font-bold text-blue-600">¥{order.totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          {order.status === "pending" && (
            <div className="px-6 py-4 border-t">
              <div className="flex gap-4 justify-end">
                <button
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={() => alert("支付功能开发中...")}
                >
                  去支付
                </button>
                <button
                  className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  onClick={() => alert("取消功能开发中...")}
                >
                  取消订单
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 提示信息 */}
      {!order && !loading && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold mb-2 text-blue-900">温馨提示</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 订单号在购买成功后会显示，请妥善保管</li>
            <li>• 订单号格式类似：ORD1234567890ABCDEF</li>
            <li>• 如有疑问，请联系客服</li>
          </ul>
        </div>
      )}

      {/* 返回购物 */}
      <div className="mt-8 text-center">
        <Link
          href="/products"
          className="inline-block px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          继续购物
        </Link>
      </div>
    </div>
  )
}
