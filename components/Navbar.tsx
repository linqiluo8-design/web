"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState } from "react"
import { useCart } from "@/hooks/useCart"

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { itemCount } = useCart()

  const isActive = (path: string) => pathname === path

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
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {itemCount}
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
              {session?.user?.role === "ADMIN" && (
                <>
                  <Link
                    href="/backendmanager"
                    className={isActive("/backendmanager") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
                  >
                    后台管理
                  </Link>
                  <Link
                    href="/order-lookup"
                    className={isActive("/order-lookup") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
                  >
                    订单查询
                  </Link>
                  <Link
                    href="/backendmanager/users"
                    className={isActive("/backendmanager/users") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
                  >
                    用户管理
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {session?.user?.role === "ADMIN" && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 focus:outline-none"
                >
                  <span>管理员</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border">
                    <Link
                      href="/backendmanager/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      系统设置
                    </Link>
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
