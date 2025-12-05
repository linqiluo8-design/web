"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface ChatMessage {
  id: string
  senderType: "visitor" | "admin"
  senderName: string | null
  message: string
  messageType: "text" | "image"
  imageUrl?: string | null
  imageWidth?: number | null
  imageHeight?: number | null
  createdAt: string
  isRead: boolean
}

interface ChatSession {
  id: string
  messages: ChatMessage[]
}

export default function CustomerChat() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [visitorId, setVisitorId] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 检查是否是管理员
  const [isAdmin, setIsAdmin] = useState(false)
  const [permissionsChecked, setPermissionsChecked] = useState(false)

  // 图片上传相关状态
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 拖拽相关状态
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hasMoved, setHasMoved] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  // 检查用户权限
  useEffect(() => {
    if (session?.user) {
      // 检查是否是管理员或有客服聊天权限
      fetch('/api/auth/permissions')
        .then(res => res.json())
        .then(data => {
          const permissions = data.permissions || {}
          const level = permissions['CUSTOMER_CHAT']
          const hasAccess = data.role === 'ADMIN' || level === 'READ' || level === 'WRITE'
          setIsAdmin(hasAccess)
          setPermissionsChecked(true)
        })
        .catch(err => {
          console.error('权限检查失败:', err)
          setPermissionsChecked(true)
        })
    } else {
      setPermissionsChecked(true)
    }
  }, [session])

  // 生成或获取访客ID（仅非管理员需要）
  useEffect(() => {
    if (!isAdmin && permissionsChecked) {
      let vid = localStorage.getItem("chatVisitorId")
      if (!vid) {
        vid = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem("chatVisitorId", vid)
      }
      setVisitorId(vid)
    }
  }, [isAdmin, permissionsChecked])

  // 当打开聊天窗口时，获取或创建会话
  useEffect(() => {
    if (isOpen && visitorId && !sessionId) {
      fetchOrCreateSession()
    }
  }, [isOpen, visitorId, sessionId])

  // 自动滚动到最新消息 - 仅在发送消息后
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false)

  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
      setShouldAutoScroll(false)
    }
  }, [shouldAutoScroll, messages])

  // 定期轮询消息（包括已读状态更新）- 仅在窗口打开时
  useEffect(() => {
    if (!sessionId || !isOpen) return

    const interval = setInterval(() => {
      // 检查用户是否正在输入，避免焦点丢失
      const activeElement = document.activeElement
      const isInputActive = activeElement instanceof HTMLInputElement ||
                           activeElement instanceof HTMLTextAreaElement

      if (!isInputActive) {
        fetchNewMessages()
      }
    }, 3000) // 每3秒轮询一次

    return () => clearInterval(interval)
  }, [sessionId, isOpen, visitorId])

  // 监听全局事件以打开聊天窗口
  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true)
    }

    window.addEventListener('openChat', handleOpenChat)
    return () => window.removeEventListener('openChat', handleOpenChat)
  }, [])

  // 从localStorage加载位置，默认右下角
  useEffect(() => {
    const savedPosition = localStorage.getItem('chatButtonPosition')
    if (savedPosition) {
      try {
        const pos = JSON.parse(savedPosition)
        setPosition(pos)
      } catch (e) {
        console.error('加载聊天按钮位置失败:', e)
      }
    }
  }, [])

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    // 防止在按钮内的其他元素上触发拖拽
    if (e.target !== e.currentTarget && !(e.currentTarget as HTMLElement).contains(e.target as Node)) {
      return
    }

    setIsDragging(true)
    setHasMoved(false)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
    e.preventDefault()
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setHasMoved(true)
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y

      // 限制在视口范围内
      const maxX = window.innerWidth - (buttonRef.current?.offsetWidth || 200)
      const maxY = window.innerHeight - (buttonRef.current?.offsetHeight || 100)

      const constrainedX = Math.max(0, Math.min(newX, maxX))
      const constrainedY = Math.max(0, Math.min(newY, maxY))

      setPosition({ x: constrainedX, y: constrainedY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)

      // 保存位置到localStorage
      if (hasMoved) {
        localStorage.setItem('chatButtonPosition', JSON.stringify(position))
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, position, hasMoved])

  // 点击处理（防止拖拽后触发）
  const handleClick = () => {
    if (!hasMoved) {
      setIsOpen(!isOpen)
    }
  }

  // 计算聊天窗口位置
  const getChatWindowPosition = () => {
    if (!buttonRef.current) return {}

    const buttonWidth = buttonRef.current.offsetWidth
    const windowWidth = 384 // w-96 = 24rem = 384px
    const windowHeight = 500

    // 判断按钮位置，决定聊天窗口显示在哪里
    const isNearRight = position.x > window.innerWidth / 2
    const isNearBottom = position.y > window.innerHeight / 2

    let style: React.CSSProperties = {
      position: 'fixed' as const,
      width: '384px',
      height: '500px',
      zIndex: 50
    }

    if (isNearRight) {
      // 靠右，窗口显示在左边
      style.right = `${window.innerWidth - position.x}px`
    } else {
      // 靠左，窗口显示在右边
      style.left = `${position.x + buttonWidth + 12}px`
    }

    if (isNearBottom) {
      // 靠下，窗口在上方
      style.bottom = `${window.innerHeight - position.y - (buttonRef.current?.offsetHeight || 0)}px`
    } else {
      // 靠上，窗口在下方
      style.top = `${position.y}px`
    }

    return style
  }

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
      // 获取所有消息以更新已读状态（传递visitorId用于权限验证）
      const response = await fetch(`/api/chat/messages?sessionId=${sessionId}&visitorId=${visitorId}`)
      if (!response.ok) throw new Error("获取消息失败")

      const data = await response.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error("获取消息失败:", error)
    }
  }

  // 处理图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      alert("只支持上传图片格式：JPG, PNG, GIF, WebP")
      return
    }

    // 验证文件大小（5MB）
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      alert("图片大小不能超过 5MB")
      return
    }

    setSelectedImage(file)

    // 创建预览
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 取消选择图片
  const cancelImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // 上传图片并发送消息
  const sendImageMessage = async () => {
    if (!selectedImage || !sessionId || sending || uploading) return

    setUploading(true)
    setSending(true)

    try {
      // 1. 上传图片
      const formData = new FormData()
      formData.append("image", selectedImage)

      const uploadResponse = await fetch("/api/chat/upload-image", {
        method: "POST",
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || "图片上传失败")
      }

      const uploadData = await uploadResponse.json()

      // 2. 发送图片消息
      const messageResponse = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: newMessage.trim() || "", // 图片说明（可选）
          messageType: "image",
          imageUrl: uploadData.imageUrl,
          imageWidth: uploadData.width,
          imageHeight: uploadData.height,
          senderType: "visitor",
          visitorId
        })
      })

      if (!messageResponse.ok) throw new Error("发送消息失败")

      const messageData = await messageResponse.json()
      setMessages(prev => [...prev, messageData.message])
      setNewMessage("")
      cancelImage()

      // 发送消息后自动滚动到底部
      setShouldAutoScroll(true)
    } catch (error) {
      console.error("发送图片失败:", error)
      alert(error instanceof Error ? error.message : "发送图片失败，请重试")
    } finally {
      setUploading(false)
      setSending(false)
    }
  }

  // 发送文本消息
  const sendMessage = async () => {
    // 如果选择了图片，发送图片消息
    if (selectedImage) {
      return sendImageMessage()
    }

    if (!newMessage.trim() || !sessionId || sending) return

    setSending(true)
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: newMessage.trim(),
          messageType: "text",
          senderType: "visitor",
          visitorId
        })
      })

      if (!response.ok) throw new Error("发送消息失败")

      const data = await response.json()
      setMessages(prev => [...prev, data.message])
      setNewMessage("")

      // 发送消息后自动滚动到底部
      setShouldAutoScroll(true)
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

  // 处理粘贴事件
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    // 查找图片项
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault() // 阻止默认粘贴行为

        const file = item.getAsFile()
        if (!file) continue

        // 验证文件大小（5MB）
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
          alert("图片大小不能超过 5MB")
          return
        }

        // 如果已经选择了图片，先取消
        if (selectedImage) {
          cancelImage()
        }

        setSelectedImage(file)

        // 创建预览
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)

        break // 只处理第一张图片
      }
    }
  }

  // 管理员点击处理
  const handleAdminClick = () => {
    router.push('/backendmanager/chat')
  }

  // 如果是管理员，显示不同的入口
  if (isAdmin) {
    const buttonStyle: React.CSSProperties = {
      position: 'fixed',
      left: position.x || 'auto',
      top: position.y || 'auto',
      right: position.x ? 'auto' : '24px',
      bottom: position.y ? 'auto' : '24px',
      zIndex: 50,
      cursor: isDragging ? 'grabbing' : 'grab',
      userSelect: 'none'
    }

    return (
      <div
        ref={buttonRef}
        style={buttonStyle}
        onMouseDown={handleMouseDown}
      >
        <button
          onClick={() => {
            if (!hasMoved) handleAdminClick()
          }}
          className="relative bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 flex items-center gap-2 px-4 py-3 hover:scale-105 group"
          aria-label="客服聊天"
          style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
        >
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl">
            💬
          </div>
          <div className="flex flex-col items-start">
            <span className="font-bold text-sm leading-none">客服聊天</span>
          </div>
        </button>
      </div>
    )
  }

  // 按钮样式
  const buttonStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x || 'auto',
    top: position.y || 'auto',
    right: position.x ? 'auto' : '24px',
    bottom: position.y ? 'auto' : '24px',
    zIndex: 50,
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none'
  }

  return (
    <>
      {/* 聊天按钮 */}
      <div
        ref={buttonRef}
        style={buttonStyle}
        onMouseDown={handleMouseDown}
      >
        {/* 脉冲动画背景 */}
        {!isOpen && !isDragging && (
          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
        )}

        <button
          onClick={handleClick}
          className="relative bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 flex items-center gap-2 px-4 py-3 hover:scale-105 group"
          aria-label="客服聊天"
          style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
        >
          {isOpen ? (
            <>
              {/* 关闭状态 */}
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="font-medium text-sm pr-1">关闭</span>
            </>
          ) : (
            <>
              {/* 客服头像 - 使用可爱的动漫风格表情 */}
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl animate-bounce-slow">
                👩‍💼
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-sm leading-none">在线客服</span>
                <span className="text-xs opacity-90 leading-none mt-0.5">随时为您服务</span>
              </div>
              {/* 闪烁的小星星装饰 */}
              <div className="absolute -top-1 -left-1 text-yellow-300 animate-pulse">✨</div>
            </>
          )}

          {/* 未读消息提示 */}
          {!isOpen && messages.some(m => m.senderType === "admin" && !m.isRead) && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce shadow-lg">
              {messages.filter(m => m.senderType === "admin" && !m.isRead).length}
            </span>
          )}
        </button>
      </div>

      {/* 聊天窗口 */}
      {isOpen && (
        <div
          className="bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200 flex flex-col"
          style={getChatWindowPosition()}
        >
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

                  {/* 文本消息 */}
                  {msg.messageType === "text" && (
                    <p className="text-sm whitespace-pre-wrap break-words pr-4">{msg.message}</p>
                  )}

                  {/* 图片消息 */}
                  {msg.messageType === "image" && msg.imageUrl && (
                    <div className="space-y-2">
                      <img
                        src={msg.imageUrl}
                        alt={msg.message || "图片"}
                        className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(msg.imageUrl!, "_blank")}
                        style={{ maxHeight: "300px" }}
                      />
                      {msg.message && (
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      )}
                    </div>
                  )}

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
            {/* 图片预览 */}
            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img
                  src={imagePreview}
                  alt="预览"
                  className="rounded-lg max-h-32 border-2 border-blue-500"
                />
                <button
                  onClick={cancelImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                  title="取消图片"
                >
                  ✕
                </button>
                {uploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <div className="text-white text-sm">上传中...</div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {/* 图片上传按钮 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploading || !!selectedImage}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="上传图片"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>

              {/* 文本输入 */}
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                onPaste={handlePaste}
                placeholder={selectedImage ? "添加图片说明（可选）..." : "输入消息... (按 Enter 发送，可粘贴图片)"}
                className="flex-1 px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                disabled={sending || uploading}
              />

              {/* 发送按钮 */}
              <button
                onClick={sendMessage}
                disabled={sending || uploading || (!newMessage.trim() && !selectedImage)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? "上传中" : sending ? "发送中" : "发送"}
              </button>
            </div>

            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                💡 {selectedImage ? "支持添加图片说明" : "可上传或粘贴图片（最大5MB）"}
              </p>
              <p className="text-xs text-gray-400">
                支持: JPG, PNG, GIF, WebP
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
