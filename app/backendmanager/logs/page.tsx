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

// 常见操作类型（可搜索的操作名称）
const COMMON_ACTIONS = [
  { value: '', label: '全部操作', category: 'all' },
  // 订单相关
  { value: 'order_created', label: '订单创建', category: 'order' },
  { value: 'order_creation_failed', label: '订单创建失败', category: 'order' },
  // 支付相关
  { value: 'payment_success', label: '支付成功', category: 'payment' },
  { value: 'payment_failed', label: '支付失败', category: 'payment' },
  { value: 'payment_callback_error', label: '支付回调错误', category: 'payment' },
  // 退款相关
  { value: 'order_refunded', label: '订单退款', category: 'refund' },
  { value: 'refund_failed', label: '退款失败', category: 'refund' },
  // 会员相关
  { value: 'membership_purchased', label: '会员购买', category: 'membership' },
  { value: 'membership_payment_failed', label: '会员支付失败', category: 'membership' },
  { value: 'membership_callback_error', label: '会员回调错误', category: 'membership' },
  // 系统操作
  { value: 'logs_queried', label: '查询日志', category: 'system' },
]

// 搜索关键词示例
const SEARCH_EXAMPLES = [
  { label: '订单号', value: 'ORD' },
  { label: '会员码', value: 'MEM-' },
  { label: '支付成功', value: '支付成功' },
  { label: '退款', value: '退款' },
]

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
  const [showSearchHelp, setShowSearchHelp] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)

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
      {/* 页面标题和帮助 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">系统日志管理</h1>
        <button
          onClick={() => setShowHelpModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          使用指南
        </button>
      </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              操作名称
              <span className="text-xs text-gray-500 font-normal">
                （选择业务操作类型）
              </span>
            </label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {COMMON_ACTIONS.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>

          {/* 关键词搜索 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              关键词搜索
              <button
                type="button"
                onClick={() => setShowSearchHelp(!showSearchHelp)}
                className="text-blue-600 hover:text-blue-800 text-xs"
              >
                [查看示例]
              </button>
            </label>
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              placeholder="搜索订单号、会员码、消息..."
              className="w-full px-3 py-2 border rounded-lg"
            />
            {showSearchHelp && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">快捷搜索示例：</p>
                <div className="flex flex-wrap gap-2">
                  {SEARCH_EXAMPLES.map((example) => (
                    <button
                      key={example.value}
                      onClick={() => {
                        setFilters({ ...filters, keyword: example.value })
                        setShowSearchHelp(false)
                      }}
                      className="px-3 py-1 bg-white border border-blue-300 rounded text-sm hover:bg-blue-100"
                    >
                      {example.label}: {example.value}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  💡 提示：可以搜索订单号、会员码、用户ID、路径等任何文本
                </p>
              </div>
            )}
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

      {/* 帮助模态框 */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">系统日志使用指南</h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 日志级别说明 */}
              <section>
                <h3 className="text-lg font-bold mb-3 text-gray-900">📊 日志级别</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">INFO</span>
                    <p className="text-sm text-gray-700">正常业务操作（订单创建、支付成功等）</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium">WARN</span>
                    <p className="text-sm text-gray-700">警告信息（支付失败、会员过期等）</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">ERROR</span>
                    <p className="text-sm text-gray-700">错误和异常（系统错误、处理失败等）</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm font-medium">DEBUG</span>
                    <p className="text-sm text-gray-700">调试信息（开发环境使用）</p>
                  </div>
                </div>
              </section>

              {/* 日志分类说明 */}
              <section>
                <h3 className="text-lg font-bold mb-3 text-gray-900">🏷️ 日志分类</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-medium">API</span>
                    <p className="text-sm text-gray-700">API 接口调用</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">认证</span>
                    <p className="text-sm text-gray-700">用户登录、注册</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm font-medium">支付</span>
                    <p className="text-sm text-gray-700">支付、退款操作</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">安全</span>
                    <p className="text-sm text-gray-700">安全警报、异常行为</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-sm font-medium">数据库</span>
                    <p className="text-sm text-gray-700">数据库操作</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm font-medium">系统</span>
                    <p className="text-sm text-gray-700">系统级操作</p>
                  </div>
                </div>
              </section>

              {/* 操作类型说明 */}
              <section>
                <h3 className="text-lg font-bold mb-3 text-gray-900">⚡ 常见操作类型</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">📦 订单相关</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                      <li><code className="bg-gray-100 px-1 rounded">order_created</code> - 订单创建成功</li>
                      <li><code className="bg-gray-100 px-1 rounded">order_creation_failed</code> - 订单创建失败</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">💳 支付相关</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                      <li><code className="bg-gray-100 px-1 rounded">payment_success</code> - 支付成功</li>
                      <li><code className="bg-gray-100 px-1 rounded">payment_failed</code> - 支付失败</li>
                      <li><code className="bg-gray-100 px-1 rounded">payment_callback_error</code> - 支付回调错误</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">💰 退款相关</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                      <li><code className="bg-gray-100 px-1 rounded">order_refunded</code> - 订单退款成功</li>
                      <li><code className="bg-gray-100 px-1 rounded">refund_failed</code> - 退款失败</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">👤 会员相关</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                      <li><code className="bg-gray-100 px-1 rounded">membership_purchased</code> - 会员购买成功</li>
                      <li><code className="bg-gray-100 px-1 rounded">membership_payment_failed</code> - 会员支付失败</li>
                      <li><code className="bg-gray-100 px-1 rounded">membership_callback_error</code> - 会员回调错误</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* 关键词搜索示例 */}
              <section>
                <h3 className="text-lg font-bold mb-3 text-gray-900">🔍 关键词搜索示例</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">搜索特定订单：</p>
                    <code className="text-sm bg-white px-3 py-1 rounded border">ORD1702467123456</code>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">搜索会员相关：</p>
                    <code className="text-sm bg-white px-3 py-1 rounded border">MEM-</code>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">搜索支付成功的记录：</p>
                    <code className="text-sm bg-white px-3 py-1 rounded border">支付成功</code>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">搜索退款操作：</p>
                    <code className="text-sm bg-white px-3 py-1 rounded border">退款</code>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">搜索特定用户的操作：</p>
                    <code className="text-sm bg-white px-3 py-1 rounded border">user_id</code>
                  </div>
                </div>
              </section>

              {/* 使用技巧 */}
              <section>
                <h3 className="text-lg font-bold mb-3 text-gray-900">💡 使用技巧</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>组合筛选：</strong>可以同时使用日志级别、分类、操作类型和关键词进行精确查询</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>时间范围：</strong>使用开始时间和结束时间可以精确到秒级别查询</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>查看详情：</strong>点击日志行可以展开查看完整的元数据信息</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>导出数据：</strong>支持导出为 CSV 或 JSON 格式用于离线分析</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>自动刷新：</strong>勾选自动刷新可以实时监控最新日志</span>
                  </li>
                </ul>
              </section>

              {/* 常见场景 */}
              <section className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-bold mb-3 text-blue-900">📌 常见查询场景</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong className="text-blue-900">查看今天的所有订单：</strong>
                    <p className="text-blue-800">选择操作类型 "订单创建" + 设置今天的开始和结束时间</p>
                  </div>
                  <div>
                    <strong className="text-blue-900">排查支付失败原因：</strong>
                    <p className="text-blue-800">选择日志级别 "WARN/ERROR" + 分类 "支付" + 操作类型 "支付失败"</p>
                  </div>
                  <div>
                    <strong className="text-blue-900">查看特定订单的完整流程：</strong>
                    <p className="text-blue-800">在关键词中输入订单号，查看该订单的所有相关日志</p>
                  </div>
                  <div>
                    <strong className="text-blue-900">监控系统错误：</strong>
                    <p className="text-blue-800">选择日志级别 "ERROR" + 启用自动刷新</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t">
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
