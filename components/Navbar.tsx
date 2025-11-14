"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function Navbar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

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
            </div>
          </div>
          <div className="flex items-center space-x-4">
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
          </div>
        </div>
      </div>
    </nav>
  )
}
