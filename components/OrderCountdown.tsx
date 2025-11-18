"use client"

import { useEffect, useState } from "react"

interface OrderCountdownProps {
  expiresAt: string | Date | null
  onExpire?: () => void
  className?: string
  showIcon?: boolean
}

export default function OrderCountdown({
  expiresAt,
  onExpire,
  className = "",
  showIcon = true
}: OrderCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>("")
  const [isExpired, setIsExpired] = useState(false)
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft("")
      return
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const expireTime = new Date(expiresAt).getTime()
      const difference = expireTime - now

      if (difference <= 0) {
        setTimeLeft("已过期")
        setIsExpired(true)
        if (onExpire) {
          onExpire()
        }
        return
      }

      // 计算剩余时间
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      // 少于5分钟时标记为紧急
      setIsUrgent(difference < 5 * 60 * 1000)

      setTimeLeft(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`)
    }

    // 立即计算一次
    calculateTimeLeft()

    // 每秒更新一次
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [expiresAt, onExpire])

  if (!expiresAt || !timeLeft) {
    return null
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${
        isExpired
          ? "text-gray-500"
          : isUrgent
          ? "text-red-600 font-semibold"
          : "text-orange-600"
      } ${className}`}
    >
      {showIcon && (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
      <span className="text-sm">
        {isExpired ? (
          "订单已过期"
        ) : (
          <>
            <span className="hidden sm:inline">剩余时间：</span>
            <span className={isUrgent ? "animate-pulse" : ""}>{timeLeft}</span>
          </>
        )}
      </span>
    </div>
  )
}
