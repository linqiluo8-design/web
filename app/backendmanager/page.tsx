"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import ImageUpload from "@/components/ImageUpload"

interface Product {
  id: string
  title: string
  description: string
  content: string | null
  price: number
  coverImage: string | null
  showImage: boolean
  category: string | null
  categoryId: string | null
  networkDiskLink: string | null
  status: string
  createdAt: string
}

interface Category {
  id: string
  name: string
}

type CreateMode = "single" | "batch" | null

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Product>>({})
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [createForm, setCreateForm] = useState<Partial<Product>>({
    title: "",
    description: "",
    content: "",
    price: 0,
    categoryId: "",
    coverImage: "",
    showImage: true,
    status: "active"
  })
  const [batchProducts, setBatchProducts] = useState<Partial<Product>[]>([
    {
      title: "",
      description: "",
      content: "",
      price: 0,
      categoryId: "",
      coverImage: "",
      showImage: true,
      status: "active"
    }
  ])
  const [permissions, setPermissions] = useState<Record<string, string>>({})

  // 分页和搜索状态
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [jumpToPage, setJumpToPage] = useState("")

  // 获取用户权限
  useEffect(() => {
    if (session?.user) {
      fetch('/api/auth/permissions')
        .then(res => res.json())
        .then(data => setPermissions(data.permissions || {}))
        .catch(err => console.error('获取权限失败:', err))
    }
  }, [session])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    // 管理员始终可以访问
    if (session?.user?.role === "ADMIN") {
      fetchProducts()
      fetchCategories()
      return
    }

    // 普通用户需要检查是否有任何权限
    if (session?.user && Object.keys(permissions).length > 0) {
      const hasAnyPermission = Object.values(permissions).some(
        level => level === 'READ' || level === 'WRITE'
      )

      if (hasAnyPermission) {
        fetchProducts()
        fetchCategories()
      } else {
        // 没有任何权限，重定向回首页
        router.push("/")
      }
    }
  }, [status, session, router, page, limit, searchQuery, permissions])

  // 检查是否有读或写权限
  const hasPermission = (module: string) => {
    // ADMIN拥有所有权限
    if (session?.user?.role === 'ADMIN') {
      return true
    }
    const level = permissions[module]
    return level === 'READ' || level === 'WRITE'
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim())
      }

      const response = await fetch(`/api/backendmanager/products?${params}`)

      if (!response.ok) {
        throw new Error("获取商品列表失败")
      }

      const data = await response.json()
      setProducts(data.products)
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalCount(data.pagination?.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }

  // 处理搜索
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1) // 搜索时重置到第一页
  }

  // 处理页码跳转
  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage)
    if (pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum)
      setJumpToPage("")
    } else {
      alert(`请输入1到${totalPages}之间的页码`)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories")
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories)
      }
    } catch (err) {
      console.error("获取分类失败:", err)
    }
  }

  const toggleProductStatus = async (productId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active"

      const response = await fetch(`/api/backendmanager/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "更新商品状态失败")
      }

      // 重新获取商品列表
      await fetchProducts()
      alert("✓ 商品状态已更新")
    } catch (err) {
      console.error("更新失败:", err)
      alert(err instanceof Error ? err.message : "更新失败")
    }
  }

  const startEdit = (product: Product) => {
    setEditingId(product.id)
    setEditForm({
      title: product.title,
      description: product.description,
      content: product.content || "",
      price: product.price,
      categoryId: product.categoryId || "",
      coverImage: product.coverImage || "",
      showImage: product.showImage,
      networkDiskLink: product.networkDiskLink || "",
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (productId: string) => {
    try {
      const response = await fetch(`/api/backendmanager/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "更新商品失败")
      }

      await fetchProducts()
      setEditingId(null)
      setEditForm({})
      alert("✓ 商品信息已更新")
    } catch (err) {
      console.error("保存失败:", err)
      alert(err instanceof Error ? err.message : "保存失败")
    }
  }

  const startCreate = (mode: CreateMode) => {
    setCreateMode(mode)
    if (mode === "single") {
      setCreateForm({
        title: "",
        description: "",
        content: "",
        price: 0,
        categoryId: "",
        coverImage: "",
        showImage: true,
        status: "active"
      })
    }
  }

  const cancelCreate = () => {
    setCreateMode(null)
    setCreateForm({
      title: "",
      description: "",
      content: "",
      price: 0,
      categoryId: "",
      coverImage: "",
      showImage: true,
      status: "active"
    })
    setBatchProducts([
      {
        title: "",
        description: "",
        content: "",
        price: 0,
        categoryId: "",
        coverImage: "",
        showImage: true,
        status: "active"
      }
    ])
  }

  const handleCreateSingle = async () => {
    try {
      // 前端验证
      if (!createForm.title?.trim()) {
        alert("请输入商品标题")
        return
      }
      if (!createForm.description?.trim()) {
        alert("请输入商品描述")
        return
      }
      if (createForm.price === undefined || createForm.price < 0) {
        alert("请输入有效的价格（不能为负数）")
        return
      }

      const response = await fetch("/api/backendmanager/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "创建商品失败")
      }

      await fetchProducts()
      cancelCreate()
      alert("✓ 商品创建成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败")
    }
  }

  const handleCreateBatch = async () => {
    try {
      // 过滤并验证商品
      const validProducts = batchProducts.filter(p => {
        // 检查必填字段
        return p.title?.trim() && p.description?.trim() && p.price !== undefined && p.price >= 0
      })

      if (validProducts.length === 0) {
        alert("请至少填写一个完整的商品信息（标题、描述、价格）")
        return
      }

      // 检查是否有无效的价格
      const hasInvalidPrice = validProducts.some(p => p.price === undefined || p.price < 0)
      if (hasInvalidPrice) {
        alert("请确保所有商品的价格都是有效的（不能为负数）")
        return
      }

      const response = await fetch("/api/backendmanager/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: validProducts })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "批量创建商品失败")
      }

      const data = await response.json()
      await fetchProducts()
      cancelCreate()
      alert(`✓ ${data.message}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量创建失败")
    }
  }

  const addBatchProduct = () => {
    setBatchProducts([
      ...batchProducts,
      {
        title: "",
        description: "",
        content: "",
        price: 0,
        categoryId: "",
        coverImage: "",
        showImage: true,
        status: "active"
      }
    ])
  }

  const removeBatchProduct = (index: number) => {
    if (batchProducts.length > 1) {
      setBatchProducts(batchProducts.filter((_, i) => i !== index))
    }
  }

  const updateBatchProduct = (index: number, field: keyof Product, value: any) => {
    const updated = [...batchProducts]
    updated[index] = { ...updated[index], [field]: value }
    setBatchProducts(updated)
  }

  if (status === "loading" || loading) {
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
      {/* 后台管理导航 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">后台管理</h1>
        <div className="flex flex-wrap gap-3">
          {hasPermission('CATEGORIES') && (
            <Link
              href="/backendmanager/categories"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              分类管理
            </Link>
          )}
          {hasPermission('MEMBERSHIPS') && (
            <Link
              href="/backendmanager/memberships"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              会员方案管理
            </Link>
          )}
          {hasPermission('MEMBERSHIPS') && (
            <Link
              href="/backendmanager/membership-records"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              会员购买记录
            </Link>
          )}
          {hasPermission('ORDERS') && (
            <Link
              href="/backendmanager/orders"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              订单数据管理
            </Link>
          )}
          {hasPermission('PRODUCTS') && (
            <Link
              href="/backendmanager/analytics"
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-medium"
            >
              📊 浏览量统计
            </Link>
          )}
          {hasPermission('BANNERS') && (
            <Link
              href="/backendmanager/banners"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              轮播图管理
            </Link>
          )}
          {hasPermission('USER_MANAGEMENT') && (
            <Link
              href="/backendmanager/users"
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 font-medium"
            >
              👥 用户管理
            </Link>
          )}
          {hasPermission('ORDER_LOOKUP') && (
            <Link
              href="/order-lookup"
              className="px-4 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 font-medium"
            >
              🔍 订单查询
            </Link>
          )}
          {hasPermission('SYSTEM_SETTINGS') && (
            <Link
              href="/backendmanager/settings"
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 font-medium"
            >
              ⚙️ 系统设置
            </Link>
          )}
          {hasPermission('SECURITY_ALERTS') && (
            <Link
              href="/backendmanager/security-alerts"
              className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 font-medium"
            >
              🔒 安全警报
            </Link>
          )}
          {hasPermission('CUSTOMER_CHAT') && (
            <Link
              href="/backendmanager/chat"
              className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 font-medium"
            >
              💬 客服聊天
            </Link>
          )}
        </div>
      </div>

      {/* 商品管理区域 */}
      <div className="border-t pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">商品管理</h2>
          <div className="flex gap-2">
            <button
              onClick={() => startCreate("single")}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + 新建商品
            </button>
            <button
              onClick={() => startCreate("batch")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              + 批量添加
            </button>
          </div>
        </div>
      </div>

      {/* 单个商品创建表单 */}
      {createMode === "single" && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">创建新商品</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                商品标题 *
              </label>
              <input
                type="text"
                value={createForm.title || ""}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如：Python入门课程"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                价格 *
              </label>
              <input
                type="number"
                step="0.01"
                value={createForm.price || 0}
                onChange={(e) => setCreateForm({ ...createForm, price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                简短描述 *
              </label>
              <input
                type="text"
                value={createForm.description || ""}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="一句话介绍"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                详细内容
              </label>
              <textarea
                value={createForm.content || ""}
                onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="支持Markdown格式"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                分类
              </label>
              <select
                value={createForm.categoryId || ""}
                onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">无分类</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <ImageUpload
                value={createForm.coverImage || ""}
                onChange={(url) => setCreateForm({ ...createForm, coverImage: url })}
                label="封面图片"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                图片显示设置
              </label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="createShowImage"
                  checked={createForm.showImage ?? true}
                  onChange={(e) => setCreateForm({ ...createForm, showImage: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="createShowImage" className="text-sm text-gray-700">
                  在商品列表中显示图片
                </label>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                网盘链接 (虚拟商品资源)
              </label>
              <textarea
                value={createForm.networkDiskLink || ""}
                onChange={(e) => setCreateForm({ ...createForm, networkDiskLink: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={3}
                placeholder="例如：百度网盘: https://pan.baidu.com/xxx 提取码: abcd&#10;或留空表示实体商品"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 虚拟商品（视频、电子书等）：填写网盘链接和提取密码，用户付款后可见<br/>
                📦 实体商品或线下服务：留空即可
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreateSingle}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              创建
            </button>
            <button
              onClick={cancelCreate}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 搜索和筛选栏 */}
      {!createMode && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                搜索商品
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(searchQuery)
                    }
                  }}
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入商品标题或描述关键词..."
                />
                <button
                  onClick={() => handleSearch(searchQuery)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  搜索
                </button>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setPage(1)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                每页显示数量
              </label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value))
                  setPage(1)
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="5">5 条</option>
                <option value="10">10 条</option>
                <option value="20">20 条</option>
                <option value="50">50 条</option>
                <option value="100">100 条</option>
              </select>
            </div>
          </div>
          {searchQuery && (
            <div className="mt-3 text-sm text-gray-600">
              搜索结果：共找到 <span className="font-bold text-blue-600">{totalCount}</span> 个商品
            </div>
          )}
        </div>
      )}

      {/* 批量商品创建表单 */}
      {createMode === "batch" && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">批量添加商品</h3>
          <div className="space-y-6">
            {batchProducts.map((product, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium">商品 #{index + 1}</h4>
                  {batchProducts.length > 1 && (
                    <button
                      onClick={() => removeBatchProduct(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      删除
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      商品标题 *
                    </label>
                    <input
                      type="text"
                      value={product.title || ""}
                      onChange={(e) => updateBatchProduct(index, "title", e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded-md"
                      placeholder="例如：Python入门课程"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      价格 *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={product.price || 0}
                      onChange={(e) => updateBatchProduct(index, "price", parseFloat(e.target.value))}
                      className="w-full px-2 py-1 text-sm border rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      简短描述 *
                    </label>
                    <input
                      type="text"
                      value={product.description || ""}
                      onChange={(e) => updateBatchProduct(index, "description", e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded-md"
                      placeholder="一句话介绍"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      分类
                    </label>
                    <select
                      value={product.categoryId || ""}
                      onChange={(e) => updateBatchProduct(index, "categoryId", e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded-md"
                    >
                      <option value="">无分类</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <ImageUpload
                      value={product.coverImage || ""}
                      onChange={(url) => updateBatchProduct(index, "coverImage", url)}
                      label="封面图片"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      网盘链接 (可选)
                    </label>
                    <textarea
                      value={product.networkDiskLink || ""}
                      onChange={(e) => updateBatchProduct(index, "networkDiskLink", e.target.value)}
                      className="w-full px-2 py-1 text-xs border rounded-md font-mono"
                      rows={2}
                      placeholder="网盘链接 + 提取码"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addBatchProduct}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              + 添加一行
            </button>
            <button
              onClick={handleCreateBatch}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              批量创建
            </button>
            <button
              onClick={cancelCreate}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          暂无商品
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  商品信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  分类
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  价格
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  网盘链接
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                editingId === product.id ? (
                  <tr key={product.id} className="bg-blue-50">
                    <td className="px-6 py-4" colSpan={6}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            标题 *
                          </label>
                          <input
                            type="text"
                            value={editForm.title || ""}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            价格 *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.price || 0}
                            onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            简短描述
                          </label>
                          <input
                            type="text"
                            value={editForm.description || ""}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="一句话介绍"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            详细内容
                          </label>
                          <textarea
                            value={editForm.content || ""}
                            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            rows={4}
                            placeholder="支持Markdown格式"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            分类
                          </label>
                          <select
                            value={editForm.categoryId || ""}
                            onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                          >
                            <option value="">无分类</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <ImageUpload
                            value={editForm.coverImage || ""}
                            onChange={(url) => setEditForm({ ...editForm, coverImage: url })}
                            label="封面图片"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            图片显示设置
                          </label>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              id="showImage"
                              checked={editForm.showImage ?? true}
                              onChange={(e) => setEditForm({ ...editForm, showImage: e.target.checked })}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="showImage" className="text-sm text-gray-700">
                              在商品列表中显示图片
                            </label>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            关闭后，商品列表将显示"暂无图片"占位符
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            网盘链接 (虚拟商品资源)
                          </label>
                          <textarea
                            value={editForm.networkDiskLink || ""}
                            onChange={(e) => setEditForm({ ...editForm, networkDiskLink: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                            rows={3}
                            placeholder="例如：百度网盘: https://pan.baidu.com/xxx 提取码: abcd&#10;或留空表示实体商品"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            💡 虚拟商品（视频、电子书等）：填写网盘链接和提取密码，用户付款后可见<br/>
                            📦 实体商品或线下服务：留空即可
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => saveEdit(product.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          取消
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {product.coverImage && (
                          <div className="flex-shrink-0 h-10 w-10 relative mr-4">
                            <Image
                              src={product.coverImage}
                              alt={product.title}
                              fill
                              className="rounded object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {product.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {product.description.substring(0, 50)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {product.category || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        ¥{product.price.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {product.networkDiskLink ? (
                        <div className="text-xs text-green-600 font-mono max-w-xs break-words whitespace-pre-wrap">
                          {product.networkDiskLink.length > 50
                            ? product.networkDiskLink.substring(0, 50) + "..."
                            : product.networkDiskLink}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          product.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {product.status === "active" ? "已上架" : "已下架"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => toggleProductStatus(product.id, product.status)}
                        className={`${
                          product.status === "active"
                            ? "text-red-600 hover:text-red-900"
                            : "text-green-600 hover:text-green-900"
                        }`}
                      >
                        {product.status === "active" ? "下架" : "上架"}
                      </button>
                      <button
                        onClick={() => startEdit(product)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页控件 */}
      {!createMode && products.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">
            共 <span className="font-bold text-blue-600">{totalCount}</span> 个商品，
            第 <span className="font-bold">{page}</span> / <span className="font-bold">{totalPages}</span> 页
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-3 py-1.5 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
            >
              首页
            </button>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
            >
              上一页
            </button>

            {/* 页码显示 */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1.5 border rounded-md text-sm ${
                      page === pageNum
                        ? "bg-blue-600 text-white border-blue-600"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
            >
              下一页
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-3 py-1.5 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
            >
              末页
            </button>
          </div>

          {/* 跳转到指定页 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">跳转到</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={jumpToPage}
              onChange={(e) => setJumpToPage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleJumpToPage()
                }
              }}
              className="w-16 px-2 py-1.5 border rounded-md text-sm text-center"
              placeholder={page.toString()}
            />
            <span className="text-sm text-gray-600">页</span>
            <button
              onClick={handleJumpToPage}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              跳转
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
