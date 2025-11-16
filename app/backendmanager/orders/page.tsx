"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface OrderStats {
  total: number
  pending: number
  paid: number
  completed: number
  cancelled: number
  refunded: number
}

export default function OrderManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    paid: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0
  })

  // 导出配置
  const [exportFormat, setExportFormat] = useState("csv")
  const [exportStartDate, setExportStartDate] = useState("")
  const [exportEndDate, setExportEndDate] = useState("")
  const [exportStatus, setExportStatus] = useState("all")
  const [exportType, setExportType] = useState<"custom" | "month">("month")
  const [customDays, setCustomDays] = useState(30)

  // 清理配置
  const [cleanupStartDate, setCleanupStartDate] = useState("")
  const [cleanupEndDate, setCleanupEndDate] = useState("")
  const [cleanupStatus, setCleanupStatus] = useState("all")
  const [cleanupType, setCleanupType] = useState<"custom" | "month">("month")
  const [cleanupCustomDays, setCleanupCustomDays] = useState(30)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (session?.user?.role !== "ADMIN") {
      router.push("/")
      return
    }

    fetchStats()

    // 自动设置默认的日期范围（当月）
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    setExportStartDate(firstDay.toISOString().split('T')[0])
    setExportEndDate(lastDay.toISOString().split('T')[0])
    setCleanupStartDate(firstDay.toISOString().split('T')[0])
    setCleanupEndDate(lastDay.toISOString().split('T')[0])
  }, [status, session, router])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/backendmanager/orders")
      if (response.ok) {
        const data = await response.json()
        const orders = data.orders || []

        setStats({
          total: orders.length,
          pending: orders.filter((o: any) => o.status === "pending").length,
          paid: orders.filter((o: any) => o.status === "paid").length,
          completed: orders.filter((o: any) => o.status === "completed").length,
          cancelled: orders.filter((o: any) => o.status === "cancelled").length,
          refunded: orders.filter((o: any) => o.status === "refunded").length,
        })
      }
    } catch (err) {
      console.error("获取订单统计失败:", err)
    }
  }

  // 更新日期范围（按类型）
  const updateExportDateRange = (type: "custom" | "month") => {
    setExportType(type)
    const now = new Date()

    if (type === "month") {
      // 自然月
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setExportStartDate(firstDay.toISOString().split('T')[0])
      setExportEndDate(lastDay.toISOString().split('T')[0])
    } else {
      // 自定义天数
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - customDays)
      setExportStartDate(startDate.toISOString().split('T')[0])
      setExportEndDate(now.toISOString().split('T')[0])
    }
  }

  const updateCleanupDateRange = (type: "custom" | "month") => {
    setCleanupType(type)
    const now = new Date()

    if (type === "month") {
      // 自然月
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setCleanupStartDate(firstDay.toISOString().split('T')[0])
      setCleanupEndDate(lastDay.toISOString().split('T')[0])
    } else {
      // 自定义天数
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - cleanupCustomDays)
      setCleanupStartDate(startDate.toISOString().split('T')[0])
      setCleanupEndDate(now.toISOString().split('T')[0])
    }
  }

  const handleExport = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        format: exportFormat,
      })

      if (exportStartDate) {
        params.append("startDate", exportStartDate)
      }

      if (exportEndDate) {
        params.append("endDate", exportEndDate)
      }

      if (exportStatus !== "all") {
        params.append("status", exportStatus)
      }

      // 下载文件
      const response = await fetch(`/api/backendmanager/orders/export?${params}`)

      if (!response.ok) {
        throw new Error("导出失败")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `orders_${Date.now()}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      alert("✓ 导出成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "导出失败")
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    if (!confirm(`确定要删除 ${cleanupStartDate} 至 ${cleanupEndDate} 期间的订单吗？\n\n此操作不可恢复，请确保已经导出备份！`)) {
      return
    }

    if (!confirm("再次确认：你确定要删除这些订单数据吗？")) {
      return
    }

    try {
      setLoading(true)

      const response = await fetch("/api/backendmanager/orders/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: cleanupStartDate,
          endDate: cleanupEndDate,
          status: cleanupStatus !== "all" ? cleanupStatus : undefined,
          confirmDelete: true
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "清理失败")
      }

      const data = await response.json()
      alert(`✓ ${data.message}`)

      // 刷新统计数据
      await fetchStats()
    } catch (err) {
      alert(err instanceof Error ? err.message : "清理失败")
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">订单数据管理</h1>
          <Link
            href="/backendmanager"
            className="text-gray-600 hover:text-blue-600"
          >
            ← 返回商品管理
          </Link>
        </div>
      </div>

      {/* 订单统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">订单总数</div>
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">待支付</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">已支付</div>
          <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">已完成</div>
          <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">已取消</div>
          <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">已退款</div>
          <div className="text-2xl font-bold text-red-600">{stats.refunded}</div>
        </div>
      </div>

      {/* 导出订单数据 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">导出订单数据</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              导出范围
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => updateExportDateRange("month")}
                className={`px-4 py-2 border rounded-md ${
                  exportType === "month" ? "bg-blue-600 text-white" : "bg-white"
                }`}
              >
                按自然月
              </button>
              <button
                onClick={() => updateExportDateRange("custom")}
                className={`px-4 py-2 border rounded-md ${
                  exportType === "custom" ? "bg-blue-600 text-white" : "bg-white"
                }`}
              >
                自定义天数
              </button>
            </div>
            {exportType === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value))}
                  className="w-20 px-3 py-2 border rounded-md"
                  min="1"
                />
                <span className="text-sm text-gray-600">天</span>
                <button
                  onClick={() => updateExportDateRange("custom")}
                  className="px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  应用
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              导出格式
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="csv">CSV (Excel)</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开始日期
            </label>
            <input
              type="date"
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束日期
            </label>
            <input
              type="date"
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              订单状态
            </label>
            <select
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="all">全部状态</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
              <option value="refunded">已退款</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "导出中..." : "导出订单数据"}
        </button>
      </div>

      {/* 清理订单数据 */}
      <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
        <h2 className="text-xl font-semibold mb-2 text-red-600">清理订单数据</h2>
        <p className="text-sm text-gray-600 mb-4">
          警告：此操作将永久删除订单数据，无法恢复！请确保已经导出备份后再执行清理操作。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              清理范围
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => updateCleanupDateRange("month")}
                className={`px-4 py-2 border rounded-md ${
                  cleanupType === "month" ? "bg-red-600 text-white" : "bg-white"
                }`}
              >
                按自然月
              </button>
              <button
                onClick={() => updateCleanupDateRange("custom")}
                className={`px-4 py-2 border rounded-md ${
                  cleanupType === "custom" ? "bg-red-600 text-white" : "bg-white"
                }`}
              >
                自定义天数
              </button>
            </div>
            {cleanupType === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={cleanupCustomDays}
                  onChange={(e) => setCleanupCustomDays(parseInt(e.target.value))}
                  className="w-20 px-3 py-2 border rounded-md"
                  min="1"
                />
                <span className="text-sm text-gray-600">天</span>
                <button
                  onClick={() => updateCleanupDateRange("custom")}
                  className="px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  应用
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              订单状态
            </label>
            <select
              value={cleanupStatus}
              onChange={(e) => setCleanupStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="all">全部状态</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
              <option value="refunded">已退款</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开始日期
            </label>
            <input
              type="date"
              value={cleanupStartDate}
              onChange={(e) => setCleanupStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束日期
            </label>
            <input
              type="date"
              value={cleanupEndDate}
              onChange={(e) => setCleanupEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <button
          onClick={handleCleanup}
          disabled={loading}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "清理中..." : "清理订单数据"}
        </button>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-900">使用说明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 导出功能支持CSV和JSON两种格式，CSV可直接用Excel打开</li>
          <li>• 按自然月导出：导出当前自然月的所有订单</li>
          <li>• 自定义天数：导出最近N天的订单（默认30天）</li>
          <li>• 清理功能会永久删除订单数据，请务必先导出备份</li>
          <li>• 建议定期导出订单数据作为备份，可按月或按自定义周期进行</li>
          <li>• 已清理的订单数据无法恢复，请谨慎操作</li>
        </ul>
      </div>
    </div>
  )
}
