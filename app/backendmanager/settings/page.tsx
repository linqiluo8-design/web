"use client"

import { useState, useEffect } from "react"

interface SystemConfig {
  key: string
  value: string
  type: string
  category: string
  description: string | null
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Record<string, boolean>>({
    banner_enabled: true,
    payment_alipay_enabled: true,
    payment_wechat_enabled: true,
    payment_paypal_enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const res = await fetch("/api/backendmanager/system-config")
      if (res.ok) {
        const data = await res.json()
        const configMap: Record<string, boolean> = {}
        data.configs.forEach((config: SystemConfig) => {
          configMap[config.key] = config.value === "true"
        })
        setConfigs((prev) => ({ ...prev, ...configMap }))
      }
    } catch (error) {
      console.error("加载配置失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfigs = async () => {
    setSaving(true)
    try {
      const configsArray = Object.entries(configs).map(([key, value]) => {
        let category = "general"
        if (key.startsWith("banner")) category = "banner"
        if (key.startsWith("payment")) category = "payment"

        return {
          key,
          value: value.toString(),
          type: "boolean",
          category,
          description: getDescription(key),
        }
      })

      const res = await fetch("/api/backendmanager/system-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: configsArray })
      })

      if (res.ok) {
        alert("配置保存成功")
      } else {
        const error = await res.json()
        alert(`保存失败: ${error.error}`)
      }
    } catch (error) {
      alert("保存失败，请重试")
      console.error("保存配置失败:", error)
    } finally {
      setSaving(false)
    }
  }

  const getDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      banner_enabled: "是否启用首页轮播图功能",
      payment_alipay_enabled: "是否启用支付宝支付方式",
      payment_wechat_enabled: "是否启用微信支付方式",
      payment_paypal_enabled: "是否启用PayPal支付方式",
    }
    return descriptions[key] || ""
  }

  const toggleConfig = (key: string) => {
    setConfigs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">系统设置</h1>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        {/* 轮播图设置 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">轮播图设置</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">首页轮播图</h3>
                <p className="text-sm text-gray-600">控制首页是否显示轮播图</p>
              </div>
              <button
                onClick={() => toggleConfig("banner_enabled")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  configs.banner_enabled ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    configs.banner_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              提示：轮播图内容请在"轮播图管理"中添加和编辑
            </p>
          </div>
        </div>

        {/* 支付方式设置 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">支付方式设置</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">支付宝支付</h3>
                <p className="text-sm text-gray-600">允许用户使用支付宝付款</p>
              </div>
              <button
                onClick={() => toggleConfig("payment_alipay_enabled")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  configs.payment_alipay_enabled ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    configs.payment_alipay_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">微信支付</h3>
                <p className="text-sm text-gray-600">允许用户使用微信付款</p>
              </div>
              <button
                onClick={() => toggleConfig("payment_wechat_enabled")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  configs.payment_wechat_enabled ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    configs.payment_wechat_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">PayPal支付</h3>
                <p className="text-sm text-gray-600">允许用户使用PayPal付款</p>
              </div>
              <button
                onClick={() => toggleConfig("payment_paypal_enabled")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  configs.payment_paypal_enabled ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    configs.payment_paypal_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              提示：至少要保留一种支付方式启用状态
            </p>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end gap-3">
          <button
            onClick={loadConfigs}
            disabled={saving}
            className="px-6 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            重置
          </button>
          <button
            onClick={saveConfigs}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  )
}
