"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import ImageUpload from "@/components/ImageUpload"

interface Category {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  sortOrder: number
  _count: {
    products: number
  }
}

type CreateMode = "single" | "batch" | null

export default function CategoriesAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    coverImage: "",
    sortOrder: 0
  })
  const [batchCategories, setBatchCategories] = useState([
    { name: "", description: "", coverImage: "", sortOrder: 0 }
  ])
  const [userPermission, setUserPermission] = useState<"NONE" | "READ" | "WRITE">("NONE")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (status === "authenticated" && session?.user) {
      checkPermissionAndFetch()
    }
  }, [status, session, router])

  const checkPermissionAndFetch = async () => {
    try {
      // 管理员拥有所有权限
      if (session?.user?.role === "ADMIN") {
        setUserPermission("WRITE")
        fetchCategories()
        return
      }

      // 获取用户权限
      const res = await fetch("/api/auth/permissions")
      const data = await res.json()
      const permission = data.permissions?.CATEGORIES || "NONE"

      setUserPermission(permission)

      if (permission === "NONE") {
        // 没有权限，跳转到首页
        router.push("/")
        return
      }

      // 有 READ 或 WRITE 权限，加载数据
      fetchCategories()
    } catch (error) {
      console.error("检查权限失败:", error)
      router.push("/")
    }
  }

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/categories")

      if (!response.ok) {
        throw new Error("获取分类列表失败")
      }

      const data = await response.json()
      setCategories(data.categories)
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }

  const startCreate = (mode: "single" | "batch") => {
    setCreateMode(mode)
    setFormData({ name: "", description: "", coverImage: "", sortOrder: 0 })
    setBatchCategories([{ name: "", description: "", coverImage: "", sortOrder: 0 }])
  }

  const startEdit = (category: Category) => {
    setEditingId(category.id)
    setFormData({
      name: category.name,
      description: category.description || "",
      coverImage: category.coverImage || "",
      sortOrder: category.sortOrder
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setCreateMode(null)
    setFormData({ name: "", description: "", coverImage: "", sortOrder: 0 })
    setBatchCategories([{ name: "", description: "", coverImage: "", sortOrder: 0 }])
  }

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "创建分类失败")
      }

      await fetchCategories()
      cancelEdit()
      alert("✓ 分类创建成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败")
    }
  }

  const handleUpdate = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "更新分类失败")
      }

      await fetchCategories()
      cancelEdit()
      alert("✓ 分类更新成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新失败")
    }
  }

  const handleDelete = async (categoryId: string, categoryName: string) => {
    if (!confirm(`确定要删除分类"${categoryName}"吗？\n\n注意：该分类下的商品不会被删除，但会失去分类关联。`)) {
      return
    }

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "删除分类失败")
      }

      await fetchCategories()
      alert("✓ 分类删除成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败")
    }
  }

  // 批量添加分类相关函数
  const addBatchCategory = () => {
    setBatchCategories([...batchCategories, { name: "", description: "", coverImage: "", sortOrder: 0 }])
  }

  const removeBatchCategory = (index: number) => {
    if (batchCategories.length === 1) {
      alert("至少保留一个分类")
      return
    }
    setBatchCategories(batchCategories.filter((_, i) => i !== index))
  }

  const updateBatchCategory = (index: number, field: string, value: any) => {
    const updated = [...batchCategories]
    updated[index] = { ...updated[index], [field]: value }
    setBatchCategories(updated)
  }

  const handleBatchCreate = async () => {
    // 验证所有分类名称不为空
    const emptyNames = batchCategories.filter(cat => !cat.name.trim())
    if (emptyNames.length > 0) {
      alert("请填写所有分类的名称")
      return
    }

    if (!confirm(`确定要批量创建 ${batchCategories.length} 个分类吗？`)) {
      return
    }

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: batchCategories })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "批量创建分类失败")
      }

      const data = await response.json()
      await fetchCategories()
      cancelEdit()
      alert(`✓ 成功创建 ${data.count} 个分类`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量创建失败")
    }
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
          <h1 className="text-3xl font-bold mb-2">
            分类管理
            {userPermission === "READ" && (
              <span className="ml-3 text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">
                只读模式
              </span>
            )}
          </h1>
          <div className="flex gap-4 text-sm">
            <Link href="/backendmanager" className="text-gray-600 hover:text-blue-600">
              ← 返回商品管理
            </Link>
          </div>
        </div>
        {userPermission === "WRITE" && (
          <div className="flex gap-2">
            <button
              onClick={() => startCreate("single")}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + 新建分类
            </button>
            <button
              onClick={() => startCreate("batch")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              + 批量添加
            </button>
          </div>
        )}
      </div>

      {/* 单个创建表单 */}
      {createMode === "single" && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">创建新分类</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                分类名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如：课程"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                排序顺序
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="分类描述（可选）"
              />
            </div>
            <div className="md:col-span-2">
              <ImageUpload
                label="封面图片 (支持URL输入或图片上传/粘贴)"
                value={formData.coverImage}
                onChange={(url) => setFormData({ ...formData, coverImage: url })}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              创建
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 批量创建表单 */}
      {createMode === "batch" && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">批量添加分类</h3>
            <button
              onClick={addBatchCategory}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
            >
              + 添加一行
            </button>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {batchCategories.map((category, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-medium text-gray-700">分类 #{index + 1}</h4>
                  {batchCategories.length > 1 && (
                    <button
                      onClick={() => removeBatchCategory(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      删除
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      分类名称 *
                    </label>
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) => updateBatchCategory(index, "name", e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如：课程"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      排序顺序
                    </label>
                    <input
                      type="number"
                      value={category.sortOrder}
                      onChange={(e) => updateBatchCategory(index, "sortOrder", parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      描述
                    </label>
                    <textarea
                      value={category.description}
                      onChange={(e) => updateBatchCategory(index, "description", e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="分类描述（可选）"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <ImageUpload
                      label="封面图片 (支持URL输入或图片上传/粘贴)"
                      value={category.coverImage}
                      onChange={(url) => updateBatchCategory(index, "coverImage", url)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleBatchCreate}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              批量创建 ({batchCategories.length} 个)
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 分类列表 */}
      {categories.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow">
          暂无分类，点击上方按钮创建
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  分类信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  描述
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  排序
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  商品数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((category) => (
                editingId === category.id ? (
                  <tr key={category.id} className="bg-blue-50">
                    <td className="px-6 py-4" colSpan={5}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            分类名称 *
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            排序顺序
                          </label>
                          <input
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            描述
                          </label>
                          <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            rows={2}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <ImageUpload
                            label="封面图片 (支持URL输入或图片上传/粘贴)"
                            value={formData.coverImage}
                            onChange={(url) => setFormData({ ...formData, coverImage: url })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleUpdate(category.id)}
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
                  <tr key={category.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {category.coverImage && (
                          <div className="flex-shrink-0 h-10 w-10 relative mr-4">
                            <Image
                              src={category.coverImage}
                              alt={category.name}
                              fill
                              className="rounded object-cover"
                            />
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-900">
                          {category.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {category.description || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{category.sortOrder}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{category._count.products}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {userPermission === "WRITE" ? (
                        <>
                          <button
                            onClick={() => startEdit(category)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(category.id, category.name)}
                            className="text-red-600 hover:text-red-900"
                            disabled={category._count.products > 0}
                            title={category._count.products > 0 ? "该分类下还有商品，无法删除" : ""}
                          >
                            删除
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400">只读</span>
                      )}
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-900">💡 使用说明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 分类可用于组织和筛选商品</li>
          <li>• 支持单个创建和批量添加两种模式</li>
          <li>• 批量添加时可以一次性创建多个分类，提高效率</li>
          <li>• 排序顺序数值越小越靠前</li>
          <li>• 删除分类前需要先移除该分类下的所有商品</li>
          <li>• 图片URL需要是公开可访问的网址</li>
        </ul>
      </div>
    </div>
  )
}
