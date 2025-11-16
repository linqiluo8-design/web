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
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setError(null)
      const res = await fetch("/api/backendmanager/system-config")

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "加载配置失败")
      }

      const data = await res.json()
      console.log("加载的配置:", data)

      if (data.configs && data.configs.length > 0) {
        const configMap: Record<string, boolean> = {}
        data.configs.forEach((config: SystemConfig) => {
          configMap[config.key] = config.value === "true"
        })
        setConfigs((prev) => ({ ...prev, ...configMap }))
      }
      // 如果没有配置，使用默认值
    } catch (error: any) {
      console.error("加载配置失败:", error)
      setError(error.message || "加载配置失败")
    } finally {
      setLoading(false)
    }
  }

  const saveConfigs = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

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

      console.log("保存的配置:", configsArray)

      const res = await fetch("/api/backendmanager/system-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: configsArray })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "保存失败")
      }

      const data = await res.json()
      console.log("保存结果:", data)

      setSuccessMessage("配置保存成功！")
      // 3秒后清除成功消息
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error: any) {
      console.error("保存配置失败:", error)
      setError(error.message || "保存失败，请重试")
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
    setSuccessMessage(null) // 清除之前的成功消息
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">系统设置</h1>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* 成功提示 */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-green-800">{successMessage}</span>
          </div>
        </div>
      )}

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
                aria-label="切换轮播图开关"
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
                aria-label="切换支付宝支付开关"
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
                aria-label="切换微信支付开关"
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
                aria-label="切换PayPal支付开关"
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

        {/* 当前配置状态显示 */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">当前配置状态：</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">轮播图：</span>
              <span className={configs.banner_enabled ? "text-green-600 font-medium" : "text-gray-400"}>
                {configs.banner_enabled ? "已启用" : "已禁用"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">支付宝：</span>
              <span className={configs.payment_alipay_enabled ? "text-green-600 font-medium" : "text-gray-400"}>
                {configs.payment_alipay_enabled ? "已启用" : "已禁用"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">微信支付：</span>
              <span className={configs.payment_wechat_enabled ? "text-green-600 font-medium" : "text-gray-400"}>
                {configs.payment_wechat_enabled ? "已启用" : "已禁用"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">PayPal：</span>
              <span className={configs.payment_paypal_enabled ? "text-green-600 font-medium" : "text-gray-400"}>
                {configs.payment_paypal_enabled ? "已启用" : "已禁用"}
              </span>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end gap-3">
          <button
            onClick={loadConfigs}
            disabled={saving}
            className="px-6 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            重置
          </button>
          <button
            onClick={saveConfigs}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  )
}
