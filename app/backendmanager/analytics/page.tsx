"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface AnalyticsData {
  overview: {
    totalPV: number
    totalUV: number
    avgPVPerVisitor: string
  }
  timeSeries: Array<{
    time: string
    pv: number
    uv: number
  }>
  topIPs: Array<{
    ip: string
    count: number
  }>
  topPaths: Array<{
    path: string
    count: number
  }>
  topCountries: Array<{
    country: string
    count: number
  }>
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [userPermission, setUserPermission] = useState<"NONE" | "READ" | "WRITE">("NONE")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week' | 'month'>('day')
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')

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
      fetchAnalytics()
    }
  }, [dateRange, granularity, userPermission])

  const checkPermissionAndFetch = async () => {
    try {
      if (session?.user?.role === "ADMIN") {
        setUserPermission("WRITE")
        fetchAnalytics()
        return
      }

      const res = await fetch("/api/auth/permissions")
      const data = await res.json()
      const permission = data.permissions?.ANALYTICS || "NONE"

      setUserPermission(permission)

      if (permission === "NONE") {
        router.push("/")
        return
      }

      fetchAnalytics()
    } catch (error) {
      console.error("检查权限失败:", error)
      router.push("/")
    }
  }

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: new Date(dateRange.start).toISOString(),
        endDate: new Date(dateRange.end + 'T23:59:59').toISOString(),
        granularity
      })

      const response = await fetch(`/api/analytics/stats?${params}`)

      if (!response.ok) {
        // 根据不同的HTTP状态码显示不同的错误信息
        if (response.status === 403) {
          throw new Error("权限不足：您没有访问浏览量统计的权限")
        } else if (response.status === 401) {
          throw new Error("未登录：请先登录后再访问")
        } else {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "获取统计数据失败")
        }
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      console.error('获取统计数据失败:', err)
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }

  const setQuickRange = (days: number) => {
    const end = new Date()
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    })
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">用户浏览量统计</h1>
          <p className="text-gray-600">网站访问数据分析与可视化</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex flex-col items-center justify-center py-12">
            {/* 错误图标 */}
            <div className="mb-6">
              <svg
                className="w-20 h-20 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* 错误信息 */}
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {error.includes('权限') ? '权限不足' : '加载失败'}
            </h2>
            <p className="text-gray-600 text-center max-w-md mb-8">
              {error}
            </p>

            {/* 操作按钮 */}
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/backendmanager')}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                返回后台管理
              </button>
              {!error.includes('权限') && (
                <button
                  onClick={() => {
                    setError(null)
                    fetchAnalytics()
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  重新加载
                </button>
              )}
            </div>

            {/* 权限提示 */}
            {error.includes('权限') && (
              <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md">
                <p className="text-sm text-yellow-800">
                  <strong>💡 提示：</strong>如需访问浏览量统计，请联系管理员为您开通"商品管理"模块的读取权限。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/backendmanager"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
      >
        <span className="mr-2">←</span>
        返回后台管理
      </Link>
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">用户浏览量统计</h1>
        <p className="text-gray-600">网站访问数据分析与可视化</p>
      </div>

      {/* 筛选控制栏 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 快速日期选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              快速选择
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setQuickRange(7)}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                近7天
              </button>
              <button
                onClick={() => setQuickRange(30)}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                近30天
              </button>
              <button
                onClick={() => setQuickRange(90)}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                近90天
              </button>
            </div>
          </div>

          {/* 自定义日期范围 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              开始日期
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              结束日期
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 时间粒度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              时间粒度
            </label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="hour">按小时</option>
              <option value="day">按天</option>
              <option value="week">按周</option>
              <option value="month">按月</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={fetchAnalytics}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            查询
          </button>
        </div>
      </div>

      {/* 概览卡片 */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-1">总访问量 (PV)</p>
                  <p className="text-3xl font-bold">{data.overview.totalPV.toLocaleString()}</p>
                </div>
                <div className="bg-blue-400 bg-opacity-50 p-3 rounded-full">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm mb-1">独立访客 (UV)</p>
                  <p className="text-3xl font-bold">{data.overview.totalUV.toLocaleString()}</p>
                </div>
                <div className="bg-green-400 bg-opacity-50 p-3 rounded-full">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm mb-1">平均访问深度</p>
                  <p className="text-3xl font-bold">{data.overview.avgPVPerVisitor}</p>
                </div>
                <div className="bg-purple-400 bg-opacity-50 p-3 rounded-full">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 趋势图 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">访问趋势</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartType('line')}
                  className={`px-4 py-2 rounded-md ${chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  曲线图
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-4 py-2 rounded-md ${chartType === 'bar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  柱状图
                </button>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={400}>
              {chartType === 'line' ? (
                <LineChart data={data.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="pv"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="访问量 (PV)"
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="uv"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="独立访客 (UV)"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              ) : (
                <BarChart data={data.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pv" fill="#3b82f6" name="访问量 (PV)" />
                  <Bar dataKey="uv" fill="#10b981" name="独立访客 (UV)" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* 统计表格 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top访问路径 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">热门页面 TOP 10</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">排名</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">路径</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">访问次数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topPaths.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">{index + 1}</td>
                        <td className="py-2 px-3 text-sm font-mono">{item.path}</td>
                        <td className="py-2 px-3 text-sm text-right font-semibold">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top访问IP */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">访问来源 IP TOP 10</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">排名</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">IP地址</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">访问次数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topIPs.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">{index + 1}</td>
                        <td className="py-2 px-3 text-sm font-mono">{item.ip}</td>
                        <td className="py-2 px-3 text-sm text-right font-semibold">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 地区统计 */}
          {data.topCountries.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-bold mb-4">访问地区 TOP 10</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">排名</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">国家/地区</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">访问次数</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCountries.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">{index + 1}</td>
                        <td className="py-2 px-3 text-sm">{item.country}</td>
                        <td className="py-2 px-3 text-sm text-right font-semibold">{item.count}</td>
                        <td className="py-2 px-3 text-sm text-right">
                          {((item.count / data.overview.totalPV) * 100).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
