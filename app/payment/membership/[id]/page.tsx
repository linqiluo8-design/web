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

  // 支付方式配置
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<Record<string, boolean>>({
    alipay: true,
    wechat: true,
    paypal: true,
  })

  useEffect(() => {
    params.then((resolvedParams) => {
      setMembershipId(resolvedParams.id)
    })
  }, [params])

  useEffect(() => {
    if (membershipId) {
      fetchMembership()
      loadPaymentConfig()
    }
  }, [membershipId])

  const loadPaymentConfig = async () => {
    try {
      const res = await fetch("/api/system-config?keys=payment_alipay_enabled,payment_wechat_enabled,payment_paypal_enabled")
      if (res.ok) {
        const config = await res.json()
        setEnabledPaymentMethods({
          alipay: config.payment_alipay_enabled !== false,
          wechat: config.payment_wechat_enabled !== false,
          paypal: config.payment_paypal_enabled !== false,
        })
      }
    } catch (error) {
      console.error("加载支付配置失败:", error)
      // 如果加载失败，默认全部启用
    }
  }

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
            {/* 检查是否有启用的支付方式 */}
            {!enabledPaymentMethods.alipay && !enabledPaymentMethods.wechat && !enabledPaymentMethods.paypal ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-2">当前没有可用的支付方式</p>
                <p className="text-sm text-gray-500">请联系管理员</p>
              </div>
            ) : (
              <>
                {/* 支付宝 */}
                {enabledPaymentMethods.alipay && (
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
                )}

                {/* 微信支付 */}
                {enabledPaymentMethods.wechat && (
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
                )}

                {/* PayPal */}
                {enabledPaymentMethods.paypal && (
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
                )}
              </>
            )}
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
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-900 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          支付说明
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 完成支付后，您将获得专属会员码</li>
          <li>• 使用会员码即可享受{(planInfo.discount * 10).toFixed(1)}折优惠</li>
          <li>• 每日可享受优惠次数：{planInfo.dailyLimit}次</li>
          <li>• 有效期至：{membership.endDate ? new Date(membership.endDate).toLocaleDateString('zh-CN') : '永久有效'}</li>
          <li>• 会员码将在支付成功页面显示，请妥善保管</li>
        </ul>
      </div>
    </div>
  )
}
