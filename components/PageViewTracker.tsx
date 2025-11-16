"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

/**
 * 页面访问追踪组件
 * 在每次路由变化时记录页面访问数据
 */
export default function PageViewTracker() {
  const pathname = usePathname()
  const { data: session } = useSession()

  useEffect(() => {
    // 发送访问记录
    const trackPageView = async () => {
      try {
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: pathname,
            referer: document.referrer,
            userId: session?.user?.id || null,
          }),
        })
      } catch (error) {
        // 静默失败，不影响用户体验
        console.debug('Page view tracking failed:', error)
      }
    }

    trackPageView()
  }, [pathname, session?.user?.id])

  // 不渲染任何UI
  return null
}
