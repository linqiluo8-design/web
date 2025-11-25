"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { saveOrderToLocal } from "@/app/my-orders/page"

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    title: string
    networkDiskLink: string | null
  }
}

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  status: string
  orderItems: OrderItem[]
}

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState<string>("")
  const [order, setOrder] = useState<Order | null>(null)
  const [orderSaved, setOrderSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCopySuccess, setShowCopySuccess] = useState(false)

  useEffect(() => {
    const number = searchParams.get("orderNumber")
    const amount = searchParams.get("amount")
    if (number) {
      setOrderNumber(number)
      // 保存到"我的订单"
      saveOrderToLocal(number, parseFloat(amount || "0"))
      setOrderSaved(true)

      // 获取订单详情
      fetchOrderDetails(number)
    }
  }, [searchParams])

  const fetchOrderDetails = async (orderNumber: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/orders/lookup?orderNumber=${encodeURIComponent(orderNumber)}`)
      const data = await res.json()

      if (res.ok && data.order) {
        setOrder(data.order)
      }
    } catch (error) {
      console.error("获取订单详情失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewOrders = () => {
    // 确保订单已保存后再跳转
    const number = searchParams.get("orderNumber")
    const amount = searchParams.get("amount")
    if (number && !orderSaved) {
      saveOrderToLocal(number, parseFloat(amount || "0"))
    }
    router.push("/my-orders")
  }

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setShowCopySuccess(true)
      setTimeout(() => setShowCopySuccess(false), 2000)
    })
  }

  // 检查是否有虚拟商品
  const hasVirtualProducts = order?.orderItems.some(item => item.product.networkDiskLink) || false

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        {/* 成功提示卡片 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          {/* 成功图标 */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold mb-4 text-gray-800 text-center">支付成功！</h1>

          <p className="text-gray-600 mb-6 text-center">
            感谢您的购买，订单已成功支付
          </p>

          {orderNumber && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1 text-center">您的订单号</p>
              <p className="font-mono font-bold text-lg text-gray-900 text-center">{orderNumber}</p>
              <p className="text-xs text-gray-500 mt-2 text-center">请妥善保管订单号，可用于查询订单</p>
            </div>
          )}

          {/* 虚拟商品网盘信息 */}
          {!loading && hasVirtualProducts && order && (
            <div className="mb-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-green-900 mb-1">🎁 虚拟商品资源已解锁</h3>
                    <p className="text-sm text-green-700">支付成功！您已获得以下虚拟商品的访问权限</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {order.orderItems.map((item) => (
                    item.product.networkDiskLink && (
                      <div key={item.id} className="bg-white rounded-lg p-4 border-2 border-green-100 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-semibold text-gray-900">{item.product.title}</span>
                          </div>
                          <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                            虚拟商品
                          </span>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                              网盘资源链接
                            </label>
                            <button
                              onClick={() => handleCopyLink(item.product.networkDiskLink!)}
                              className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              复制
                            </button>
                          </div>
                          <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-all leading-relaxed">
{item.product.networkDiskLink}
                          </pre>
                        </div>

                        <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <p className="font-medium mb-1">重要提示：</p>
                            <ul className="space-y-1">
                              <li>• 请立即保存资源链接，建议截图或复制到安全位置</li>
                              <li>• 您随时可以在"我的订单"中查看此信息</li>
                              <li>• 请勿将资源链接分享给他人</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 复制成功提示 */}
          {showCopySuccess && (
            <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">已复制到剪贴板</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="space-y-3">
            {hasVirtualProducts && (
              <Link
                href={`/order-lookup?orderNumber=${orderNumber}`}
                className="block w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-center"
              >
                查看完整订单详情
              </Link>
            )}

            <button
              onClick={handleViewOrders}
              className={`block w-full py-3 ${hasVirtualProducts ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg font-medium transition-colors`}
            >
              查看我的订单
            </button>

            <Link
              href="/products"
              className="block w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
            >
              继续购物
            </Link>
          </div>
        </div>

        {/* 温馨提示 */}
        {hasVirtualProducts && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">温馨提示</h4>
                <p className="text-sm text-blue-800">
                  虚拟商品资源已永久绑定到您的订单。您可以随时通过订单号 <span className="font-mono font-bold">{orderNumber}</span> 在"订单查询"页面查看资源链接。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 分销推广引导卡片 */}
        <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-gray-900">💰 分享赚佣金</h3>
                <span className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-1 rounded-full font-bold">HOT</span>
              </div>
              <p className="text-sm text-gray-700 mb-4">
                喜欢我们的课程？成为分销商，分享课程链接给好友，每笔成交最高可获得 <span className="font-bold text-orange-600">15% 佣金</span>！
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/distribution"
                  className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all text-center shadow-md hover:shadow-lg"
                >
                  立即申请成为分销商 →
                </Link>
                <Link
                  href="/distribution"
                  className="sm:w-auto py-2.5 px-6 border-2 border-orange-300 text-orange-700 rounded-lg font-medium hover:bg-orange-50 transition-colors text-center"
                >
                  了解详情
                </Link>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>零成本</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>秒到账</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>随时提现</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
