"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { saveOrderToLocal } from "@/app/my-orders/page"

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const [orderNumber, setOrderNumber] = useState<string>("")

  useEffect(() => {
    const number = searchParams.get("orderNumber")
    const amount = searchParams.get("amount")
    if (number) {
      setOrderNumber(number)
      // 保存到"我的订单"
      saveOrderToLocal(number, parseFloat(amount || "0"))
    }
  }, [searchParams])

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
        {/* 成功图标 */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-4 text-gray-800">支付成功！</h1>

        <p className="text-gray-600 mb-6">
          感谢您的购买，订单已成功支付
        </p>

        {orderNumber && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">您的订单号</p>
            <p className="font-mono font-bold text-lg text-gray-900">{orderNumber}</p>
            <p className="text-xs text-gray-500 mt-2">请妥善保管订单号，可用于查询订单</p>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/my-orders"
            className="block w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            查看我的订单
          </Link>

          <Link
            href="/products"
            className="block w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            继续购物
          </Link>
        </div>
      </div>
    </div>
  )
}
