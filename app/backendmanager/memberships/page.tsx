"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface MembershipPlan {
  id: string
  name: string
  price: number
  duration: number
  discount: number
  dailyLimit: number
  status: string
  sortOrder: number
}

export default function MembershipsAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    price: 0,
    duration: 365,
    discount: 0.8,
    dailyLimit: 10,
    sortOrder: 0
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

    fetchPlans()
  }, [status, session, router])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/membership-plans")

      if (!response.ok) {
        throw new Error("获取会员方案失败")
      }

      const data = await response.json()
      // 获取所有方案（包括inactive的）
      const allResponse = await fetch("/api/backendmanager/membership-plans")
      const allData = allResponse.ok ? await allResponse.json() : data

      setPlans(allData.plans || data.plans)
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }

  const startCreate = () => {
    setIsCreating(true)
    setFormData({
      name: "",
      price: 0,
      duration: 365,
      discount: 0.8,
      dailyLimit: 10,
      sortOrder: plans.length
    })
  }

  const startEdit = (plan: MembershipPlan) => {
    setEditingId(plan.id)
    setIsCreating(false)
    setFormData({
      name: plan.name,
      price: plan.price,
      duration: plan.duration,
      discount: plan.discount,
      dailyLimit: plan.dailyLimit,
      sortOrder: plan.sortOrder
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({
      name: "",
      price: 0,
      duration: 365,
      discount: 0.8,
      dailyLimit: 10,
      sortOrder: 0
    })
  }

  const handleCreate = async () => {
    try {
      // 验证必填字段
      if (!formData.name || formData.price <= 0 || formData.discount <= 0 || formData.dailyLimit <= 0) {
        alert("请填写所有必填字段")
        return
      }

      const response = await fetch("/api/membership-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "创建会员方案失败")
      }

      await fetchPlans()
      cancelEdit()
      alert("✓ 会员方案创建成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败")
    }
  }

  const handleUpdate = async (planId: string) => {
    try {
      const response = await fetch(`/api/membership-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "更新会员方案失败")
      }

      await fetchPlans()
      cancelEdit()
      alert("✓ 会员方案更新成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新失败")
    }
  }

  const handleStatusToggle = async (planId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active"
      const actionText = newStatus === "inactive" ? "停用" : "启用"

      if (!confirm(`确定要${actionText}这个会员方案吗？\n\n${actionText === "停用" ? "停用后，普通用户将无法看到此方案，但不会影响已购买的会员。" : "启用后，普通用户将可以购买此方案。"}`)) {
        return
      }

      const response = await fetch(`/api/membership-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error("更新状态失败")
      }

      await fetchPlans()
      alert(`✓ ${actionText}成功`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败")
    }
  }

  const handleDelete = async (planId: string, planName: string) => {
    if (!confirm(`确定要删除"${planName}"吗？\n\n如果已有会员购买了此方案，将无法删除。`)) {
      return
    }

    try {
      const response = await fetch(`/api/membership-plans/${planId}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "删除会员方案失败")
      }

      await fetchPlans()
      alert("✓ 会员方案删除成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败")
    }
  }

  const getDurationDisplay = (duration: number) => {
    if (duration === -1) return "终身"
    if (duration >= 365) return `${Math.floor(duration / 365)}年`
    return `${duration}天`
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
          <h1 className="text-3xl font-bold mb-2">会员方案管理</h1>
          <div className="flex gap-4 text-sm">
            <Link href="/backendmanager" className="text-gray-600 hover:text-blue-600">
              ← 返回商品管理
            </Link>
          </div>
        </div>
        <button
          onClick={startCreate}
          disabled={isCreating}
          className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
        >
          + 新增会员方案
        </button>
      </div>

      {/* 创建表单 */}
      {isCreating && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-green-900">创建新会员方案</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                方案名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="例如：年度会员"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                价格 (元) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="例如：88"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                有效期 (天，-1=终身) *
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 365 })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="例如：365"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                折扣率 (0-1) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.discount}
                onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0.8 })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="例如：0.8"
              />
              <p className="text-xs text-gray-500 mt-1">
                {(formData.discount * 10).toFixed(1)}折
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                每日折扣次数限制 *
              </label>
              <input
                type="number"
                value={formData.dailyLimit}
                onChange={(e) => setFormData({ ...formData, dailyLimit: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="例如：10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                排序
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="数字越小越靠前"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold"
            >
              创建
            </button>
            <button
              onClick={cancelEdit}
              className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow">
          <p className="mb-4">暂无会员方案</p>
          <button
            onClick={startCreate}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            创建第一个会员方案
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  方案名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  价格
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  有效期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  折扣
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  每日限制
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
              {plans.map((plan) => (
                editingId === plan.id ? (
                  <tr key={plan.id} className="bg-blue-50">
                    <td className="px-6 py-4" colSpan={7}>
                      <h3 className="text-lg font-semibold mb-4 text-blue-900">编辑会员方案</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            方案名称 *
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            价格 (元) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            有效期 (天，-1=终身) *
                          </label>
                          <input
                            type="number"
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 365 })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            折扣率 (0-1) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={formData.discount}
                            onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0.8 })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {(formData.discount * 10).toFixed(1)}折
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            每日折扣次数限制 *
                          </label>
                          <input
                            type="number"
                            value={formData.dailyLimit}
                            onChange={(e) => setFormData({ ...formData, dailyLimit: parseInt(e.target.value) || 10 })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            排序
                          </label>
                          <input
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleUpdate(plan.id)}
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
                  <tr key={plan.id} className={plan.status === "inactive" ? "bg-gray-50" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{plan.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">¥{plan.price.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getDurationDisplay(plan.duration)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{(plan.discount * 10).toFixed(1)}折</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">每天{plan.dailyLimit}次</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          plan.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {plan.status === "active" ? "启用" : "停用"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleStatusToggle(plan.id, plan.status)}
                          className={`${
                            plan.status === "active"
                              ? "text-orange-600 hover:text-orange-900"
                              : "text-green-600 hover:text-green-900"
                          }`}
                        >
                          {plan.status === "active" ? "停用" : "启用"}
                        </button>
                        <button
                          onClick={() => startEdit(plan)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(plan.id, plan.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      </div>
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
          <li>• <strong>新增方案</strong>：点击右上角"新增会员方案"按钮创建新方案</li>
          <li>• <strong>停用方案</strong>：停用后普通用户无法看到，但管理员可见，且不影响已购买的会员</li>
          <li>• <strong>删除方案</strong>：只能删除没有会员购买的方案，有会员购买的方案无法删除</li>
          <li>• <strong>折扣率</strong>：0.8表示8折，0.7表示7折</li>
          <li>• <strong>有效期</strong>：输入天数，-1表示终身</li>
          <li>• <strong>每日限制</strong>：会员每天最多享受折扣的商品数量，超出按原价</li>
          <li>• <strong>数据快照</strong>：已购买会员的配置不受修改影响，仅影响新购买的会员</li>
        </ul>
      </div>
    </div>
  )
}
