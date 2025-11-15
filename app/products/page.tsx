"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCart } from "@/hooks/useCart"

interface Product {
  id: string
  title: string
  description: string
  price: number
  coverImage: string | null
  showImage: boolean
  category: string | null
  tags: string | null
  createdAt: string
}

interface ProductsResponse {
  products: Product[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

interface Category {
  id: string
  name: string
}

export default function ProductsPage() {
  const router = useRouter()
  const { addToCart: addToCartHook } = useCart()
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showOther, setShowOther] = useState(false)
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const [page, setPage] = useState(1)
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [page, selectedCategories, showOther])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
      })

      // 多选分类
      if (selectedCategories.length > 0) {
        selectedCategories.forEach(cat => params.append("categories[]", cat))
      }

      // "其他"分类
      if (showOther) {
        params.append("showOther", "true")
        // 传递所有已知分类名称，用于排除
        if (categories.length > 0) {
          categories.forEach(cat => params.append("excludeCategories[]", cat.name))
        }
      }

      if (search) params.append("search", search)

      const res = await fetch(`/api/products?${params}`)
      if (!res.ok) throw new Error("获取商品列表失败")

      const data = await res.json()
      setData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取商品列表失败")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchProducts()
  }

  const addToCart = (product: Product) => {
    addToCartHook({
      id: product.id,
      title: product.title,
      price: product.price,
      coverImage: product.coverImage
    }, 1)
    alert("✓ 已成功添加到购物车！")
  }

  const buyNow = async (product: Product) => {
    try {
      setBuyingProductId(product.id)

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            productId: product.id,
            quantity: 1,
            price: product.price
          }]
        }),
      })

      if (!res.ok) {
        throw new Error("创建订单失败")
      }

      const data = await res.json()
      router.push(`/payment/${data.order.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建订单失败，请重试")
      setBuyingProductId(null)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories)
      }
    } catch (err) {
      console.error("获取分类失败:", err)
    }
  }

  const toggleCategory = (categoryName: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryName)) {
        return prev.filter(c => c !== categoryName)
      } else {
        return [...prev, categoryName]
      }
    })
    setPage(1)
  }

  const toggleOther = () => {
    setShowOther(prev => !prev)
    setPage(1)
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setShowOther(false)
    setPage(1)
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
        <div className="text-center text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">商品列表</h1>

      {/* 搜索和筛选 */}
      <div className="mb-8 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="搜索商品..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            搜索
          </button>
        </form>

        {/* 分类筛选 */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
              className="flex items-center gap-2 text-gray-700 font-medium hover:text-blue-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>分类筛选</span>
              {(selectedCategories.length > 0 || showOther) && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {selectedCategories.length + (showOther ? 1 : 0)}
                </span>
              )}
            </button>
            {(selectedCategories.length > 0 || showOther) && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-red-600"
              >
                清除筛选
              </button>
            )}
          </div>

          {showCategoryFilter && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-3 border-t">
              {categories.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.name)}
                    onChange={() => toggleCategory(cat.name)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{cat.name}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors bg-yellow-50 border-yellow-300">
                <input
                  type="checkbox"
                  checked={showOther}
                  onChange={toggleOther}
                  className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500"
                />
                <span className="text-sm text-gray-700">其他</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* 商品网格 */}
      {data?.products.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          暂无商品
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data?.products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <Link href={`/products/${product.id}`}>
                  <div className="relative h-48 bg-gray-200">
                    {product.showImage && product.coverImage ? (
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
                </Link>

                <div className="p-4">
                  <Link href={`/products/${product.id}`}>
                    <h3 className="text-lg font-semibold mb-2 hover:text-blue-600 line-clamp-2">
                      {product.title}
                    </h3>
                  </Link>

                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {product.description}
                  </p>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl font-bold text-blue-600">
                      ¥{product.price.toFixed(2)}
                    </span>
                    {product.category && (
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {product.category}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => addToCart(product)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      加入购物车
                    </button>
                    <button
                      onClick={() => buyNow(product)}
                      disabled={buyingProductId === product.id}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {buyingProductId === product.id ? "处理中..." : "立即购买"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {data && data.pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>

              <span className="px-4 py-2">
                第 {page} / {data.pagination.totalPages} 页
              </span>

              <button
                onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                disabled={page === data.pagination.totalPages}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
