"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface SecurityAlert {
  id: string
  type: string
  severity: string
  userId: string | null
  ipAddress: string | null
  userAgent: string | null
  description: string
  metadata: any
  status: string
  resolvedBy: string | null
  resolvedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export default function SecurityAlertsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [userPermission, setUserPermission] = useState<"NONE" | "READ" | "WRITE">("NONE")
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showBatchActions, setShowBatchActions] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (status === "authenticated" && session?.user) {
      checkPermissionAndFetch()
    }
  }, [status, session, router])

  useEffect(() => {
    if (userPermission !== "NONE") {
      fetchAlerts()
    }
  }, [page, statusFilter, severityFilter, userPermission])

  const checkPermissionAndFetch = async () => {
    try {
      if (session?.user?.role === "ADMIN") {
        setUserPermission("WRITE")
        fetchAlerts()
        return
      }

      const res = await fetch("/api/auth/permissions")
      const data = await res.json()
      const permission = data.permissions?.SECURITY_ALERTS || "NONE"

      setUserPermission(permission)

      if (permission === "NONE") {
        router.push("/")
        return
      }

      fetchAlerts()
    } catch (error) {
      console.error("检查权限失败:", error)
      router.push("/")
    }
  }

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20"
      })

      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }

      if (severityFilter !== "all") {
        params.append("severity", severityFilter)
      }

      const response = await fetch(`/api/backendmanager/security-alerts?${params}`)

      if (!response.ok) {
        throw new Error("获取安全警报失败")
      }

      const data = await response.json()
      setAlerts(data.alerts)
      setUnresolvedCount(data.unresolvedCount)
      setTotalPages(data.pagination.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (alertId: string, newStatus: string, notes?: string) => {
    try {
      const response = await fetch(`/api/backendmanager/security-alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes })
      })

      if (!response.ok) {
        throw new Error("更新警报状态失败")
      }

      await fetchAlerts()
      setShowDetail(false)
      alert("✓ 警报状态更新成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新失败")
    }
  }

  const handleDelete = async (alertId: string) => {
    if (!confirm("确定要删除这条警报吗？")) {
      return
    }

    try {
      const response = await fetch(`/api/backendmanager/security-alerts/${alertId}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        throw new Error("删除警报失败")
      }

      await fetchAlerts()
      setShowDetail(false)
      alert("✓ 警报删除成功")
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败")
    }
  }

  // 批量操作：删除
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      alert("请先选择要删除的警报")
      return
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.length} 条警报吗？`)) {
      return
    }

    try {
      const response = await fetch("/api/backendmanager/security-alerts/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "批量删除失败")
      }

      await fetchAlerts()
      setSelectedIds([])
      alert(`✓ 成功删除 ${selectedIds.length} 条警报`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量删除失败")
    }
  }

  // 批量操作：更新状态
  const handleBatchUpdateStatus = async (newStatus: string) => {
    if (selectedIds.length === 0) {
      alert("请先选择要更新的警报")
      return
    }

    let notes: string | undefined
    if (newStatus === "resolved") {
      const input = prompt("请输入处理备注（可选）:")
      notes = input || undefined
    } else if (newStatus === "false_positive") {
      const input = prompt("请说明为什么这些是误报:")
      notes = input || undefined
    }

    try {
      const response = await fetch("/api/backendmanager/security-alerts/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status: newStatus, notes })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "批量更新失败")
      }

      await fetchAlerts()
      setSelectedIds([])
      alert(`✓ 成功更新 ${selectedIds.length} 条警报状态`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量更新失败")
    }
  }

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.length === alerts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(alerts.map(alert => alert.id))
    }
  }

  // 切换单个选择
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "unresolved":
        return "bg-red-100 text-red-800"
      case "investigating":
        return "bg-yellow-100 text-yellow-800"
      case "resolved":
        return "bg-green-100 text-green-800"
      case "false_positive":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "ZERO_AMOUNT_ORDER":
        return "0元订单尝试"
      case "PRICE_MANIPULATION":
        return "价格篡改"
      default:
        return type
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "unresolved":
        return "未处理"
      case "investigating":
        return "调查中"
      case "resolved":
        return "已解决"
      case "false_positive":
        return "误报"
      default:
        return status
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
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">安全警报中心</h1>
            {userPermission === "READ" && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                只读模式
              </span>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <Link href="/backendmanager" className="text-gray-600 hover:text-blue-600">
              ← 返回管理后台
            </Link>
            {unresolvedCount > 0 && (
              <span className="text-red-600 font-semibold">
                ⚠️ {unresolvedCount} 条未处理警报
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              状态筛选
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="all">全部</option>
              <option value="unresolved">未处理</option>
              <option value="investigating">调查中</option>
              <option value="resolved">已解决</option>
              <option value="false_positive">误报</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              严重程度筛选
            </label>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="all">全部</option>
              <option value="critical">严重</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow">
          <p className="mb-4">暂无安全警报</p>
        </div>
      ) : (
        <>
          {/* 批量操作工具栏 */}
          {selectedIds.length > 0 && userPermission === "WRITE" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
              <div className="text-sm text-blue-900">
                已选择 <span className="font-bold">{selectedIds.length}</span> 条警报
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBatchUpdateStatus("investigating")}
                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700"
                >
                  批量标记为调查中
                </button>
                <button
                  onClick={() => handleBatchUpdateStatus("resolved")}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  批量标记为已解决
                </button>
                <button
                  onClick={() => handleBatchUpdateStatus("false_positive")}
                  className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                >
                  批量标记为误报
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                >
                  批量删除
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
                >
                  取消选择
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    {userPermission === "WRITE" && (
                      <input
                        type="checkbox"
                        checked={selectedIds.length === alerts.length && alerts.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    类型
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    严重程度
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    描述
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
                {alerts.map((alert) => (
                  <tr key={alert.id} className={alert.status === "unresolved" ? "bg-red-50" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {userPermission === "WRITE" && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(alert.id)}
                          onChange={() => handleToggleSelect(alert.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(alert.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {getTypeLabel(alert.type)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getSeverityColor(
                          alert.severity
                        )}`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md truncate">
                        {alert.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          alert.status
                        )}`}
                      >
                        {getStatusLabel(alert.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedAlert(alert)
                          setShowDetail(true)
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="px-4 py-2">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* 详情弹窗 */}
      {showDetail && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">警报详情</h2>
              <button
                onClick={() => setShowDetail(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">类型</label>
                <p className="mt-1">{getTypeLabel(selectedAlert.type)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">严重程度</label>
                <span
                  className={`mt-1 px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getSeverityColor(
                    selectedAlert.severity
                  )}`}
                >
                  {selectedAlert.severity.toUpperCase()}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">描述</label>
                <p className="mt-1">{selectedAlert.description}</p>
              </div>

              {selectedAlert.ipAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">IP地址</label>
                  <p className="mt-1 font-mono text-sm">{selectedAlert.ipAddress}</p>
                </div>
              )}

              {selectedAlert.userAgent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">User Agent</label>
                  <p className="mt-1 text-sm break-all">{selectedAlert.userAgent}</p>
                </div>
              )}

              {selectedAlert.metadata && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">详细数据</label>
                  <pre className="mt-1 bg-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                    {JSON.stringify(selectedAlert.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">当前状态</label>
                <span
                  className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                    selectedAlert.status
                  )}`}
                >
                  {getStatusLabel(selectedAlert.status)}
                </span>
              </div>

              {selectedAlert.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">处理备注</label>
                  <p className="mt-1">{selectedAlert.notes}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">创建时间</label>
                <p className="mt-1">{new Date(selectedAlert.createdAt).toLocaleString("zh-CN")}</p>
              </div>

              {selectedAlert.resolvedAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">处理时间</label>
                  <p className="mt-1">{new Date(selectedAlert.resolvedAt).toLocaleString("zh-CN")}</p>
                </div>
              )}

              {userPermission === "WRITE" && (
                <div className="border-t pt-4 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">操作</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedAlert.status === "unresolved" && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(selectedAlert.id, "investigating")}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                        >
                          标记为调查中
                        </button>
                        <button
                          onClick={() => {
                            const notes = prompt("请输入处理备注（可选）:")
                            handleUpdateStatus(selectedAlert.id, "resolved", notes || undefined)
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          标记为已解决
                        </button>
                        <button
                          onClick={() => {
                            const notes = prompt("请说明为什么这是误报:")
                            handleUpdateStatus(selectedAlert.id, "false_positive", notes || undefined)
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                        >
                          标记为误报
                        </button>
                      </>
                    )}
                    {selectedAlert.status === "investigating" && (
                      <button
                        onClick={() => {
                          const notes = prompt("请输入处理备注（可选）:")
                          handleUpdateStatus(selectedAlert.id, "resolved", notes || undefined)
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        标记为已解决
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selectedAlert.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      删除警报
                    </button>
                  </div>
                </div>
              )}
              {userPermission === "READ" && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">只读模式：无法执行操作</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-900">💡 安全警报说明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>0元订单尝试</strong>：检测到有人尝试创建金额为0或异常的订单，可能是价格篡改攻击</li>
          <li>• <strong>批量操作</strong>：勾选多个警报后，可以批量更新状态或批量删除（最多支持100条）</li>
          <li>• <strong>查看详情</strong>：点击可查看完整的警报信息，包括IP地址、User Agent等</li>
          <li>• <strong>处理警报</strong>：可以将警报标记为调查中、已解决或误报</li>
          <li>• <strong>定期检查</strong>：建议定期检查未处理的警报，及时发现和处理安全问题</li>
        </ul>
      </div>
    </div>
  )
}
