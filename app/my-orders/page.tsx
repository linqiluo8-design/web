"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"

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
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [orderRecords, setOrderRecords] = useState<OrderRecord[]>([])

  useEffect(() => {
    loadOrders()
  }, [])

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
      const validOrders = orderResults.filter(order => order !== null)

      // 清理localStorage中不存在的订单记录
      const validOrderNumbers = validOrders.map(o => o.orderNumber)
      const cleanedRecords = records.filter(r => validOrderNumbers.includes(r.orderNumber))

      if (cleanedRecords.length !== records.length) {
        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(cleanedRecords))
        setOrderRecords(cleanedRecords)
      }

      // 按创建时间倒序排序
      validOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      setOrders(validOrders)
    } catch (error) {
      console.error("加载订单失败:", error)
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

  const clearOrders = () => {
    if (confirm("确定要清空所有订单记录吗？\n\n注意：这只会清除本地记录，不会删除实际订单。")) {
      localStorage.removeItem(ORDER_STORAGE_KEY)
      setOrders([])
      setOrderRecords([])
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">我的订单</h1>
        {orders.length > 0 && (
          <button
            onClick={clearOrders}
            className="text-sm text-gray-600 hover:text-red-600"
          >
            清空记录
          </button>
        )}
      </div>

      {orders.length === 0 ? (
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
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-lg shadow border overflow-hidden"
            >
              {/* 订单头部 */}
              <div className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">订单号:</span>
                  <span className="font-mono font-medium">{order.orderNumber}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-600">
                    {new Date(order.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                  {getStatusText(order.status)}
                </span>
              </div>

              {/* 订单商品列表 */}
              <div className="p-6">
                {order.orderItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 mb-4 last:mb-0">
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
                        className="font-medium hover:text-blue-600"
                      >
                        {item.product.title}
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">
                        ¥{item.price.toFixed(2)} × {item.quantity}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-medium">¥{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 订单底部 */}
              <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  共 {order.orderItems.reduce((sum, item) => sum + item.quantity, 0)} 件商品
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-sm text-gray-600 mr-2">订单总额:</span>
                    <span className="text-xl font-bold text-red-600">
                      ¥{order.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {order.status === "pending" && (
                      <Link
                        href={`/payment/${order.id}`}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                      >
                        去支付
                      </Link>
                    )}
                    <Link
                      href={`/order-lookup?orderNumber=${order.orderNumber}`}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                    >
                      订单详情
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 温馨提示 */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-900">💡 温馨提示</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 订单记录保存在浏览器本地，清除浏览器数据会导致记录丢失</li>
          <li>• 请妥善保管订单号，可随时在"订单查询"页面查询</li>
          <li>• 换电脑或换浏览器需要使用订单号手动查询</li>
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
