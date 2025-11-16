"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCart } from "@/hooks/useCart"
import { useToast } from "@/components/Toast"

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
  const { showToast } = useToast()
  const categoryFilterRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showOther, setShowOther] = useState(false)
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(15) // 默认每页15件商品
  const [jumpToPage, setJumpToPage] = useState("")
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [page, limit, selectedCategories, showOther])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(event.target as Node)) {
        setShowCategoryFilter(false)
      }
    }

    if (showCategoryFilter) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showCategoryFilter])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
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
    showToast("✓ 已成功添加到购物车！", "success", 3000)
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

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // 切换每页数量时回到第一页
  }

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage)
    if (data && !isNaN(pageNum) && pageNum >= 1 && pageNum <= data.pagination.totalPages) {
      setPage(pageNum)
      setJumpToPage("")
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
        <div className="text-center text-red-600">{error}</div>
      </div>
    )
  }

  // 判断是否选择了"课程"分类
  const hasCourseCategory = selectedCategories.includes("课程")

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">商品列表</h1>
        {hasCourseCategory && (
          <button
            onClick={() => setShowExchangeModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            课程互换
          </button>
        )}
      </div>

      {/* 搜索和筛选 */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="搜索商品..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* 分类筛选下拉框 */}
          <div className="relative" ref={categoryFilterRef}>
            <button
              type="button"
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
              className="px-4 py-2 border rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 min-w-[140px]"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-gray-700">
                分类筛选
                {(selectedCategories.length > 0 || showOther) && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {selectedCategories.length + (showOther ? 1 : 0)}
                  </span>
                )}
              </span>
              <svg className={`w-4 h-4 text-gray-600 transition-transform ${showCategoryFilter ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 下拉菜单 */}
            {showCategoryFilter && (
              <div className="absolute right-0 mt-2 w-72 bg-white border rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
                <div className="p-3 border-b bg-gray-50 flex items-center justify-between sticky top-0">
                  <span className="text-sm font-semibold text-gray-700">选择分类</span>
                  {(selectedCategories.length > 0 || showOther) && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      清除全部
                    </button>
                  )}
                </div>
                <div className="p-2">
                  {categories.map((cat) => (
                    <label
                      key={cat.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-blue-50 cursor-pointer transition-colors ${
                        selectedCategories.includes(cat.name) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.name)}
                        onChange={() => toggleCategory(cat.name)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className={`text-sm flex-1 ${
                        selectedCategories.includes(cat.name) ? 'text-blue-700 font-medium' : 'text-gray-700'
                      }`}>
                        {cat.name}
                      </span>
                      {selectedCategories.includes(cat.name) && (
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </label>
                  ))}
                  <label className={`flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-yellow-50 cursor-pointer transition-colors ${
                    showOther ? 'bg-yellow-50' : ''
                  }`}>
                    <input
                      type="checkbox"
                      checked={showOther}
                      onChange={toggleOther}
                      className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500 focus:ring-2"
                    />
                    <span className={`text-sm flex-1 ${
                      showOther ? 'text-yellow-700 font-medium' : 'text-gray-700'
                    }`}>
                      其他
                    </span>
                    {showOther && (
                      <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </label>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            搜索
          </button>
        </form>
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

          {/* 分页控制 */}
          {data && data.pagination.totalPages > 0 && (
            <div className="mt-8 space-y-4">
              {/* 每页数量选择 */}
              <div className="flex justify-center items-center gap-3">
                <span className="text-sm text-gray-600">每页显示：</span>
                <div className="flex gap-2">
                  {[10, 15, 20, 30, 50].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleLimitChange(num)}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        limit === num
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  共 {data.pagination.total} 件商品
                </span>
              </div>

              {/* 分页导航 */}
              <div className="flex justify-center items-center gap-2 flex-wrap">
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

                {/* 跳转到指定页 */}
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm text-gray-600">跳转到</span>
                  <input
                    type="number"
                    min="1"
                    max={data.pagination.totalPages}
                    value={jumpToPage}
                    onChange={(e) => setJumpToPage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleJumpToPage()
                      }
                    }}
                    placeholder="页码"
                    className="w-20 px-2 py-1 border rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">页</span>
                  <button
                    onClick={handleJumpToPage}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    跳转
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 课程互换弹窗 */}
      {showExchangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">课程互换</h3>
              <button
                onClick={() => setShowExchangeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-blue-900 text-sm leading-relaxed">
                  💡 如果您购买的课程不满意或想要其他课程，我们提供课程互换或高价回收服务！
                </p>
              </div>

              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>支持同等价值课程互换</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>支持高价回收您不需要的课程</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>专业客服一对一服务</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-2 font-semibold">联系客服：</p>
              <div className="space-y-2 text-sm">
                <a href="mailto:support@example.com" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  support@example.com
                </a>
                <a href="tel:+8618888888888" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  188-8888-8888
                </a>
              </div>
            </div>

            <button
              onClick={() => setShowExchangeModal(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
