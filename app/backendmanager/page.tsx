"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (session?.user?.role !== "ADMIN") {
      router.push("/")
      return
    }

    fetchProducts()
    fetchCategories()
  }, [status, session, router])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/backendmanager/products")

      if (!response.ok) {
        throw new Error("获取商品列表失败")
      }

      const data = await response.json()
      setProducts(data.products)
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
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
      // 过滤掉空的商品
      const validProducts = batchProducts.filter(p => p.title && p.description && p.price)

      if (validProducts.length === 0) {
        alert("请至少填写一个完整的商品信息")
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">后台管理 - 商品管理</h1>
          <div className="flex gap-4">
            <Link
              href="/backendmanager/categories"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              分类管理
            </Link>
            <Link
              href="/backendmanager/memberships"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              会员管理
            </Link>
            <Link
              href="/backendmanager/orders"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              订单数据管理
            </Link>
          </div>
        </div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                封面图片 URL
              </label>
              <input
                type="text"
                value={createForm.coverImage || ""}
                onChange={(e) => setCreateForm({ ...createForm, coverImage: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/image.jpg"
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
            {createForm.coverImage && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  封面预览
                </label>
                <div className="relative w-32 h-32">
                  <Image
                    src={createForm.coverImage}
                    alt="预览"
                    fill
                    className="object-cover rounded"
                  />
                </div>
              </div>
            )}
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
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      封面图片 URL
                    </label>
                    <input
                      type="text"
                      value={product.coverImage || ""}
                      onChange={(e) => updateBatchProduct(index, "coverImage", e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded-md"
                      placeholder="https://example.com/image.jpg"
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
                    <td className="px-6 py-4" colSpan={5}>
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
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            封面图片 URL
                          </label>
                          <input
                            type="text"
                            value={editForm.coverImage || ""}
                            onChange={(e) => setEditForm({ ...editForm, coverImage: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="https://example.com/image.jpg"
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
                        {editForm.coverImage && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              封面预览
                            </label>
                            <div className="relative w-32 h-32">
                              <Image
                                src={editForm.coverImage}
                                alt="预览"
                                fill
                                className="object-cover rounded"
                              />
                            </div>
                          </div>
                        )}
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
    </div>
  )
}
