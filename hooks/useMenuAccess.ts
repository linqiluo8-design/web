"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

type MenuModule = "products" | "cart" | "membership" | "membershipOrders" | "myOrders" | "distribution"

export function useMenuAccess(module: MenuModule) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      // Admin always has access
      if (session?.user?.role === "ADMIN") {
        setHasAccess(true)
        setIsChecking(false)
        return
      }

      try {
        const response = await fetch("/api/menu-config")
        const data = await response.json()

        if (data.success && data.config[module]) {
          setHasAccess(true)
          setIsChecking(false)
        } else {
          // Menu is disabled, redirect to home
          router.push("/?error=该功能暂未开放")
        }
      } catch (error) {
        console.error("检查菜单访问权限失败:", error)
        // On error, allow access (fail-open for better UX)
        setHasAccess(true)
        setIsChecking(false)
      }
    }

    checkAccess()
  }, [session, module, router])

  return { isChecking, hasAccess }
}
