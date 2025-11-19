"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import OrderStatisticsChart from "@/components/OrderStatisticsChart"

export default function OrderStatisticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [hasPermission, setHasPermission] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (status === "authenticated" && session?.user) {
      checkPermission()
    }
  }, [status, session, router])

  const checkPermission = async () => {
    try {
      setLoading(true)

      // 管理员直接通过
      if (session?.user?.role === "ADMIN") {
        setHasPermission(true)
        setLoading(false)
        return
      }

      // 检查是否有订单或会员模块的读权限
      const res = await fetch("/api/auth/permissions")
      const data = await res.json()

      const ordersPermission = data.permissions?.ORDERS || "NONE"
      const membershipsPermission = data.permissions?.MEMBERSHIPS || "NONE"

      // 需要至少有一个模块的读权限
      if (ordersPermission !== "NONE" || membershipsPermission !== "NONE") {
        setHasPermission(true)
      } else {
        setError("权限不足：您没有访问订单统计的权限")
      }
    } catch (err) {
      console.error("检查权限失败:", err)
      setError("检查权限失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  if (error || !hasPermission) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">订单统计分析</h1>
          <p className="text-gray-600">商品订单与会员订单的数据统计与可视化</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-3">权限不足</h2>
            <p className="text-gray-600 text-center max-w-md mb-8">
              {error || "您没有访问订单统计的权限"}
            </p>

            {/* 操作按钮 */}
            <div className="flex gap-4">
              <button
                onClick={() => router.push("/backendmanager")}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                返回后台管理
              </button>
            </div>

            {/* 权限提示 */}
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md">
              <p className="text-sm text-yellow-800">
                <strong>💡 提示：</strong>
                如需访问订单统计，请联系管理员为您开通"订单管理"或"会员管理"模块的读取权限。
              </p>
            </div>
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
        <h1 className="text-3xl font-bold mb-2">订单统计分析</h1>
        <p className="text-gray-600">
          商品订单与会员订单的数据统计与可视化，支持按小时、日、月、年多维度分析
        </p>
      </div>

      {/* 权限说明 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-blue-600 mt-0.5 mr-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              功能说明
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • <strong>按小时统计</strong>
                ：查看日内流量高峰，有利于制定扩缩容方案
              </li>
              <li>
                • <strong>按日统计</strong>：进行详细的数据分析
              </li>
              <li>
                • <strong>按月统计</strong>：适合进行财务统计
              </li>
              <li>
                • <strong>按年统计</strong>：进行长期数据分析
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 图表组件 */}
      <OrderStatisticsChart
        defaultOrderType="product"
        defaultDimension="day"
        defaultChartType="line"
      />
    </div>
  )
}
