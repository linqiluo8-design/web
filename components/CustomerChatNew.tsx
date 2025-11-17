"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"

interface ChatMessage {
  id: string
  senderType: "visitor" | "admin"
  senderName: string | null
  message: string
  createdAt: string
  isRead: boolean
}

interface ChatSession {
  id: string
  messages: ChatMessage[]
}

export default function CustomerChat() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [visitorId, setVisitorId] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 生成或获取访客ID
  useEffect(() => {
    let vid = localStorage.getItem("chatVisitorId")
    if (!vid) {
      vid = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem("chatVisitorId", vid)
    }
    setVisitorId(vid)
  }, [])

  // 当打开聊天窗口时，获取或创建会话
  useEffect(() => {
    if (isOpen && visitorId && !sessionId) {
      fetchOrCreateSession()
    }
  }, [isOpen, visitorId, sessionId])

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 定期轮询消息（包括已读状态更新）- 仅在窗口打开时
  useEffect(() => {
    if (!sessionId || !isOpen) return

    const interval = setInterval(() => {
      fetchNewMessages()
    }, 3000) // 每3秒轮询一次

    return () => clearInterval(interval)
  }, [sessionId, isOpen])

  const fetchOrCreateSession = async () => {
    try {
      const response = await fetch(`/api/chat/sessions?visitorId=${visitorId}`)
      if (!response.ok) throw new Error("获取会话失败")

      const data = await response.json()
      setSessionId(data.session.id)
      setMessages(data.session.messages || [])
    } catch (error) {
      console.error("获取会话失败:", error)
    }
  }

  const fetchNewMessages = async () => {
    if (!sessionId) return

    try {
      // 获取所有消息以更新已读状态
      const response = await fetch(`/api/chat/messages?sessionId=${sessionId}`)
      if (!response.ok) throw new Error("获取消息失败")

      const data = await response.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error("获取消息失败:", error)
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
          visitorId
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
        {/* 未读消息提示 */}
        {!isOpen && messages.some(m => m.senderType === "admin" && !m.isRead) && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            !
          </span>
        )}
      </button>

      {/* 聊天窗口 */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 bg-white rounded-lg shadow-2xl z-50 overflow-hidden border border-gray-200 flex flex-col" style={{ height: "500px" }}>
          {/* 头部 */}
          <div className="bg-blue-600 text-white px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
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

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {/* 欢迎消息 */}
            <div className="mb-4">
              <div className="bg-white rounded-lg p-3 shadow-sm inline-block max-w-[80%]">
                <p className="text-sm text-gray-700">
                  👋 您好！欢迎咨询我们的客服团队。有什么可以帮您的吗？
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-1">刚刚</p>
            </div>

            {/* 聊天消息 */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-4 ${msg.senderType === "visitor" ? "text-right" : ""}`}
              >
                <div
                  className={`inline-block max-w-[80%] rounded-lg p-3 shadow-sm relative ${
                    msg.senderType === "visitor"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700"
                  }`}
                >
                  {msg.senderType === "admin" && (
                    <p className="text-xs font-semibold mb-1 text-blue-600">
                      {msg.senderName || "客服"}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words pr-4">{msg.message}</p>

                  {/* 显示访客发送消息的已读状态 - 右上角小圆圈 */}
                  {msg.senderType === "visitor" && (
                    <div
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white"
                      style={{
                        borderColor: msg.isRead ? "#60a5fa" : "#d1d5db"
                      }}
                      title={msg.isRead ? "已读" : "未读"}
                    >
                      {msg.isRead && (
                        <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className="p-4 bg-white border-t flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="输入消息... (按 Enter 发送)"
                className="flex-1 px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? "..." : "发送"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 提示：我们会尽快回复您的消息
            </p>
          </div>
        </div>
      )}
    </>
  )
}
