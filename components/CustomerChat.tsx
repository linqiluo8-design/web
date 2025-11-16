"use client"

import { useEffect, useState } from "react"

/**
 * 客服聊天组件 - 使用开源方案 Chatwoot
 *
 * 使用方式：
 * 1. 方式一：集成 Chatwoot（推荐的开源方案）
 *    - 自建：部署 Chatwoot 服务（https://github.com/chatwoot/chatwoot）
 *    - 或使用官方云服务：https://www.chatwoot.com/
 *    - 在环境变量中设置：
 *      NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN=your_website_token
 *      NEXT_PUBLIC_CHATWOOT_BASE_URL=https://app.chatwoot.com (或你的自建地址)
 *
 * 2. 方式二：使用内置简易聊天（当前实现）
 *    - 不需要外部服务
 *    - 显示联系方式供用户自助联系
 *
 * Chatwoot 优势：
 * - 完全开源（MIT 协议）
 * - 支持多渠道（网站、邮件、社交媒体）
 * - 现代化 UI 界面
 * - 可自建部署，数据完全掌控
 * - 活跃的社区支持
 */

export default function CustomerChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isChatwootLoaded, setIsChatwootLoaded] = useState(false)

  // Chatwoot 集成配置
  const chatwootToken = process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN
  const chatwootBaseUrl = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || "https://app.chatwoot.com"

  useEffect(() => {
    // 如果配置了 Chatwoot，则加载 Chatwoot 脚本
    if (chatwootToken && !isChatwootLoaded) {
      // 设置 Chatwoot 配置
      (window as any).chatwootSettings = {
        hideMessageBubble: false,
        position: "right",
        locale: "zh_CN",
        type: "standard",
      }

      // 加载 Chatwoot 脚本
      const script = document.createElement("script")
      script.src = `${chatwootBaseUrl}/packs/js/sdk.js`
      script.defer = true
      script.async = true

      script.onload = () => {
        (window as any).chatwootSDK?.run({
          websiteToken: chatwootToken,
          baseUrl: chatwootBaseUrl,
        })
        setIsChatwootLoaded(true)
      }

      document.body.appendChild(script)

      return () => {
        // 清理 Chatwoot
        if ((window as any).$chatwoot) {
          (window as any).$chatwoot = undefined
        }
        if (document.body.contains(script)) {
          document.body.removeChild(script)
        }
      }
    }
  }, [chatwootToken, chatwootBaseUrl, isChatwootLoaded])

  // 如果已加载 Chatwoot，不显示内置聊天按钮
  if (isChatwootLoaded) {
    return null
  }

  // 内置简易聊天界面
  return (
    <>
      {/* 聊天按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center z-50 hover:scale-110"
        aria-label="客服聊天"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* 聊天窗口 */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 bg-white rounded-lg shadow-2xl z-50 overflow-hidden border border-gray-200">
          {/* 头部 */}
          <div className="bg-blue-600 text-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <h3 className="font-semibold">在线客服</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-blue-700 rounded p-1 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 聊天内容 */}
          <div className="p-4 h-96 overflow-y-auto bg-gray-50">
            {/* 欢迎消息 */}
            <div className="mb-4">
              <div className="bg-white rounded-lg p-3 shadow-sm inline-block max-w-[80%]">
                <p className="text-sm text-gray-700 mb-2">
                  👋 您好！欢迎咨询我们的客服团队。
                </p>
                <p className="text-xs text-gray-500">
                  我们将尽快为您解答问题
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-1">刚刚</p>
            </div>

            {/* 联系方式 */}
            <div className="space-y-3 mt-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-gray-800 mb-3 text-sm">联系我们</h4>

                <div className="space-y-2">
                  <a
                    href="mailto:support@example.com"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>support@example.com</span>
                  </a>

                  <a
                    href="tel:+8618888888888"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>188-8888-8888</span>
                  </a>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>工作时间：9:00 - 18:00</span>
                  </div>
                </div>
              </div>

              {/* 常见问题 */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-gray-800 mb-3 text-sm">常见问题</h4>
                <div className="space-y-2">
                  <a href="/order-lookup" className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                    • 如何查询订单？
                  </a>
                  <a href="/my-orders" className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                    • 查看我的订单
                  </a>
                  <a href="/products" className="block text-sm text-gray-600 hover:text-blue-600 transition-colors">
                    • 浏览商品列表
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* 底部提示 */}
          <div className="bg-gray-100 px-4 py-2 text-xs text-gray-500 text-center border-t">
            <p>💡 提示：点击上方联系方式直接联系客服</p>
          </div>
        </div>
      )}
    </>
  )
}
