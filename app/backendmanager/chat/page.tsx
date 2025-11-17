"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

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
  visitorId: string
  visitorName: string | null
  visitorEmail: string | null
  lastMessageAt: string
  messages: ChatMessage[]
  unreadCount: number
}

export default function ChatAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (session?.user?.role !== "ADMIN") {
      router.push("/")
      return
    }

    fetchSessions()
  }, [status, session, router])

  // 自动刷新会话列表
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSessions()
      if (selectedSession) {
        fetchMessages(selectedSession.id)
      }
    }, 5000) // 每5秒刷新

    return () => clearInterval(interval)
  }, [selectedSession])

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/backendmanager/chat")
      if (!response.ok) throw new Error("获取会话失败")

      const data = await response.json()
      setSessions(data.sessions)
      setLoading(false)
    } catch (error) {
      console.error("获取会话失败:", error)
      setLoading(false)
    }
  }

  const fetchMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/messages?sessionId=${sessionId}`)
      if (!response.ok) throw new Error("获取消息失败")

      const data = await response.json()
      setMessages(data.messages)
    } catch (error) {
      console.error("获取消息失败:", error)
    }
  }

  const selectSession = (session: ChatSession) => {
    setSelectedSession(session)
    fetchMessages(session.id)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSession || sending) return

    setSending(true)
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          message: newMessage.trim(),
          senderType: "admin"
        })
      })

      if (!response.ok) throw new Error("发送消息失败")

      const data = await response.json()
      setMessages(prev => [...prev, data.message])
      setNewMessage("")

      // 刷新会话列表
      fetchSessions()
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">客服聊天管理</h1>
          <div className="flex gap-4 text-sm">
            <Link href="/backendmanager" className="text-gray-600 hover:text-blue-600">
              ← 返回后台管理
            </Link>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {sessions.length} 个活跃会话
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[700px]">
        {/* 左侧：会话列表 */}
        <div className="col-span-4 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h2 className="font-semibold text-gray-700">聊天列表</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                暂无活跃聊天
              </div>
            ) : (
              sessions.map((ses) => (
                <div
                  key={ses.id}
                  onClick={() => selectSession(ses)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedSession?.id === ses.id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {ses.visitorName || "访客"}
                        </h3>
                        {ses.unreadCount > 0 && (
                          <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                            {ses.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {ses.visitorEmail || ses.visitorId.substring(0, 20)}
                      </p>
                      {ses.messages[0] && (
                        <p className="text-sm text-gray-500 mt-2 truncate">
                          {ses.messages[0].message}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(ses.lastMessageAt).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧：聊天窗口 */}
        <div className="col-span-8 bg-white rounded-lg shadow flex flex-col">
          {selectedSession ? (
            <>
              {/* 头部 */}
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-900">
                  {selectedSession.visitorName || "访客"}
                </h2>
                <p className="text-sm text-gray-600">
                  {selectedSession.visitorEmail || selectedSession.visitorId}
                </p>
              </div>

              {/* 消息区域 */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-4 ${msg.senderType === "admin" ? "text-right" : ""}`}
                  >
                    <div
                      className={`inline-block max-w-[70%] rounded-lg p-3 shadow-sm ${
                        msg.senderType === "admin"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700"
                      }`}
                    >
                      {msg.senderType === "visitor" && (
                        <p className="text-xs font-semibold mb-1 text-blue-600">
                          {msg.senderName || "访客"}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <span>
                        {new Date(msg.createdAt).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                      {/* 显示管理员发送消息的已读状态 */}
                      {msg.senderType === "admin" && (
                        <span className={`ml-1 ${msg.isRead ? "text-blue-400" : "text-gray-300"}`} title={msg.isRead ? "已读" : "未读"}>
                          {msg.isRead ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* 输入区域 */}
              <div className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="输入消息... (按 Enter 发送)"
                    className="flex-1 px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {sending ? "发送中..." : "发送"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p>选择一个会话开始聊天</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 提示信息 */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-900">💡 使用提示</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 会话列表自动刷新，新消息会实时显示</li>
          <li>• 未读消息会在会话旁显示红色数字提示</li>
          <li>• 按 Enter 键快速发送消息，Shift+Enter 换行</li>
          <li>• 消息会按时间顺序自动滚动到最新位置</li>
        </ul>
      </div>
    </div>
  )
}
