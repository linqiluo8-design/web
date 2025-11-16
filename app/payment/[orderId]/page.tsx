"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

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
  orderItems: OrderItem[]
}

export default function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string>("")
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    params.then((resolvedParams) => {
      setOrderId(resolvedParams.orderId)
    })
  }, [params])

  useEffect(() => {
    if (orderId) {
      fetchOrder()
    }
  }, [orderId])

  const fetchOrder = async () => {
    if (!orderId) return

    try {
      setLoading(true)
      const res = await fetch(`/api/orders/${orderId}`)

      if (!res.ok) {
        throw new Error("订单不存在")
      }

      const data = await res.json()
      setOrder(data.order)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取订单失败")
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!selectedMethod) {
      alert("请选择支付方式")
      return
    }

    if (!order) return

    setProcessing(true)

    try {
      const res = await fetch(`/api/payment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: order.totalAmount,
          paymentMethod: selectedMethod
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "支付失败")
      }

      const data = await res.json()

      // 根据不同支付方式处理
      if (selectedMethod === "alipay") {
        // 支付宝：跳转到支付宝页面
        if (data.payUrl) {
          window.location.href = data.payUrl
        } else {
          throw new Error("支付链接获取失败")
        }
      } else if (selectedMethod === "wechat") {
        // 微信：显示二维码
        alert("请使用微信扫描二维码支付\n\n（演示模式：直接模拟支付成功）")
        // 模拟支付成功
        setTimeout(() => {
          router.push(`/payment/success?orderNumber=${order.orderNumber}&amount=${order.totalAmount}`)
        }, 1000)
      } else if (selectedMethod === "paypal") {
        // PayPal：跳转到PayPal
        if (data.approvalUrl) {
          window.location.href = data.approvalUrl
        } else {
          throw new Error("PayPal支付链接获取失败")
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "支付失败")
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "订单不存在"}</p>
          <Link href="/products" className="text-blue-600 hover:underline">
            返回商品列表
          </Link>
        </div>
      </div>
    )
  }

  if (order.status !== "pending") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600 mb-4">此订单已{order.status === "paid" ? "支付" : "取消"}</p>
          <Link href="/products" className="text-blue-600 hover:underline">
            返回商品列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">订单支付</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* 订单信息 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">订单信息</h2>

          <div className="mb-4">
            <p className="text-sm text-gray-600">订单号</p>
            <p className="font-mono font-medium">{order.orderNumber}</p>
          </div>

          <div className="border-t pt-4 mb-4">
            <h3 className="font-semibold mb-3">商品清单</h3>
            {order.orderItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 mb-3">
                {item.product.coverImage && (
                  <div className="relative w-12 h-12 bg-gray-100 rounded">
                    <Image
                      src={item.product.coverImage}
                      alt={item.product.title}
                      fill
                      className="object-cover rounded"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.product.title}</p>
                  <p className="text-xs text-gray-600">x {item.quantity}</p>
                </div>
                <p className="font-medium">¥{(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">支付金额</span>
              <span className="text-2xl font-bold text-red-600">
                ¥{order.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* 支付方式选择 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">选择支付方式</h2>

          <div className="space-y-3">
            {/* 支付宝 */}
            <div
              onClick={() => setSelectedMethod("alipay")}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedMethod === "alipay"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500 rounded flex items-center justify-center text-white font-bold">
                    支
                  </div>
                  <div>
                    <p className="font-semibold">支付宝</p>
                    <p className="text-xs text-gray-600">推荐使用</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 ${
                  selectedMethod === "alipay"
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-300"
                }`}>
                  {selectedMethod === "alipay" && (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 微信支付 */}
            <div
              onClick={() => setSelectedMethod("wechat")}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedMethod === "wechat"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-green-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500 rounded flex items-center justify-center text-white font-bold">
                    微
                  </div>
                  <div>
                    <p className="font-semibold">微信支付</p>
                    <p className="text-xs text-gray-600">扫码支付</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 ${
                  selectedMethod === "wechat"
                    ? "border-green-500 bg-green-500"
                    : "border-gray-300"
                }`}>
                  {selectedMethod === "wechat" && (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PayPal */}
            <div
              onClick={() => setSelectedMethod("paypal")}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedMethod === "paypal"
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-gray-200 hover:border-yellow-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-500 rounded flex items-center justify-center text-white font-bold">
                    P
                  </div>
                  <div>
                    <p className="font-semibold">PayPal</p>
                    <p className="text-xs text-gray-600">国际支付</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 ${
                  selectedMethod === "paypal"
                    ? "border-yellow-500 bg-yellow-500"
                    : "border-gray-300"
                }`}>
                  {selectedMethod === "paypal" && (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 支付按钮 */}
          <button
            onClick={handlePayment}
            disabled={!selectedMethod || processing}
            className="w-full mt-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? "处理中..." : `确认支付 ¥${order.totalAmount.toFixed(2)}`}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            点击支付即表示同意相关服务协议
          </p>
        </div>
      </div>

      {/* 温馨提示 */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-yellow-800">温馨提示</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 请妥善保管订单号：<span className="font-mono font-bold">{order.orderNumber}</span></li>
          <li>• 支付完成后，可在"订单查询"页面查看订单状态</li>
          <li>• 如遇问题，请联系客服并提供订单号</li>
        </ul>
      </div>
    </div>
  )
}
