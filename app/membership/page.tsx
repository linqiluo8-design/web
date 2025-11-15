"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface MembershipPlan {
  id: string
  name: string
  price: number
  duration: number
  discount: number
  dailyLimit: number
}

export default function MembershipPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/membership-plans")
      if (res.ok) {
        const data = await res.json()
        setPlans(data.plans)
      }
    } catch (err) {
      console.error("获取会员方案失败:", err)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (planId: string) => {
    try {
      setPurchasing(planId)

      const res = await fetch("/api/memberships/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "购买失败")
      }

      // 跳转到支付页面
      router.push(data.redirectUrl)
    } catch (err) {
      alert(err instanceof Error ? err.message : "购买失败，请重试")
      setPurchasing(null)
    }
  }

  const getDurationDisplay = (duration: number) => {
    if (duration === -1) return "终身有效"
    if (duration >= 365) return `${Math.floor(duration / 365)}年`
    return `${duration}天`
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">选择适合您的会员方案</h1>
          <p className="text-gray-600 text-lg">
            享受专属折扣，购买知识产品更优惠
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all hover:scale-105 ${
                index === 1 ? "border-4 border-blue-500" : "border border-gray-200"
              }`}
            >
              {index === 1 && (
                <div className="bg-blue-500 text-white text-center py-2 text-sm font-semibold">
                  🌟 推荐方案
                </div>
              )}

              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-5xl font-bold">¥{plan.price}</span>
                  <span className="text-gray-500 ml-2">
                    / {getDurationDisplay(plan.duration)}
                  </span>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">
                      商品享<span className="font-bold text-blue-600">{(plan.discount * 10).toFixed(1)}折</span>优惠
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">
                      每天最多<span className="font-bold">{plan.dailyLimit}个</span>课程享折扣
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">超出限制，按原价购买</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">匿名购买，保护隐私</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">获得专属会员码</span>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(plan.id)}
                  disabled={purchasing === plan.id}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    index === 1
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-800 text-white hover:bg-gray-900"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {purchasing === plan.id ? "处理中..." : "立即购买"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="bg-gray-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">常见问题</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">💳 如何使用会员折扣？</h3>
              <p className="text-gray-600">
                购买会员后，您会获得一个唯一的会员码。在购买商品时输入会员码，即可享受折扣。
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">📊 每日限制如何计算？</h3>
              <p className="text-gray-600">
                每天0点重置使用次数。例如"每天10个课程"表示每天可以用会员价购买最多10个课程，超出后按原价购买。
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">🔐 会员码安全吗？</h3>
              <p className="text-gray-600">
                会员码是不可逆的唯一哈希值，请妥善保管。如果丢失，无法找回，请联系客服处理。
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">⏰ 已购会员是否受新配置影响？</h3>
              <p className="text-gray-600">
                不受影响！您购买时的折扣率和每日限制将永久保留，不受后续方案调整影响。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
