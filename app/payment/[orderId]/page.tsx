"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import OrderCountdown from "@/components/OrderCountdown"
import { apiCache } from "@/lib/api-cache"

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
  originalAmount: number | null
  discount: number | null
  membershipId: string | null
  status: string
  expiresAt: string | null
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
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // 会员码相关状态
  const [membershipCode, setMembershipCode] = useState("")
  const [membershipPreview, setMembershipPreview] = useState<any>(null)
  const [applyingMembership, setApplyingMembership] = useState(false)
  const [membershipError, setMembershipError] = useState<string | null>(null)

  // 支付方式配置
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<Record<string, boolean>>({
    alipay: true,
    wechat: true,
    paypal: true,
  })

  // 防止重复请求的标志
  const fetchingOrder = useRef(false)
  const loadingPaymentConfig = useRef(false)

  useEffect(() => {
    params.then((resolvedParams) => {
      setOrderId(resolvedParams.orderId)
    })
  }, [params])

  const loadPaymentConfig = useCallback(async () => {
    if (loadingPaymentConfig.current) return
    loadingPaymentConfig.current = true

    try {
      const res = await fetch("/api/system-config?keys=payment_alipay_enabled,payment_wechat_enabled,payment_paypal_enabled")
      if (res.ok) {
        const config = await res.json()
        setEnabledPaymentMethods({
          alipay: config.payment_alipay_enabled !== false,
          wechat: config.payment_wechat_enabled !== false,
          paypal: config.payment_paypal_enabled !== false,
        })
      }
    } catch (error) {
      console.error("加载支付配置失败:", error)
      // 如果加载失败，默认全部启用
    } finally {
      loadingPaymentConfig.current = false
    }
  }, [])

  const fetchOrder = useCallback(async () => {
    if (!orderId || fetchingOrder.current) return
    fetchingOrder.current = true

    try {
      setLoading(true)
      // 使用缓存的 fetch 防止重复请求
      const res = await apiCache.fetch(`/api/orders/${orderId}`)

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
      fetchingOrder.current = false
    }
  }, [orderId])

  useEffect(() => {
    if (orderId) {
      fetchOrder()
      loadPaymentConfig()
    }
  }, [orderId, fetchOrder, loadPaymentConfig])

  const handleOrderExpire = () => {
    // 订单过期后重新获取订单状态
    fetchOrder()
  }

  // 验证会员码（预览折扣）
  const verifyMembership = async () => {
    if (!membershipCode.trim()) {
      setMembershipError("请输入会员码")
      return
    }

    setApplyingMembership(true)
    setMembershipError(null)

    try {
      const res = await fetch("/api/memberships/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipCode: membershipCode.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        setMembershipError(data.error || "验证失败")
        setMembershipPreview(null)
        return
      }

      // 计算预览折扣
      if (order) {
        const totalItems = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
        const discountableCount = Math.min(totalItems, data.remainingToday)

        const originalAmount = order.orderItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        )

        let remaining = discountableCount
        let discountAmount = 0

        for (const item of order.orderItems) {
          if (remaining <= 0) break
          const itemCount = Math.min(item.quantity, remaining)
          discountAmount += item.price * itemCount * (1 - data.membership.discount)
          remaining -= itemCount
        }

        const finalAmount = originalAmount - discountAmount

        setMembershipPreview({
          membership: data.membership,
          originalAmount,
          finalAmount,
          saved: originalAmount - finalAmount,
          discountableCount,
          remainingToday: data.remainingToday
        })
      }
    } catch (err) {
      setMembershipError("验证失败，请重试")
      setMembershipPreview(null)
    } finally {
      setApplyingMembership(false)
    }
  }

  // 应用会员码
  const applyMembership = async () => {
    if (!order || !membershipCode.trim()) return

    setApplyingMembership(true)
    setMembershipError(null)

    try {
      const res = await fetch(`/api/orders/${order.id}/apply-membership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipCode: membershipCode.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        setMembershipError(data.error || "应用失败")
        return
      }

      // 更新订单信息
      setOrder(data.order)
      setMembershipCode("")
      setMembershipPreview(null)
      alert(`会员码应用成功！节省 ¥${data.appliedDiscount.saved.toFixed(2)}`)
    } catch (err) {
      setMembershipError("应用失败，请重试")
    } finally {
      setApplyingMembership(false)
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
        // 微信：跳转到微信支付页面
        if (data.payUrl) {
          window.location.href = data.payUrl
        } else {
          throw new Error("微信支付链接获取失败")
        }
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

  const handleCancelOrder = async () => {
    if (!order) return

    setCancelling(true)

    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST"
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "取消订单失败")
      }

      // 取消成功后跳转到商品列表
      router.push("/products")
    } catch (err) {
      alert(err instanceof Error ? err.message : "取消订单失败")
      setCancelling(false)
      setShowCancelDialog(false)
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

          {/* 订单倒计时 */}
          {order.expiresAt && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <OrderCountdown
                expiresAt={order.expiresAt}
                onExpire={handleOrderExpire}
                showIcon={true}
              />
              <p className="text-xs text-gray-600 mt-2">
                订单将在倒计时结束后自动取消，请尽快完成支付
              </p>
            </div>
          )}

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

          {/* 会员码输入（仅当订单未应用会员码时显示） */}
          {!order.membershipId && (
            <div className="border-t pt-4 mb-4">
              <h3 className="font-semibold mb-3">会员码优惠</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={membershipCode}
                    onChange={(e) => {
                      setMembershipCode(e.target.value.toUpperCase())
                      setMembershipError(null)
                      setMembershipPreview(null)
                    }}
                    placeholder="输入会员码"
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={applyingMembership}
                  />
                  <button
                    onClick={verifyMembership}
                    disabled={!membershipCode.trim() || applyingMembership}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {applyingMembership ? "验证中..." : "验证"}
                  </button>
                </div>

                {membershipError && (
                  <p className="text-sm text-red-600">{membershipError}</p>
                )}

                <Link
                  href="/membership?from=payment"
                  className="text-xs text-blue-600 hover:underline inline-block mt-1"
                >
                  还没有会员？立即购买
                </Link>

                {membershipPreview && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">会员折扣:</span>
                      <span className="font-medium text-green-700">
                        {(membershipPreview.membership.discount * 100).toFixed(0)}折
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">原价:</span>
                      <span className="line-through text-gray-500">
                        ¥{membershipPreview.originalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">优惠后:</span>
                      <span className="font-bold text-green-700">
                        ¥{membershipPreview.finalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">节省:</span>
                      <span className="font-bold text-red-600">
                        ¥{membershipPreview.saved.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 border-t pt-2">
                      可优惠 {membershipPreview.discountableCount} 件商品（今日剩余 {membershipPreview.remainingToday} 次）
                    </div>
                    <button
                      onClick={applyMembership}
                      disabled={applyingMembership}
                      className="w-full mt-2 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                    >
                      {applyingMembership ? "应用中..." : "应用会员码"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            {order.membershipId && order.originalAmount && (
              <div className="mb-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>原价:</span>
                  <span className="line-through">¥{order.originalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>会员折扣 ({(order.discount! * 100).toFixed(0)}折):</span>
                  <span>-¥{(order.originalAmount - order.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            )}
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
            {/* 检查是否有启用的支付方式 */}
            {!enabledPaymentMethods.alipay && !enabledPaymentMethods.wechat && !enabledPaymentMethods.paypal ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-2">当前没有可用的支付方式</p>
                <p className="text-sm text-gray-500">请联系管理员</p>
              </div>
            ) : (
              <>
                {/* 支付宝 */}
                {enabledPaymentMethods.alipay && (
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
                )}

                {/* 微信支付 */}
                {enabledPaymentMethods.wechat && (
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
                )}

                {/* PayPal */}
                {enabledPaymentMethods.paypal && (
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
                )}
              </>
            )}
          </div>

          {/* 支付按钮 */}
          <button
            onClick={handlePayment}
            disabled={!selectedMethod || processing || cancelling}
            className="w-full mt-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? "处理中..." : `确认支付 ¥${order.totalAmount.toFixed(2)}`}
          </button>

          {/* 取消订单按钮 */}
          <button
            onClick={() => setShowCancelDialog(true)}
            disabled={processing || cancelling}
            className="w-full mt-3 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            取消订单
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
          <li>• 如遇问题，请<button onClick={() => window.dispatchEvent(new Event('openChat'))} className="text-blue-600 hover:underline font-medium">联系客服</button>并提供订单号</li>
        </ul>
      </div>

      {/* 取消订单确认对话框 */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">确认取消订单</h3>
            <p className="text-gray-600 mb-6">
              确定要取消此订单吗？取消后将返回商品列表页面。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                继续支付
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {cancelling ? "取消中..." : "确认取消"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
