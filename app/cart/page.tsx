"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useCart } from "@/hooks/useCart"
import { useState } from "react"

interface MembershipInfo {
  id: string
  code: string
  discount: number
  dailyLimit: number
  todayUsed: number
  remainingToday: number
  endDate: string | null
  planSnapshot: {
    name: string
    price: number
    duration: number
    discount: number
    dailyLimit: number
  }
}

export default function CartPage() {
  const router = useRouter()
  const { cart, updateQuantity, removeFromCart, clearCart, total, isLoaded } = useCart()
  const [membershipCode, setMembershipCode] = useState("")
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [membershipError, setMembershipError] = useState<string | null>(null)

  const handleRemoveItem = (productId: string) => {
    if (!confirm("确定要删除这个商品吗？")) return
    removeFromCart(productId)
  }

  const verifyMembership = async () => {
    if (!membershipCode.trim()) {
      setMembershipError("请输入会员码")
      return
    }

    setVerifying(true)
    setMembershipError(null)

    try {
      const res = await fetch("/api/memberships/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipCode: membershipCode.trim() })
      })

      const data = await res.json()

      if (!data.valid) {
        setMembershipError(data.error || "会员码无效")
        setMembership(null)
        return
      }

      setMembership(data.membership)
      setMembershipError(null)
    } catch (err) {
      setMembershipError("验证失败，请重试")
      setMembership(null)
    } finally {
      setVerifying(false)
    }
  }

  const removeMembership = () => {
    setMembership(null)
    setMembershipCode("")
    setMembershipError(null)
  }

  // 计算可以享受折扣的商品数量
  const discountableCount = membership
    ? Math.min(cart.reduce((sum, item) => sum + item.quantity, 0), membership.remainingToday)
    : 0

  // 计算折扣金额
  const calculateDiscount = () => {
    if (!membership || discountableCount === 0) return 0

    let remaining = discountableCount
    let discount = 0

    for (const item of cart) {
      if (remaining <= 0) break

      const itemCount = Math.min(item.quantity, remaining)
      discount += item.price * itemCount * (1 - membership.discount)
      remaining -= itemCount
    }

    return discount
  }

  const discountAmount = calculateDiscount()
  const finalTotal = total - discountAmount

  const checkout = async () => {
    if (cart.length === 0) {
      alert("购物车是空的")
      return
    }

    try {
      const orderData: any = {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        }))
      }

      // 如果使用了会员码，添加会员信息
      if (membership) {
        orderData.membershipCode = membership.code
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "创建订单失败")
      }

      const data = await res.json()

      // Clear cart after successful order creation
      clearCart()

      // 跳转到支付页面（产品思维：不要立即弹出订单号，而是引导用户完成支付）
      router.push(`/payment/${data.order.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建订单失败")
    }
  }

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">购物车</h1>

      {cart.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">购物车是空的</p>
          <Link
            href="/products"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            去购物
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* 购物车列表 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex gap-4 p-4 border-b last:border-b-0"
                >
                  {/* 商品图片 */}
                  <Link
                    href={`/products/${item.productId}`}
                    className="relative w-24 h-24 bg-gray-100 rounded flex-shrink-0"
                  >
                    {item.coverImage ? (
                      <Image
                        src={item.coverImage}
                        alt={item.title}
                        fill
                        className="object-cover rounded"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                        暂无图片
                      </div>
                    )}
                  </Link>

                  {/* 商品信息 */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.productId}`}
                      className="font-semibold hover:text-blue-600 block mb-1"
                    >
                      {item.title}
                    </Link>

                    <div className="mt-2 text-lg font-bold text-blue-600">
                      ¥{item.price.toFixed(2)}
                    </div>
                  </div>

                  {/* 数量控制 */}
                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => handleRemoveItem(item.productId)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                        className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-12 text-center">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-sm text-gray-600">
                      小计: ¥{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 结算信息 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">订单摘要</h2>

              {/* 会员码输入 */}
              {!membership ? (
                <div className="mb-4 pb-4 border-b">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    会员码（可选）
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={membershipCode}
                      onChange={(e) => setMembershipCode(e.target.value.toUpperCase())}
                      placeholder="输入会员码享受折扣"
                      className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      maxLength={16}
                    />
                    <button
                      onClick={verifyMembership}
                      disabled={verifying}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 text-sm font-medium"
                    >
                      {verifying ? "验证中..." : "使用"}
                    </button>
                  </div>
                  {membershipError && (
                    <p className="text-red-600 text-xs mt-1">{membershipError}</p>
                  )}
                  <Link
                    href="/membership"
                    className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                  >
                    还没有会员？立即购买
                  </Link>
                </div>
              ) : (
                <div className="mb-4 pb-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-800">
                          {membership.planSnapshot.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {(membership.discount * 10).toFixed(1)}折优惠 · 今日剩余 {membership.remainingToday}/{membership.dailyLimit} 次
                      </p>
                    </div>
                    <button
                      onClick={removeMembership}
                      className="text-gray-400 hover:text-red-600"
                      title="移除会员码"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {discountableCount < cart.reduce((sum, item) => sum + item.quantity, 0) && (
                    <p className="text-xs text-orange-600">
                      ⚠️ 今日优惠次数不足，仅前 {discountableCount} 件商品享受折扣
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">商品数量</span>
                  <span>{cart.length} 件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">总计数量</span>
                  <span>
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} 个
                  </span>
                </div>
                {membership && discountableCount > 0 && (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>原价</span>
                      <span>¥{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>会员优惠</span>
                      <span>-¥{discountAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">
                    {membership && discountableCount > 0 ? "折后金额" : "总金额"}
                  </span>
                  <div className="text-right">
                    {membership && discountableCount > 0 && (
                      <div className="text-sm text-gray-400 line-through">
                        ¥{total.toFixed(2)}
                      </div>
                    )}
                    <span className="text-2xl font-bold text-blue-600">
                      ¥{finalTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                {membership && discountableCount > 0 && (
                  <p className="text-xs text-green-600 text-right mt-1">
                    已节省 ¥{discountAmount.toFixed(2)}
                  </p>
                )}
              </div>

              <button
                onClick={checkout}
                className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
              >
                去结算
              </button>

              <Link
                href="/products"
                className="block text-center mt-4 text-blue-600 hover:underline"
              >
                继续购物
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
