"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface MenuConfig {
  products: boolean
  cart: boolean
  membership: boolean
  membershipOrders: boolean
  myOrders: boolean
  distribution: boolean
}

// 菜单项配置
const MENU_ITEMS = [
  {
    key: "products" as keyof MenuConfig,
    name: "商品列表",
    description: "用户可以浏览和购买商品",
    icon: "🛍️",
    routes: ["/products", "/products/*"]
  },
  {
    key: "cart" as keyof MenuConfig,
    name: "购物车",
    description: "用户可以管理购物车商品",
    icon: "🛒",
    routes: ["/cart"]
  },
  {
    key: "membership" as keyof MenuConfig,
    name: "购买会员",
    description: "用户可以购买会员套餐",
    icon: "💳",
    routes: ["/membership"]
  },
  {
    key: "membershipOrders" as keyof MenuConfig,
    name: "会员订单",
    description: "用户可以查看会员订单",
    icon: "📋",
    routes: ["/membership-orders"]
  },
  {
    key: "myOrders" as keyof MenuConfig,
    name: "我的订单",
    description: "用户可以查看商品订单",
    icon: "📦",
    routes: ["/my-orders"]
  },
  {
    key: "distribution" as keyof MenuConfig,
    name: "推广赚钱",
    description: "用户可以申请成为分销商并推广商品",
    icon: "💰",
    routes: ["/distribution", "/distribution/*"]
  }
]

export default function MenuSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [menuConfig, setMenuConfig] = useState<MenuConfig>({
    products: true,
    cart: true,
    membership: true,
    membershipOrders: true,
    myOrders: true,
    distribution: true
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (status === "authenticated") {
      if (session?.user?.role !== "ADMIN") {
        router.push("/")
        return
      }
      fetchMenuConfig()
    }
  }, [status, session, router])

  const fetchMenuConfig = async () => {
    try {
      const response = await fetch("/api/backendmanager/menu-settings")
      if (!response.ok) throw new Error("获取配置失败")

      const data = await response.json()
      if (data.success) {
        setMenuConfig(data.config)
      }
    } catch (error) {
      console.error("获取菜单配置失败:", error)
      alert("获取配置失败，请刷新页面重试")
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (menuKey: keyof MenuConfig) => {
    const newValue = !menuConfig[menuKey]

    // 乐观更新 UI
    setMenuConfig(prev => ({
      ...prev,
      [menuKey]: newValue
    }))

    try {
      setSaving(true)
      const response = await fetch("/api/backendmanager/menu-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuKey,
          enabled: newValue
        })
      })

      if (!response.ok) throw new Error("更新失败")

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "更新失败")
      }
    } catch (error) {
      console.error("更新菜单配置失败:", error)
      alert("更新失败，请重试")
      // 回滚更新
      setMenuConfig(prev => ({
        ...prev,
        [menuKey]: !newValue
      }))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* 页面头部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">菜单管理</h1>
        <p className="text-gray-600">
          控制前端导航栏菜单的显示/隐藏，关闭菜单后前端入口和后端接口将同步禁用
        </p>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium mb-1">总菜单项</p>
              <p className="text-3xl font-bold text-blue-900">{MENU_ITEMS.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl">
              📋
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium mb-1">已启用</p>
              <p className="text-3xl font-bold text-green-900">
                {Object.values(menuConfig).filter(v => v).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl">
              ✅
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium mb-1">已禁用</p>
              <p className="text-3xl font-bold text-red-900">
                {Object.values(menuConfig).filter(v => !v).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl">
              🚫
            </div>
          </div>
        </div>
      </div>

      {/* 菜单项列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">菜单项配置</h2>
          <p className="text-sm text-gray-600 mt-1">
            点击开关可以启用/禁用对应的菜单项
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {MENU_ITEMS.map((item) => {
            const isEnabled = menuConfig[item.key]

            return (
              <div
                key={item.key}
                className={`p-6 transition-all ${
                  isEnabled ? "bg-white" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* 图标 */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                      isEnabled
                        ? "bg-blue-100"
                        : "bg-gray-200"
                    }`}>
                      {item.icon}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {item.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isEnabled
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {isEnabled ? "已启用" : "已禁用"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>影响路由:</span>
                        {item.routes.map((route, idx) => (
                          <code
                            key={idx}
                            className="px-2 py-1 bg-gray-100 rounded font-mono"
                          >
                            {route}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 开关 */}
                  <button
                    onClick={() => handleToggle(item.key)}
                    disabled={saving}
                    className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isEnabled ? "bg-blue-600" : "bg-gray-300"
                    }`}
                    role="switch"
                    aria-checked={isEnabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* 禁用警告 */}
                {!isEnabled && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm text-yellow-800 font-medium">
                          该菜单已禁用
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          用户将无法通过导航栏访问此功能，相关 API 接口也将拒绝访问
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          使用说明
        </h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span><strong>启用菜单</strong>：用户可以在导航栏看到该菜单项，可以正常访问相关页面和 API</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span><strong>禁用菜单</strong>：菜单项从导航栏隐藏，用户直接访问 URL 时会被拦截并提示功能未开放</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span><strong>实时生效</strong>：配置修改后立即生效，无需重启服务器，用户刷新页面即可看到变化</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span><strong>权限优先</strong>：管理员不受此限制影响，始终可以访问所有功能</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
