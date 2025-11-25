"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useCart } from "@/hooks/useCart"
import { useToast } from "@/components/Toast"

interface Product {
  id: string
  title: string
  description: string
  content: string | null
  price: number
  coverImage: string | null
  category: string | null
  tags: string | null
  createdAt: string
}

interface MembershipInfo {
  id: string
  code: string
  discount: number
  dailyLimit: number
  todayUsed: number
  remainingToday: number
  endDate: string | null
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { addToCart: addToCartHook } = useCart()
  const { showToast } = useToast()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [productId, setProductId] = useState<string | null>(null)
  const [membershipCode, setMembershipCode] = useState("")
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [showMembershipInput, setShowMembershipInput] = useState(false)

  useEffect(() => {
    // Resolve params promise in Next.js 16
    params.then((resolvedParams) => {
      setProductId(resolvedParams.id)
    })
  }, [params])

  useEffect(() => {
    if (productId) {
      fetchProduct()
    }
  }, [productId])

  const fetchProduct = async () => {
    if (!productId) return

    try {
      setLoading(true)
      const res = await fetch(`/api/products/${productId}`)

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("商品不存在")
        }
        throw new Error("获取商品详情失败")
      }

      const data = await res.json()
      setProduct(data.product)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取商品详情失败")
    } finally {
      setLoading(false)
    }
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

  // 计算折扣后的价格
  const calculateFinalPrice = () => {
    if (!product) return 0
    const originalPrice = product.price * quantity
    if (!membership) return originalPrice

    const discountableCount = Math.min(quantity, membership.remainingToday)
    const discountAmount = product.price * discountableCount * (1 - membership.discount)
    return originalPrice - discountAmount
  }

  const addToCart = () => {
    if (!product) return

    addToCartHook({
      id: product.id,
      title: product.title,
      price: product.price,
      coverImage: product.coverImage
    }, quantity)

    showToast("✓ 已成功添加到购物车！", "success")
    // 1秒后自动跳转到购物车
    setTimeout(() => {
      router.push("/cart")
    }, 1000)
  }

  const buyNow = async () => {
    if (!product) return

    try {
      const orderData: any = {
        items: [{
          productId: product.id,
          quantity: quantity
          // 安全改进：不再发送价格，价格由服务器从数据库查询决定
        }]
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
        showToast(error.error || "创建订单失败", "error")
        return
      }

      const data = await res.json()

      // 保存订单号到localStorage
      try {
        const ORDER_STORAGE_KEY = "my_orders"
        const stored = localStorage.getItem(ORDER_STORAGE_KEY)
        const orders = stored ? JSON.parse(stored) : []

        orders.unshift({
          orderNumber: data.order.orderNumber,
          createdAt: Date.now(),
          totalAmount: data.order.totalAmount
        })

        // 只保留最近50个订单
        if (orders.length > 50) {
          orders.splice(50)
        }

        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders))
      } catch (error) {
        console.error("保存订单记录失败:", error)
      }

      // 产品思维：直接跳转到支付页面，引导用户完成支付流程
      router.push(`/payment/${data.order.id}`)
    } catch (err) {
      showToast("创建订单失败，请稍后重试", "error")
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "商品不存在"}</p>
          <Link href="/products" className="text-blue-600 hover:underline">
            返回商品列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 面包屑导航 */}
      <div className="mb-6 text-sm text-gray-600">
        <Link href="/" className="hover:text-blue-600">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/products" className="hover:text-blue-600">商品列表</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{product.title}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* 商品图片 */}
        <div className="relative h-96 bg-gray-100 rounded-lg overflow-hidden">
          {product.coverImage ? (
            <Image
              src={product.coverImage}
              alt={product.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              暂无图片
            </div>
          )}
        </div>

        {/* 商品信息 */}
        <div>
          <h1 className="text-3xl font-bold mb-4">{product.title}</h1>

          {product.category && (
            <div className="mb-4">
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {product.category}
              </span>
            </div>
          )}

          <p className="text-gray-600 mb-6">{product.description}</p>

          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              {membership && (
                <span className="text-2xl text-gray-400 line-through">
                  ¥{(product.price * quantity).toFixed(2)}
                </span>
              )}
              <span className="text-4xl font-bold text-blue-600">
                ¥{calculateFinalPrice().toFixed(2)}
              </span>
            </div>
            {membership && (
              <p className="text-sm text-green-600 mt-1">
                已节省 ¥{((product.price * quantity) - calculateFinalPrice()).toFixed(2)}
              </p>
            )}
          </div>

          {/* 会员码区域 */}
          <div className="mb-6">
            {!membership ? (
              <div>
                <button
                  onClick={() => setShowMembershipInput(!showMembershipInput)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  使用会员码享受折扣
                </button>
                {showMembershipInput && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      会员码
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={membershipCode}
                        onChange={(e) => setMembershipCode(e.target.value.toUpperCase())}
                        placeholder="输入会员码"
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
                )}
              </div>
            ) : (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-800">
                        会员码已应用
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
                {quantity > membership.remainingToday && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ 今日优惠次数不足，仅前 {membership.remainingToday} 件商品享受折扣
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 数量选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              数量
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-1 border rounded-md hover:bg-gray-50"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-1 border rounded-md text-center"
                min="1"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-1 border rounded-md hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={addToCart}
              className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors font-medium"
            >
              加入购物车
            </button>
            <button
              onClick={buyNow}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              立即购买
            </button>
          </div>

          {/* 分享赚佣金卡片 */}
          <div className="mb-6 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-gray-900 text-sm">💰 分享赚佣金</h4>
                  <span className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">HOT</span>
                </div>
                <p className="text-xs text-gray-700 mb-2">
                  成为分销商，分享此商品赚取高达 <span className="font-bold text-orange-600">15% 佣金</span>
                </p>
                <Link
                  href="/distribution"
                  className="inline-block text-xs px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-md hover:from-orange-600 hover:to-red-600 transition-all font-medium"
                >
                  立即成为分销商 →
                </Link>
              </div>
            </div>
          </div>

          {/* 标签 */}
          {product.tags && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">标签</h3>
              <div className="flex flex-wrap gap-2">
                {product.tags.split(",").map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 商品详细内容 */}
      {product.content && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">商品详情</h2>
          <div className="prose max-w-none bg-white p-6 rounded-lg border">
            <div className="whitespace-pre-wrap">{product.content}</div>
          </div>
        </div>
      )}
    </div>
  )
}
