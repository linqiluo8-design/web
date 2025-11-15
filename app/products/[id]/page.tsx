"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useCart } from "@/hooks/useCart"

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

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { addToCart: addToCartHook } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    fetchProduct()
  }, [params.id])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/products/${params.id}`)

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

  const addToCart = () => {
    if (!product) return

    addToCartHook({
      id: product.id,
      title: product.title,
      price: product.price,
      coverImage: product.coverImage
    }, quantity)

    if (confirm("✓ 已成功添加到购物车！\n\n是否前往购物车查看？")) {
      router.push("/cart")
    }
  }

  const buyNow = async () => {
    if (!product) return

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            productId: product.id,
            quantity: quantity,
            price: product.price
          }]
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || "创建订单失败")
        return
      }

      const data = await res.json()

      // 显示订单号并跳转到订单查询页
      alert(`订单创建成功！\n\n您的订单号是: ${data.orderNumber}\n\n请妥善保管此订单号，可用于查询订单状态。`)
      router.push("/order-lookup")
    } catch (err) {
      alert("创建订单失败，请稍后重试")
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
            <span className="text-4xl font-bold text-blue-600">
              ¥{product.price.toFixed(2)}
            </span>
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
          <div className="flex gap-4 mb-8">
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
