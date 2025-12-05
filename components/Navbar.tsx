"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import { useCart } from "@/hooks/useCart"

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { itemCount } = useCart()
  const [permissions, setPermissions] = useState<Record<string, string>>({})
  const [isAnimating, setIsAnimating] = useState(false)

  const isActive = (path: string) => pathname === path

  // 获取用户权限
  useEffect(() => {
    if (session?.user) {
      fetch('/api/auth/permissions')
        .then(res => res.json())
        .then(data => setPermissions(data.permissions || {}))
        .catch(err => console.error('获取权限失败:', err))
    }
  }, [session])

  // 购物车数量变化时触发动画
  useEffect(() => {
    if (itemCount > 0) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 300)
      return () => clearTimeout(timer)
    }
  }, [itemCount])

  // 检查是否有读或写权限
  const hasPermission = (module: string) => {
    const level = permissions[module]
    return level === 'READ' || level === 'WRITE'
  }

  // 检查用户是否有任何后台管理权限
  const hasAnyPermission = () => {
    // 管理员始终有权限
    if (session?.user?.role === 'ADMIN') return true
    // 检查是否至少有一个模块的权限
    return Object.values(permissions).some(level => level === 'READ' || level === 'WRITE')
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-blue-600">
              知识付费平台
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link
                href="/products"
                className={isActive("/products") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
              >
                商品列表
              </Link>
              <Link
                href="/cart"
                className={`${isActive("/cart") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"} relative`}
              >
                购物车
                {itemCount > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center transition-transform ${
                      isAnimating ? 'animate-bounce' : ''
                    }`}
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>
              <Link
                href="/membership"
                className={isActive("/membership") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
              >
                购买会员
              </Link>
              <Link
                href="/membership-orders"
                className={isActive("/membership-orders") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
              >
                会员订单
              </Link>
              <Link
                href="/my-orders"
                className={isActive("/my-orders") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
              >
                我的订单
              </Link>
              <Link
                href="/distribution"
                className={`${isActive("/distribution") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"} relative`}
              >
                <span className="flex items-center gap-1">
                  💰 推广赚钱
                  <span className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white px-1.5 py-0.5 rounded-full">HOT</span>
                </span>
              </Link>
              {hasAnyPermission() && (
                <Link
                  href="/backendmanager"
                  className={isActive("/backendmanager") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
                >
                  后台管理
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {session?.user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 focus:outline-none"
                >
                  <span>{session.user.email || session.user.name || "用户"}</span>
                  {session.user.role === "ADMIN" && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">管理员</span>
                  )}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border">
                    <div className="px-4 py-2 text-sm text-gray-500 border-b">
                      {session.user.email}
                    </div>
                    <Link
                      href="/distribution"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      💰 我的推广
                    </Link>
                    {(session.user.role === "ADMIN" || hasPermission('SYSTEM_SETTINGS')) && (
                      <>
                        <hr className="my-1" />
                        <Link
                          href="/backendmanager/settings"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          系统设置
                        </Link>
                      </>
                    )}
                    <hr className="my-1" />
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
