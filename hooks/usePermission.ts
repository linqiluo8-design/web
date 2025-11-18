import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

type PermissionLevel = "NONE" | "READ" | "WRITE"
type PermissionModule =
  | "CATEGORIES"
  | "MEMBERSHIPS"
  | "ORDERS"
  | "PRODUCTS"
  | "BANNERS"
  | "SYSTEM_SETTINGS"
  | "SECURITY_ALERTS"
  | "CUSTOMER_CHAT"
  | "USER_MANAGEMENT"
  | "ORDER_LOOKUP"

interface UsePermissionOptions {
  module: PermissionModule
  redirectOnNoAccess?: boolean
}

interface UsePermissionResult {
  permission: PermissionLevel
  loading: boolean
  canRead: boolean
  canWrite: boolean
  isAdmin: boolean
}

/**
 * 权限检查 Hook
 * 用于检查用户对特定模块的权限
 *
 * @param options.module - 要检查的模块名称
 * @param options.redirectOnNoAccess - 如果没有权限是否跳转到首页 (默认: true)
 * @returns 权限状态和检查结果
 */
export function usePermission({
  module,
  redirectOnNoAccess = true
}: UsePermissionOptions): UsePermissionResult {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [permission, setPermission] = useState<PermissionLevel>("NONE")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (status === "authenticated" && session?.user) {
      checkPermission()
    }
  }, [status, session, router, module])

  const checkPermission = async () => {
    try {
      setLoading(true)

      // 管理员拥有所有权限
      if (session?.user?.role === "ADMIN") {
        setPermission("WRITE")
        setLoading(false)
        return
      }

      // 获取用户权限
      const res = await fetch("/api/auth/permissions")
      if (!res.ok) {
        throw new Error("获取权限失败")
      }

      const data = await res.json()
      const userPermission = data.permissions?.[module] || "NONE"

      setPermission(userPermission)

      if (userPermission === "NONE" && redirectOnNoAccess) {
        // 没有权限，跳转到首页
        router.push("/")
        return
      }
    } catch (error) {
      console.error("检查权限失败:", error)
      if (redirectOnNoAccess) {
        router.push("/")
      }
    } finally {
      setLoading(false)
    }
  }

  return {
    permission,
    loading,
    canRead: permission === "READ" || permission === "WRITE",
    canWrite: permission === "WRITE",
    isAdmin: session?.user?.role === "ADMIN"
  }
}
