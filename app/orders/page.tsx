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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/orders")

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("请先登录")
        }
        throw new Error("获取订单列表失败")
      }

      const data = await res.json()
      setOrders(data.orders || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取订单列表失败")
    } finally {
      setLoading(false)
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

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">暂无订单</p>
          <Link
            href="/products"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            去购物
          </Link>
        </div>
      ) : (
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
      )}
    </div>
  )
}
