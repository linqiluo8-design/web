"use client"

import { useState, useEffect } from "react"
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
  ResponsiveContainer,
} from "recharts"

type OrderType = "product" | "membership"
type Dimension = "hour" | "day" | "month" | "year"
type ChartType = "line" | "bar"

interface StatisticsData {
  period: string
  count: number
  amount: number
  paidCount: number
  paidAmount: number
}

interface OrderStatisticsChartProps {
  defaultOrderType?: OrderType
  defaultDimension?: Dimension
  defaultChartType?: ChartType
}

export default function OrderStatisticsChart({
  defaultOrderType = "product",
  defaultDimension = "day",
  defaultChartType = "line",
}: OrderStatisticsChartProps) {
  const [orderType, setOrderType] = useState<OrderType>(defaultOrderType)
  const [dimension, setDimension] = useState<Dimension>(defaultDimension)
  const [chartType, setChartType] = useState<ChartType>(defaultChartType)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [data, setData] = useState<StatisticsData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 初始化日期范围
  useEffect(() => {
    const end = new Date()
    const start = new Date()

    // 根据维度设置默认时间范围
    switch (defaultDimension) {
      case "hour":
        // 最近24小时
        start.setHours(start.getHours() - 24)
        break
      case "day":
        // 最近30天
        start.setDate(start.getDate() - 30)
        break
      case "month":
        // 最近12个月
        start.setMonth(start.getMonth() - 12)
        break
      case "year":
        // 最近5年
        start.setFullYear(start.getFullYear() - 5)
        break
    }

    setStartDate(start.toISOString().split("T")[0])
    setEndDate(end.toISOString().split("T")[0])
  }, [defaultDimension])

  // 加载统计数据
  const loadStatistics = async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        type: orderType,
        dimension,
        startDate,
        endDate,
      })

      const response = await fetch(
        `/api/backendmanager/order-statistics?${params}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "加载统计数据失败")
      }

      const result = await response.json()
      setData(result.data || [])
    } catch (err: any) {
      console.error("加载统计数据失败:", err)
      setError(err.message || "加载统计数据失败")
    } finally {
      setLoading(false)
    }
  }

  // 当参数变化时重新加载数据
  useEffect(() => {
    if (startDate && endDate) {
      loadStatistics()
    }
  }, [orderType, dimension, startDate, endDate])

  // 格式化金额
  const formatAmount = (amount: number) => {
    return `¥${amount.toFixed(2)}`
  }

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-300 rounded shadow-lg">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes("金额") ? formatAmount(entry.value) : entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">订单统计分析</h2>

      {/* 控制面板 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* 订单类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            订单类型
          </label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="product">商品订单</option>
            <option value="membership">会员订单</option>
          </select>
        </div>

        {/* 统计维度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            统计维度
          </label>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value as Dimension)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="hour">按小时</option>
            <option value="day">按日</option>
            <option value="month">按月</option>
            <option value="year">按年</option>
          </select>
        </div>

        {/* 图表类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            图表类型
          </label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="line">折线图</option>
            <option value="bar">柱状图</option>
          </select>
        </div>

        {/* 开始日期 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            开始日期
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 结束日期 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            结束日期
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 维度说明 */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>当前维度说明：</strong>
          {dimension === "hour" && " 按小时统计，适合查看日内流量高峰，有利于制定扩缩容方案"}
          {dimension === "day" && " 按日统计，适合进行数据分析"}
          {dimension === "month" && " 按月统计，适合进行财务统计"}
          {dimension === "year" && " 按年统计，适合进行数据分析"}
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">加载中...</div>
        </div>
      )}

      {/* 无数据提示 */}
      {!loading && !error && data.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">所选时间范围内暂无数据</div>
        </div>
      )}

      {/* 图表 */}
      {!loading && !error && data.length > 0 && (
        <div className="mt-6">
          <ResponsiveContainer width="100%" height={400}>
            {chartType === "line" ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  name="订单数量"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="paidCount"
                  stroke="#82ca9d"
                  name="已支付订单数"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="amount"
                  stroke="#ffc658"
                  name="订单总金额"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="paidAmount"
                  stroke="#ff7c7c"
                  name="已支付金额"
                  strokeWidth={2}
                />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  fill="#8884d8"
                  name="订单数量"
                />
                <Bar
                  yAxisId="left"
                  dataKey="paidCount"
                  fill="#82ca9d"
                  name="已支付订单数"
                />
                <Bar
                  yAxisId="right"
                  dataKey="amount"
                  fill="#ffc658"
                  name="订单总金额"
                />
                <Bar
                  yAxisId="right"
                  dataKey="paidAmount"
                  fill="#ff7c7c"
                  name="已支付金额"
                />
              </BarChart>
            )}
          </ResponsiveContainer>

          {/* 数据统计摘要 */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">总订单数</p>
              <p className="text-2xl font-bold text-blue-600">
                {data.reduce((sum, item) => sum + item.count, 0)}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">已支付订单数</p>
              <p className="text-2xl font-bold text-green-600">
                {data.reduce((sum, item) => sum + item.paidCount, 0)}
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-600">总金额</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatAmount(data.reduce((sum, item) => sum + item.amount, 0))}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600">已支付金额</p>
              <p className="text-2xl font-bold text-red-600">
                {formatAmount(
                  data.reduce((sum, item) => sum + item.paidAmount, 0)
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
