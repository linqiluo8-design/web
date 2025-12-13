"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function BackendManagerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [permissions, setPermissions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // 获取用户权限
  useEffect(() => {
    if (session?.user) {
      fetch('/api/auth/permissions')
        .then(res => res.json())
        .then(data => {
          setPermissions(data.permissions || {})
          setLoading(false)
        })
        .catch(err => {
          console.error('获取权限失败:', err)
          setLoading(false)
        })
    }
  }, [session])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    // 普通用户需要检查是否有任何权限
    if (status === "authenticated" && session?.user?.role !== "ADMIN" && Object.keys(permissions).length > 0) {
      const hasAnyPermission = Object.values(permissions).some(
        level => level === 'READ' || level === 'WRITE'
      )

      if (!hasAnyPermission) {
        // 没有任何权限，重定向回首页
        router.push("/")
      }
    }
  }, [status, session, router, permissions])

  // 检查是否有读或写权限
  const hasPermission = (module: string) => {
    // ADMIN拥有所有权限
    if (session?.user?.role === 'ADMIN') {
      return true
    }
    const level = permissions[module]
    return level === 'READ' || level === 'WRITE'
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">后台管理</h1>
        <p className="text-gray-600">选择您要管理的模块</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hasPermission('PRODUCTS') && (
          <Link
            href="/backendmanager/products"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 hover:border-blue-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📦</span>
              <h2 className="text-xl font-bold">商品管理</h2>
            </div>
            <p className="text-gray-600 text-sm">管理商品信息、价格、分类等</p>
          </Link>
        )}

        {hasPermission('CATEGORIES') && (
          <Link
            href="/backendmanager/categories"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 hover:border-blue-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🏷️</span>
              <h2 className="text-xl font-bold">分类管理</h2>
            </div>
            <p className="text-gray-600 text-sm">管理商品分类和标签</p>
          </Link>
        )}

        {hasPermission('MEMBERSHIPS') && (
          <Link
            href="/backendmanager/memberships"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 hover:border-blue-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">💳</span>
              <h2 className="text-xl font-bold">会员方案管理</h2>
            </div>
            <p className="text-gray-600 text-sm">管理会员套餐和权益</p>
          </Link>
        )}

        {hasPermission('MEMBERSHIPS') && (
          <Link
            href="/backendmanager/membership-records"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 hover:border-blue-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📋</span>
              <h2 className="text-xl font-bold">会员购买记录</h2>
            </div>
            <p className="text-gray-600 text-sm">查看会员购买历史和统计</p>
          </Link>
        )}

        {hasPermission('ORDERS') && (
          <Link
            href="/backendmanager/orders"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 hover:border-blue-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📊</span>
              <h2 className="text-xl font-bold">订单数据管理</h2>
            </div>
            <p className="text-gray-600 text-sm">查看和导出订单数据</p>
          </Link>
        )}

        {(hasPermission('ORDERS') || hasPermission('MEMBERSHIPS')) && (
          <Link
            href="/backendmanager/order-statistics"
            className="block p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-purple-200 hover:border-purple-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📈</span>
              <h2 className="text-xl font-bold text-purple-900">订单统计分析</h2>
            </div>
            <p className="text-purple-700 text-sm">多维度订单统计图表（按小时/日/月/年）</p>
          </Link>
        )}

        {hasPermission('ANALYTICS') && (
          <Link
            href="/backendmanager/analytics"
            className="block p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-blue-200 hover:border-blue-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📈</span>
              <h2 className="text-xl font-bold text-blue-900">浏览量统计</h2>
            </div>
            <p className="text-blue-700 text-sm">查看网站访问数据和分析</p>
          </Link>
        )}

        {hasPermission('BANNERS') && (
          <Link
            href="/backendmanager/banners"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 hover:border-blue-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🖼️</span>
              <h2 className="text-xl font-bold">轮播图管理</h2>
            </div>
            <p className="text-gray-600 text-sm">管理首页轮播图和横幅</p>
          </Link>
        )}

        {hasPermission('USER_MANAGEMENT') && (
          <Link
            href="/backendmanager/users"
            className="block p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-indigo-200 hover:border-indigo-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">👥</span>
              <h2 className="text-xl font-bold text-indigo-900">用户管理</h2>
            </div>
            <p className="text-indigo-700 text-sm">管理用户账号和权限</p>
          </Link>
        )}

        {hasPermission('ORDER_LOOKUP') && (
          <Link
            href="/order-lookup"
            className="block p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-orange-200 hover:border-orange-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔍</span>
              <h2 className="text-xl font-bold text-orange-900">订单查询</h2>
            </div>
            <p className="text-orange-700 text-sm">快速查找订单信息</p>
          </Link>
        )}

        {hasPermission('SYSTEM_SETTINGS') && (
          <Link
            href="/backendmanager/settings"
            className="block p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-purple-200 hover:border-purple-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚙️</span>
              <h2 className="text-xl font-bold text-purple-900">系统设置</h2>
            </div>
            <p className="text-purple-700 text-sm">配置系统参数和选项</p>
          </Link>
        )}

        {(session?.user?.role === 'ADMIN' || hasPermission('SYSTEM_SETTINGS')) && (
          <Link
            href="/backendmanager/menu-settings"
            className="block p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-indigo-200 hover:border-indigo-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🎛️</span>
              <h2 className="text-xl font-bold text-indigo-900">菜单管理</h2>
            </div>
            <p className="text-indigo-700 text-sm">控制导航栏菜单的显示/隐藏</p>
          </Link>
        )}

        {hasPermission('SECURITY_ALERTS') && (
          <Link
            href="/backendmanager/security-alerts"
            className="block p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-red-200 hover:border-red-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔒</span>
              <h2 className="text-xl font-bold text-red-900">安全警报</h2>
            </div>
            <p className="text-red-700 text-sm">查看和处理安全警报</p>
          </Link>
        )}

        {hasPermission('SYSTEM_LOGS') && (
          <Link
            href="/backendmanager/logs"
            className="block p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-300 hover:border-gray-600"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📝</span>
              <h2 className="text-xl font-bold text-gray-900">系统日志</h2>
            </div>
            <p className="text-gray-700 text-sm">查看和导出系统运行日志（支持实时查看、历史查看、精确到秒级筛选）</p>
          </Link>
        )}

        {hasPermission('CUSTOMER_CHAT') && (
          <Link
            href="/backendmanager/chat"
            className="block p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-green-200 hover:border-green-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">💬</span>
              <h2 className="text-xl font-bold text-green-900">客服聊天</h2>
            </div>
            <p className="text-green-700 text-sm">处理客户消息和咨询</p>
          </Link>
        )}

        {hasPermission('DISTRIBUTION') && (
          <Link
            href="/backendmanager/distribution"
            className="block p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow hover:shadow-lg transition-shadow border border-yellow-200 hover:border-yellow-500"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">💰</span>
              <h2 className="text-xl font-bold text-yellow-900">分销管理</h2>
            </div>
            <p className="text-yellow-700 text-sm">审核分销商申请、管理佣金和提现</p>
          </Link>
        )}
      </div>

      {/* 如果没有任何可访问的模块 */}
      {!hasPermission('PRODUCTS') &&
       !hasPermission('CATEGORIES') &&
       !hasPermission('MEMBERSHIPS') &&
       !hasPermission('ORDERS') &&
       !hasPermission('ANALYTICS') &&
       !hasPermission('BANNERS') &&
       !hasPermission('USER_MANAGEMENT') &&
       !hasPermission('ORDER_LOOKUP') &&
       !hasPermission('SYSTEM_SETTINGS') &&
       !hasPermission('SECURITY_ALERTS') &&
       !hasPermission('CUSTOMER_CHAT') &&
       !hasPermission('DISTRIBUTION') &&
       session?.user?.role !== 'ADMIN' && (
        <div className="text-center py-12">
          <p className="text-gray-600">您还没有任何管理权限</p>
          <Link href="/" className="text-blue-600 hover:underline mt-2 inline-block">
            返回首页
          </Link>
        </div>
      )}
    </div>
  )
}
