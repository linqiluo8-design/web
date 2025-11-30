"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Config {
  key: string
  value: string
  type: string
  category: string
  description: string
}

export default function WithdrawalConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)

  // 配置值状态
  const [configValues, setConfigValues] = useState<{ [key: string]: string }>({})

  // 检查权限
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (session?.user) {
      fetch('/api/auth/permissions')
        .then(res => res.json())
        .then(data => {
          const permissions = data.permissions || {}
          const level = permissions['DISTRIBUTION']
          const hasAccess = data.role === 'ADMIN' || level === 'WRITE'

          setHasPermission(hasAccess)
          setPermissionChecked(true)

          if (!hasAccess) {
            router.push("/")
          } else {
            fetchConfigs()
          }
        })
        .catch(err => {
          console.error('权限检查失败:', err)
          setPermissionChecked(true)
          router.push("/")
        })
    }
  }, [status, session, router])

  // 获取配置
  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/backendmanager/withdrawal-config')
      if (!response.ok) throw new Error("获取配置失败")

      const data = await response.json()
      setConfigs(data.all)

      // 初始化配置值
      const values: { [key: string]: string } = {}
      data.all.forEach((config: Config) => {
        values[config.key] = config.value
      })
      setConfigValues(values)
    } catch (error) {
      console.error("获取配置失败:", error)
      alert("获取配置失败，请刷新重试")
    } finally {
      setLoading(false)
    }
  }

  // 保存配置
  const handleSave = async () => {
    setSaving(true)
    try {
      const updatedConfigs = configs.map(config => ({
        key: config.key,
        value: configValues[config.key],
        type: config.type
      }))

      const response = await fetch('/api/backendmanager/withdrawal-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: updatedConfigs })
      })

      const data = await response.json()

      if (response.ok) {
        alert("配置保存成功")
        fetchConfigs()
      } else {
        alert(data.error || "保存失败")
      }
    } catch (error) {
      console.error("保存配置失败:", error)
      alert("保存失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  // 更新配置值
  const updateConfig = (key: string, value: string) => {
    setConfigValues(prev => ({ ...prev, [key]: value }))
  }

  // 渲染配置项
  const renderConfigInput = (config: Config) => {
    const value = configValues[config.key] || ''

    if (config.type === 'boolean') {
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => updateConfig(config.key, e.target.checked ? 'true' : 'false')}
            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="ml-3 text-sm text-gray-600">
            {value === 'true' ? '已启用' : '已禁用'}
          </span>
        </div>
      )
    }

    if (config.type === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => updateConfig(config.key, e.target.value)}
          step={config.key.includes('rate') ? '0.01' : '1'}
          min="0"
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => updateConfig(config.key, e.target.value)}
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    )
  }

  // 分组配置
  const basicConfigs = configs.filter(c =>
    c.category === 'withdrawal' &&
    !c.key.includes('risk') &&
    !c.key.includes('weight') &&
    !c.key.includes('threshold')
  )

  const autoApprovalConfigs = configs.filter(c =>
    c.category === 'withdrawal' &&
    c.key.includes('auto')
  )

  const limitConfigs = configs.filter(c =>
    c.category === 'withdrawal' &&
    (c.key.includes('limit') || c.key.includes('stable'))
  )

  const riskWeightConfigs = configs.filter(c =>
    c.key.includes('weight')
  )

  const riskThresholdConfigs = configs.filter(c =>
    c.key.includes('threshold')
  )

  if (!permissionChecked || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  if (!hasPermission) {
    return null
  }

  // 计算当前配置摘要
  const autoApproveEnabled = configValues['withdrawal_auto_approve'] === 'true'
  const maxAutoAmount = parseFloat(configValues['withdrawal_auto_max_amount'] || '0')
  const feeRate = parseFloat(configValues['withdrawal_fee_rate'] || '0') * 100
  const dailyLimit = configValues['withdrawal_daily_count_limit']
  const dailyAmountLimit = configValues['withdrawal_daily_amount_limit']

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="mb-8">
          <Link
            href="/backendmanager/distribution"
            className="text-blue-600 hover:text-blue-700 mb-2 inline-block"
          >
            ← 返回分销管理
          </Link>
          <h1 className="text-3xl font-bold">提现审核配置</h1>
          <p className="text-gray-600 mt-2">
            配置自动审核规则和风控参数，平衡效率与安全
          </p>
        </div>

        {/* 配置摘要 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-blue-900">当前配置摘要</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">自动审核</p>
              <p className={`text-lg font-bold ${autoApproveEnabled ? 'text-green-600' : 'text-red-600'}`}>
                {autoApproveEnabled ? '✅ 已启用' : '❌ 未启用'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">自动审核限额</p>
              <p className="text-lg font-bold text-blue-600">¥{maxAutoAmount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">手续费率</p>
              <p className="text-lg font-bold text-blue-600">{feeRate.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">每日限制</p>
              <p className="text-lg font-bold text-blue-600">{dailyLimit}次 / ¥{dailyAmountLimit}</p>
            </div>
          </div>
        </div>

        {/* 配置表单 */}
        <div className="space-y-6">
          {/* 基础配置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center mr-3">1</span>
              基础配置
            </h2>
            <div className="space-y-4">
              {basicConfigs.map(config => (
                <div key={config.key} className="border-b pb-4 last:border-0">
                  <label className="block text-sm font-medium mb-2">
                    {config.description}
                  </label>
                  {renderConfigInput(config)}
                  <p className="text-xs text-gray-500 mt-1">配置键: {config.key}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 自动审核条件 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-green-100 text-green-800 rounded-full w-8 h-8 flex items-center justify-center mr-3">2</span>
              自动审核条件
            </h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                💡 <strong>提示：</strong>只有同时满足以下所有条件的提现申请才会被自动审核通过
              </p>
            </div>
            <div className="space-y-4">
              {autoApprovalConfigs.map(config => (
                <div key={config.key} className="border-b pb-4 last:border-0">
                  <label className="block text-sm font-medium mb-2">
                    {config.description}
                  </label>
                  {renderConfigInput(config)}
                  <p className="text-xs text-gray-500 mt-1">配置键: {config.key}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 风控限制 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-orange-100 text-orange-800 rounded-full w-8 h-8 flex items-center justify-center mr-3">3</span>
              风控限制
            </h2>
            <div className="space-y-4">
              {limitConfigs.map(config => (
                <div key={config.key} className="border-b pb-4 last:border-0">
                  <label className="block text-sm font-medium mb-2">
                    {config.description}
                  </label>
                  {renderConfigInput(config)}
                  <p className="text-xs text-gray-500 mt-1">配置键: {config.key}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 风险评分权重 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-red-100 text-red-800 rounded-full w-8 h-8 flex items-center justify-center mr-3">4</span>
              风险评分权重
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                💡 <strong>说明：</strong>每个风险因素都有对应的权重分数，总分越高风险越大。
                建议保持默认值，除非您清楚了解每个参数的作用。
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {riskWeightConfigs.map(config => (
                <div key={config.key} className="border rounded-lg p-4">
                  <label className="block text-sm font-medium mb-2">
                    {config.description}
                  </label>
                  {renderConfigInput(config)}
                  <p className="text-xs text-gray-500 mt-1">{config.key}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 风险阈值 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-800 rounded-full w-8 h-8 flex items-center justify-center mr-3">5</span>
              风险等级阈值
            </h2>
            <div className="space-y-4">
              {riskThresholdConfigs.map(config => (
                <div key={config.key} className="border-b pb-4 last:border-0">
                  <label className="block text-sm font-medium mb-2">
                    {config.description}
                  </label>
                  {renderConfigInput(config)}
                  <p className="text-xs text-gray-500 mt-1">配置键: {config.key}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">风险等级说明：</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• <strong>低风险（0-9分）：</strong>自动审核通过</li>
                <li>• <strong>中风险（10-29分）：</strong>转人工审核</li>
                <li>• <strong>高风险（30-100分）：</strong>转人工审核 + 记录安全警报</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="mt-8 flex items-center justify-between bg-white rounded-lg shadow p-6">
          <div>
            <p className="text-sm text-gray-600">
              修改配置后会立即生效，无需重启服务
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {saving ? "保存中..." : "保存所有配置"}
          </button>
        </div>

        {/* 安全提示 */}
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">⚠️ 安全提示</h3>
          <ul className="text-sm text-red-700 space-y-1">
            <li>• 首次启用自动审核前，建议先进行充分测试</li>
            <li>• 自动审核限额不宜设置过高，建议不超过 ¥5000</li>
            <li>• 定期检查安全警报，及时发现异常行为</li>
            <li>• 修改风险权重可能影响审核结果，请谨慎调整</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
