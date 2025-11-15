"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function MembershipSuccessPage() {
  const searchParams = useSearchParams()
  const [membershipCode, setMembershipCode] = useState<string>("")
  const [amount, setAmount] = useState<string>("")

  useEffect(() => {
    const code = searchParams.get("code")
    const amt = searchParams.get("amount")
    if (code) setMembershipCode(code)
    if (amt) setAmount(amt)
  }, [searchParams])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(membershipCode)
    alert("会员码已复制到剪贴板！")
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        {/* 成功图标 */}
        <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-6 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold mb-4 text-gray-800">
          会员购买成功！
        </h1>

        <p className="text-gray-600 mb-8">
          恭喜您成为尊贵会员，支付金额：¥{amount}
        </p>

        {/* 会员码显示 */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <p className="text-sm text-gray-600 mb-2">您的专属会员码</p>
          <div className="flex items-center justify-center gap-3">
            <p className="font-mono text-2xl font-bold text-blue-600">
              {membershipCode}
            </p>
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
              title="复制会员码"
            >
              📋 复制
            </button>
          </div>
          <p className="text-xs text-orange-600 mt-3">
            ⚠️ 请务必保存此会员码！购买商品时输入可享受会员折扣
          </p>
        </div>

        {/* 使用说明 */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
          <h3 className="font-semibold mb-3 text-gray-800">如何使用会员权益：</h3>
          <ol className="text-sm text-gray-700 space-y-2">
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>浏览商品并添加到购物车</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <span>在购物车页面输入您的会员码</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <span>系统自动计算折扣价格</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">4.</span>
              <span>完成支付即可享受会员优惠</span>
            </li>
          </ol>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/products"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            立即购物
          </Link>
          <Link
            href="/membership"
            className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-blue-600 hover:text-blue-600 transition-colors"
          >
            查看会员方案
          </Link>
        </div>

        {/* 联系客服 */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            如有任何问题，请联系客服：
            <a href="mailto:support@example.com" className="text-blue-600 hover:underline ml-1">
              support@example.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
