"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Banner {
  id: string
  title: string
  image: string
  link: string | null
  description: string | null
  sortOrder: number
  status: string
  createdAt: string
  updatedAt: string
}

export default function BannersAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    image: "",
    link: "",
    description: "",
    sortOrder: 0,
    status: "active" as "active" | "inactive"
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (session?.user?.role !== "ADMIN") {
      router.push("/")
      return
    }

    fetchBanners()
  }, [status, session, router])

  const fetchBanners = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/backendmanager/banners")

      if (!response.ok) {
        throw new Error("获取轮播图列表失败")
      }

      const data = await response.json()
      setBanners(data.banners)
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }

  const startCreate = () => {
    setIsCreating(true)
    setFormData({
      title: "",
      image: "",
      link: "",
      description: "",
      sortOrder: 0,
      status: "active"
    })
  }

  const startEdit = (banner: Banner) => {
    setEditingId(banner.id)
    setFormData({
      title: banner.title,
      image: banner.image,
      link: banner.link || "",
      description: banner.description || "",
      sortOrder: banner.sortOrder,
      status: banner.status as "active" | "inactive"
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({
      title: "",
      image: "",
      link: "",
      description: "",
      sortOrder: 0,
      status: "active"
    })
  }

  const handleCreate = async () => {
    try {
      // 前端验证
      if (!formData.title.trim()) {
        alert("请输入轮播图标题")
        return
      }
      if (!formData.image.trim()) {
        alert("请输入图片URL")
        return
      }

      const response = await fetch("/api/backendmanager/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          link: formData.link.trim() || undefined,
          description: formData.description.trim() || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "创建轮播图失败")
      }

      await fetchBanners()
      cancelEdit()
      alert("✓ 轮播图创建成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败")
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      // 前端验证
      if (!formData.title.trim()) {
        alert("请输入轮播图标题")
        return
      }
      if (!formData.image.trim()) {
        alert("请输入图片URL")
        return
      }

      const response = await fetch(`/api/backendmanager/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          link: formData.link.trim() || undefined,
          description: formData.description.trim() || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "更新轮播图失败")
      }

      await fetchBanners()
      cancelEdit()
      alert("✓ 轮播图更新成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新失败")
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确定要删除轮播图"${title}"吗？`)) {
      return
    }

    try {
      const response = await fetch(`/api/backendmanager/banners/${id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "删除轮播图失败")
      }

      await fetchBanners()
      alert("✓ 轮播图删除成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败")
    }
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active"

    try {
      const response = await fetch(`/api/backendmanager/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "更新状态失败")
      }

      await fetchBanners()
      alert("✓ 状态已更新")
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新失败")
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
          <h1 className="text-3xl font-bold mb-4">后台管理 - 轮播图管理</h1>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/backendmanager"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              商品管理
            </Link>
            <Link
              href="/backendmanager/categories"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              分类管理
            </Link>
            <Link
              href="/backendmanager/security-alerts"
              className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 font-medium"
            >
              🔒 安全警报
            </Link>
          </div>
        </div>
        <button
          onClick={startCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + 新建轮播图
        </button>
      </div>

      {/* 创建/编辑表单 */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {isCreating ? "创建新轮播图" : "编辑轮播图"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标题 * <span className="text-xs text-gray-500">(最多200字符)</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如：春季新品促销"
                maxLength={200}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                图片URL * <span className="text-xs text-gray-500">(仅支持 http/https，最多2000字符)</span>
              </label>
              <input
                type="url"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/banner.jpg"
                maxLength={2000}
              />
              {formData.image && (
                <div className="mt-2 w-full h-40 rounded border overflow-hidden bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formData.image}
                    alt="预览"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E加载失败%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                链接URL (可选) <span className="text-xs text-gray-500">(仅支持 http/https，最多2000字符)</span>
              </label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="点击轮播图跳转的URL (留空则不可点击)"
                maxLength={2000}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                描述 (可选) <span className="text-xs text-gray-500">(最多1000字符)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="轮播图描述文字"
                maxLength={1000}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                排序顺序 <span className="text-xs text-gray-500">(-100 到 9999，数字越小越靠前)</span>
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={-100}
                max={9999}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                状态
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={isCreating ? handleCreate : () => handleUpdate(editingId!)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {isCreating ? "创建" : "保存"}
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

      {/* 轮播图列表 */}
      {banners.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow">
          暂无轮播图
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  预览
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  标题 / 描述
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  链接
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  排序
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
              {banners.map((banner) => (
                <tr key={banner.id} className={editingId === banner.id ? "bg-blue-50" : ""}>
                  <td className="px-6 py-4">
                    <div className="w-32 h-20 rounded overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={banner.image}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E无法加载%3C/text%3E%3C/svg%3E'
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {banner.title}
                    </div>
                    {banner.description && (
                      <div className="text-sm text-gray-500 mt-1">
                        {banner.description.substring(0, 60)}
                        {banner.description.length > 60 && "..."}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {banner.link ? (
                      <a
                        href={banner.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline max-w-xs block truncate"
                      >
                        {banner.link}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{banner.sortOrder}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        banner.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {banner.status === "active" ? "启用" : "禁用"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => toggleStatus(banner.id, banner.status)}
                      className={`${
                        banner.status === "active"
                          ? "text-red-600 hover:text-red-900"
                          : "text-green-600 hover:text-green-900"
                      }`}
                    >
                      {banner.status === "active" ? "禁用" : "启用"}
                    </button>
                    <button
                      onClick={() => startEdit(banner)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id, banner.title)}
                      className="text-red-600 hover:text-red-900"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 安全提示 */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">🔒 安全提示</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• 最多可创建 50 个轮播图</li>
          <li>• 仅支持 http/https 协议的图片和链接URL</li>
          <li>• 系统会自动检测并拦截可疑URL（如 javascript:、data: 等）</li>
          <li>• 所有操作都会记录到安全审计日志</li>
        </ul>
      </div>
    </div>
  )
}
