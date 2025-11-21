"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

interface ChatMessage {
  id: string
  senderType: "visitor" | "admin"
  senderName: string | null
  message: string
  createdAt: string
  isRead: boolean
}

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [visitorId, setVisitorId] = useState<string>("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [visitorName, setVisitorName] = useState("")
  const [visitorEmail, setVisitorEmail] = useState("")
  const [showInfoForm, setShowInfoForm] = useState(false)

  // 获取或创建访客ID
  useEffect(() => {
    const getOrCreateVisitorId = () => {
      const stored = localStorage.getItem('visitor_id')
      if (stored) {
        return stored
      }
      // 生成新的访客ID
      const newId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('visitor_id', newId)
      return newId
    }
    const id = getOrCreateVisitorId()
    setVisitorId(id)

    // 获取已保存的访客信息
    const savedName = localStorage.getItem('visitor_name')
    const savedEmail = localStorage.getItem('visitor_email')
    if (savedName) setVisitorName(savedName)
    if (savedEmail) setVisitorEmail(savedEmail)
  }, [])

  // 获取或创建会话
  useEffect(() => {
    if (!visitorId) return

    const fetchOrCreateSession = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId,
            visitorName: visitorName || null,
            visitorEmail: visitorEmail || null
          })
        })

        if (!response.ok) throw new Error("获取会话失败")

        const data = await response.json()
        setSessionId(data.session.id)

        // 获取历史消息
        fetchMessages(data.session.id)
      } catch (error) {
        console.error("获取会话失败:", error)
        setLoading(false)
      }
    }

    fetchOrCreateSession()
  }, [visitorId])

  // 定期刷新消息
  useEffect(() => {
    if (!sessionId) return

    const interval = setInterval(() => {
      // 检查用户是否正在输入，如果正在输入则跳过本次刷新
      const activeElement = document.activeElement
      const isInputActive = activeElement instanceof HTMLInputElement ||
                           activeElement instanceof HTMLTextAreaElement

      if (!isInputActive) {
        fetchMessages(sessionId)
      }
    }, 3000) // 每3秒刷新

    return () => clearInterval(interval)
  }, [sessionId, visitorId])

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchMessages = async (sid: string) => {
    try {
      const response = await fetch(`/api/chat/messages?sessionId=${sid}&visitorId=${visitorId}`)
      if (!response.ok) throw new Error("获取消息失败")

      const data = await response.json()
      setMessages(data.messages)
      setLoading(false)
    } catch (error) {
      console.error("获取消息失败:", error)
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !sessionId || sending) return

    setSending(true)
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: newMessage.trim(),
          senderType: "visitor",
          visitorName: visitorName || null
        })
      })

      if (!response.ok) throw new Error("发送消息失败")

      const data = await response.json()
      setMessages(prev => [...prev, data.message])
      setNewMessage("")
    } catch (error) {
      console.error("发送消息失败:", error)
      alert("发送消息失败，请重试")
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const saveVisitorInfo = () => {
    if (visitorName) localStorage.setItem('visitor_name', visitorName)
    if (visitorEmail) localStorage.setItem('visitor_email', visitorEmail)
    setShowInfoForm(false)

    // 更新会话信息
    if (sessionId) {
      fetch("/api/chat/sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          visitorName: visitorName || null,
          visitorEmail: visitorEmail || null
        })
      }).catch(err => console.error("更新会话信息失败:", err))
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">在线客服</h1>
        <button
          onClick={() => setShowInfoForm(!showInfoForm)}
          className="text-sm text-blue-600 hover:underline"
        >
          {visitorName ? `当前身份: ${visitorName}` : "设置身份信息"}
        </button>
      </div>

      {/* 访客信息表单 */}
      {showInfoForm && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-3">设置您的信息（可选）</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="您的昵称"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="您的邮箱（可选）"
              value={visitorEmail}
              onChange={(e) => setVisitorEmail(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={saveVisitorInfo}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              保存
            </button>
            <button
              onClick={() => setShowInfoForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 聊天区域 */}
      <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col" style={{ height: "calc(100vh - 280px)" }}>
        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p className="mb-2">欢迎使用在线客服！</p>
              <p className="text-sm">有任何问题都可以在这里咨询我们</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === "visitor" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    msg.senderType === "visitor"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.senderType === "admin" && msg.senderName && (
                    <div className="text-xs text-gray-600 mb-1">
                      {msg.senderName}（客服）
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  <div
                    className={`text-xs mt-1 ${
                      msg.senderType === "visitor" ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString("zh-CN")}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息... (按Enter发送，Shift+Enter换行)"
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed self-end"
            >
              {sending ? "发送中..." : "发送"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            客服工作时间：周一至周五 9:00-18:00，非工作时间请留言
          </p>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-yellow-800">温馨提示</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 请描述您遇到的问题，客服会尽快回复您</li>
          <li>• 如果涉及订单问题，请提供订单号以便我们快速处理</li>
          <li>• 为了更好地为您服务，建议您设置昵称和邮箱</li>
        </ul>
      </div>
    </div>
  )
}
