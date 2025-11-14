import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("未授权，请先登录")
  }
  return user
}
