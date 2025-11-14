"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState } from "react"

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [showUserMenu, setShowUserMenu] = useState(false)

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
                className={isActive("/cart") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
              >
                购物车
              </Link>
              <Link
                href="/orders"
                className={isActive("/orders") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
              >
                我的订单
              </Link>
              {session?.user?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className={isActive("/admin") ? "px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50" : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"}
                >
                  后台管理
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {status === "loading" ? (
              <div className="text-sm text-gray-500">加载中...</div>
            ) : session ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 focus:outline-none"
                >
                  <span>{session.user?.name || session.user?.email}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border">
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      个人中心
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  登录
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
