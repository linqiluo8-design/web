"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface SystemLog {
  id: string
  level: string
  category: string
  action: string
  message: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  path?: string
  method?: string
  statusCode?: number
  duration?: number
  metadata?: string
  error?: string
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function SystemLogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [logs, setLogs] = useState<SystemLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(5000) // 5秒

  // 筛选条件
  const [filters, setFilters] = useState({
    level: 'all',
    category: 'all',
    action: '',
    keyword: '',
    startDate: '',
    endDate: ''
  })

  // 权限检查
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  // 加载日志
  const loadLogs = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit)
      })

      if (filters.level !== 'all') params.append('level', filters.level)
      if (filters.category !== 'all') params.append('category', filters.category)
      if (filters.action) params.append('action', filters.action)
      if (filters.keyword) params.append('keyword', filters.keyword)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const res = await fetch(`/api/backendmanager/logs?${params}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "加载日志失败")
      }

      const data = await res.json()
      setLogs(data.logs)
      setPagination(data.pagination)
    } catch (err: any) {
      console.error("加载日志失败:", err)
      alert(err.message || "加载日志失败")
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    if (status === "authenticated") {
      loadLogs()
    }
  }, [status, pagination.page, pagination.limit])

  // 自动刷新
  useEffect(() => {
    if (autoRefresh && status === "authenticated") {
      const timer = setInterval(() => {
        loadLogs()
      }, refreshInterval)

      return () => clearInterval(timer)
    }
  }, [autoRefresh, refreshInterval, status, filters, pagination.page])

  // 导出日志
  const exportLogs = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({ format })

      if (filters.level !== 'all') params.append('level', filters.level)
      if (filters.category !== 'all') params.append('category', filters.category)
      if (filters.action) params.append('action', filters.action)
      if (filters.keyword) params.append('keyword', filters.keyword)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const url = `/api/backendmanager/logs/export?${params}`
      window.open(url, '_blank')
    } catch (err: any) {
      console.error("导出日志失败:", err)
      alert(err.message || "导出日志失败")
    }
  }

  // 获取级别颜色
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-800'
      case 'warn': return 'bg-yellow-100 text-yellow-800'
      case 'info': return 'bg-blue-100 text-blue-800'
      case 'debug': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 获取分类颜色
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'api': return 'bg-purple-100 text-purple-800'
      case 'auth': return 'bg-green-100 text-green-800'
      case 'payment': return 'bg-orange-100 text-orange-800'
      case 'security': return 'bg-red-100 text-red-800'
      case 'database': return 'bg-indigo-100 text-indigo-800'
      case 'system': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (status === "loading") {
    return <div className="container mx-auto p-6">加载中...</div>
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">系统日志管理</h1>

      {/* 筛选和控制面板 */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* 日志级别 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              日志级别
            </label>
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="all">全部</option>
              <option value="info">INFO</option>
              <option value="warn">WARN</option>
              <option value="error">ERROR</option>
              <option value="debug">DEBUG</option>
            </select>
          </div>

          {/* 日志分类 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              日志分类
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="all">全部</option>
              <option value="api">API</option>
              <option value="auth">认证</option>
              <option value="payment">支付</option>
              <option value="security">安全</option>
              <option value="database">数据库</option>
              <option value="system">系统</option>
            </select>
          </div>

          {/* 操作名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              操作名称
            </label>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              placeholder="如: order_created"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* 关键词搜索 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              关键词搜索
            </label>
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              placeholder="搜索消息、路径..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* 开始时间（精确到秒） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开始时间
            </label>
            <input
              type="datetime-local"
              step="1"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* 结束时间（精确到秒） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束时间
            </label>
            <input
              type="datetime-local"
              step="1"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? '查询中...' : '查询日志'}
          </button>

          <button
            onClick={() => exportLogs('csv')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            导出 CSV
          </button>

          <button
            onClick={() => exportLogs('json')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            导出 JSON
          </button>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">每页显示:</label>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination({ ...pagination, limit: Number(e.target.value), page: 1 })}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value={5}>5 条</option>
              <option value={10}>10 条</option>
              <option value={15}>15 条</option>
              <option value={20}>20 条</option>
              <option value={25}>25 条</option>
              <option value={50}>50 条</option>
              <option value={100}>100 条</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">自动刷新</span>
            </label>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value={3000}>3秒</option>
                <option value={5000}>5秒</option>
                <option value={10000}>10秒</option>
                <option value={30000}>30秒</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">级别</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">消息</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">路径</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">耗时</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                      {log.level.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(log.category)}`}>
                      {log.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">{log.action}</td>
                  <td className="px-4 py-3 text-sm max-w-md truncate" title={log.message}>
                    {log.message}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {log.method && <span className="text-blue-600 font-medium">{log.method}</span>} {log.path}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {log.duration ? `${log.duration}ms` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-6 py-4 border-t">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* 分页信息 */}
            <div className="text-sm text-gray-700">
              共 {pagination.total} 条日志，第 {pagination.page} / {pagination.totalPages || 1} 页
              {pagination.total > 0 && (
                <span className="ml-2 text-gray-500">
                  (显示第 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条)
                </span>
              )}
            </div>

            {/* 分页控件 */}
            <div className="flex items-center gap-2">
              {/* 首页 */}
              <button
                onClick={() => setPagination({ ...pagination, page: 1 })}
                disabled={pagination.page === 1}
                className="px-3 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                title="首页"
              >
                首页
              </button>

              {/* 上一页 */}
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-3 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                title="上一页"
              >
                上一页
              </button>

              {/* 页码显示 */}
              <div className="flex items-center gap-1">
                {/* 如果总页数较少，显示所有页码 */}
                {pagination.totalPages <= 7 ? (
                  Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setPagination({ ...pagination, page: pageNum })}
                      className={`px-3 py-2 border rounded-lg text-sm ${
                        pagination.page === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))
                ) : (
                  /* 如果总页数较多，只显示部分页码 */
                  <>
                    {pagination.page > 3 && (
                      <>
                        <button
                          onClick={() => setPagination({ ...pagination, page: 1 })}
                          className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                        >
                          1
                        </button>
                        {pagination.page > 4 && <span className="px-2">...</span>}
                      </>
                    )}

                    {[...Array(5)].map((_, i) => {
                      const pageNum = pagination.page - 2 + i
                      if (pageNum < 1 || pageNum > pagination.totalPages) return null
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPagination({ ...pagination, page: pageNum })}
                          className={`px-3 py-2 border rounded-lg text-sm ${
                            pagination.page === pageNum
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}

                    {pagination.page < pagination.totalPages - 2 && (
                      <>
                        {pagination.page < pagination.totalPages - 3 && <span className="px-2">...</span>}
                        <button
                          onClick={() => setPagination({ ...pagination, page: pagination.totalPages })}
                          className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                        >
                          {pagination.totalPages}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* 下一页 */}
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
                className="px-3 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                title="下一页"
              >
                下一页
              </button>

              {/* 末页 */}
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.totalPages })}
                disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
                className="px-3 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                title="末页"
              >
                末页
              </button>

              {/* 跳转到指定页 */}
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-gray-600">跳转到</span>
                <input
                  type="number"
                  min={1}
                  max={pagination.totalPages}
                  placeholder="页码"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = parseInt(e.currentTarget.value)
                      if (value >= 1 && value <= pagination.totalPages) {
                        setPagination({ ...pagination, page: value })
                        e.currentTarget.value = ''
                      }
                    }
                  }}
                  className="w-16 px-2 py-1 border rounded text-sm text-center"
                />
                <span className="text-sm text-gray-600">页</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
