"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface MembershipPlan {
  name: string
  price: number
  duration: number
  discount: number
  dailyLimit: number
}

interface Membership {
  id: string
  membershipCode: string
  purchasePrice: number
  endDate: string | null
  planSnapshot: string
}

export default function MembershipPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [membership, setMembership] = useState<Membership | null>(null)
  const [membershipId, setMembershipId] = useState<string | null>(null)
  const [planInfo, setPlanInfo] = useState<MembershipPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string>("")
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    params.then((resolvedParams) => {
      setMembershipId(resolvedParams.id)
    })
  }, [params])

  useEffect(() => {
    if (membershipId) {
      fetchMembership()
    }
  }, [membershipId])

  const fetchMembership = async () => {
    if (!membershipId) return

    try {
      setLoading(true)
      const res = await fetch(`/api/memberships/${membershipId}`)

      if (!res.ok) {
        throw new Error("会员订单不存在")
      }

      const data = await res.json()
      setMembership(data.membership)

      // 解析方案快照
      const plan = JSON.parse(data.membership.planSnapshot)
      setPlanInfo(plan)

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取会员信息失败")
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!selectedMethod) {
      alert("请选择支付方式")
      return
    }

    if (!membership) return

    setProcessing(true)

    try {
      const res = await fetch(`/api/payment/create-membership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membership.id,
          amount: membership.purchasePrice,
          paymentMethod: selectedMethod
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "支付失败")
      }

      const data = await res.json()

      // 根据不同支付方式处理
      if (selectedMethod === "alipay" || selectedMethod === "wechat" || selectedMethod === "paypal") {
        // 所有支付方式统一跳转到支付页面
        if (data.payUrl) {
          window.location.href = data.payUrl
        } else {
          throw new Error("支付链接获取失败")
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "支付失败")
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  if (error || !membership || !planInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "会员订单不存在"}</p>
          <Link href="/membership" className="text-blue-600 hover:underline">
            返回会员购买
          </Link>
        </div>
      </div>
    )
  }

  const formatDuration = (days: number) => {
    if (days === -1) return "终身"
    if (days >= 365) return `${Math.floor(days / 365)}年`
    if (days >= 30) return `${Math.floor(days / 30)}个月`
    return `${days}天`
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">会员支付</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* 会员信息 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">会员信息</h2>

          <div className="mb-4">
            <p className="text-sm text-gray-600">会员类型</p>
            <p className="text-2xl font-bold text-blue-600">{planInfo.name}</p>
          </div>

          <div className="border-t pt-4 mb-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">有效期</span>
              <span className="font-semibold">{formatDuration(planInfo.duration)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">享受折扣</span>
              <span className="font-semibold text-green-600">{(planInfo.discount * 10).toFixed(1)}折</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">每日优惠次数</span>
              <span className="font-semibold">{planInfo.dailyLimit}次</span>
            </div>
          </div>

          <div className="border-t pt-4 mb-4">
            <p className="text-sm text-gray-600 mb-1">您的会员码</p>
            <p className="font-mono font-bold text-lg bg-gray-100 p-3 rounded border-2 border-dashed border-gray-300 text-center">
              {membership.membershipCode}
            </p>
            <p className="text-xs text-orange-600 mt-2">⚠️ 请妥善保管此会员码，支付成功后凭此码享受会员权益</p>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">支付金额</span>
              <span className="text-2xl font-bold text-red-600">
                ¥{membership.purchasePrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* 支付方式选择 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">选择支付方式</h2>

          <div className="space-y-3">
            {/* 支付宝 */}
            <div
              onClick={() => setSelectedMethod("alipay")}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedMethod === "alipay"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500 rounded flex items-center justify-center text-white font-bold">
                    支
                  </div>
                  <div>
                    <p className="font-semibold">支付宝</p>
                    <p className="text-xs text-gray-600">推荐使用</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 ${
                  selectedMethod === "alipay"
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-300"
                }`}>
                  {selectedMethod === "alipay" && (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 微信支付 */}
            <div
              onClick={() => setSelectedMethod("wechat")}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedMethod === "wechat"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-green-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500 rounded flex items-center justify-center text-white font-bold">
                    微
                  </div>
                  <div>
                    <p className="font-semibold">微信支付</p>
                    <p className="text-xs text-gray-600">扫码支付</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 ${
                  selectedMethod === "wechat"
                    ? "border-green-500 bg-green-500"
                    : "border-gray-300"
                }`}>
                  {selectedMethod === "wechat" && (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PayPal */}
            <div
              onClick={() => setSelectedMethod("paypal")}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedMethod === "paypal"
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-gray-200 hover:border-yellow-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-500 rounded flex items-center justify-center text-white font-bold">
                    P
                  </div>
                  <div>
                    <p className="font-semibold">PayPal</p>
                    <p className="text-xs text-gray-600">国际支付</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 ${
                  selectedMethod === "paypal"
                    ? "border-yellow-500 bg-yellow-500"
                    : "border-gray-300"
                }`}>
                  {selectedMethod === "paypal" && (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 支付按钮 */}
          <button
            onClick={handlePayment}
            disabled={!selectedMethod || processing}
            className="w-full mt-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? "处理中..." : `确认支付 ¥${membership.purchasePrice.toFixed(2)}`}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            点击支付即表示同意相关服务协议
          </p>
        </div>
      </div>

      {/* 温馨提示 */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-yellow-800">温馨提示</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 请妥善保管会员码：<span className="font-mono font-bold">{membership.membershipCode}</span></li>
          <li>• 支付完成后，使用此会员码即可享受{(planInfo.discount * 10).toFixed(1)}折优惠</li>
          <li>• 每日可享受优惠次数：{planInfo.dailyLimit}次</li>
          <li>• 有效期至：{membership.endDate ? new Date(membership.endDate).toLocaleDateString('zh-CN') : '永久有效'}</li>
        </ul>
      </div>
    </div>
  )
}
