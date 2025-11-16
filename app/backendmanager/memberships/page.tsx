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

  const startEdit = (plan: MembershipPlan) => {
    setEditingId(plan.id)
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
    setFormData({
      name: "",
      price: 0,
      duration: 365,
      discount: 0.8,
      dailyLimit: 10,
      sortOrder: 0
    })
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
      const response = await fetch(`/api/membership-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error("更新状态失败")
      }

      await fetchPlans()
      alert("✓ 状态更新成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新失败")
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
      </div>

      {plans.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow">
          暂无会员方案
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            方案名称 *
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
                            价格 (元) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            有效期 (天，-1=终身) *
                          </label>
                          <input
                            type="number"
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md"
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
                            onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md"
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
                            onChange={(e) => setFormData({ ...formData, dailyLimit: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            排序
                          </label>
                          <input
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md"
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
                  <tr key={plan.id}>
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
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {plan.status === "active" ? "启用" : "停用"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleStatusToggle(plan.id, plan.status)}
                        className={`${
                          plan.status === "active"
                            ? "text-red-600 hover:text-red-900"
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
          <li>• 折扣率：0.8表示8折，0.7表示7折</li>
          <li>• 有效期：输入天数，-1表示终身</li>
          <li>• 每日限制：会员每天最多享受折扣的商品数量，超出按原价</li>
          <li>• 已购买会员的配置不受修改影响，仅影响新购买的会员</li>
        </ul>
      </div>
    </div>
  )
}
