"use client"

import { useState } from "react"

export default function AdminTestPage() {
  const [result, setResult] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const testAuth = async () => {
    setLoading(true)
    setResult("测试中...")

    try {
      const response = await fetch("/api/test-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "admin@example.com",
          password: "admin123",
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult("✅ 测试成功！\n\n" + JSON.stringify(data, null, 2))
      } else {
        setResult("❌ 测试失败\n\n状态码: " + response.status + "\n\n" + JSON.stringify(data, null, 2))
      }
    } catch (error: any) {
      setResult("❌ 错误: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">管理员登录测试</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">测试信息</h2>
        <div className="space-y-2 text-sm">
          <p><strong>邮箱:</strong> admin@example.com</p>
          <p><strong>密码:</strong> admin123</p>
        </div>
      </div>

      <button
        onClick={testAuth}
        disabled={loading}
        className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {loading ? "测试中..." : "测试认证"}
      </button>

      {result && (
        <div className="mt-6 bg-gray-900 text-gray-100 rounded-lg p-4">
          <pre className="text-sm whitespace-pre-wrap font-mono">{result}</pre>
        </div>
      )}

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">说明</h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• 此页面用于测试管理员账号是否正常</li>
          <li>• 如果测试成功，说明账号和密码都是正确的</li>
          <li>• 如果测试失败，请检查数据库和认证配置</li>
        </ul>
      </div>
    </div>
  )
}
