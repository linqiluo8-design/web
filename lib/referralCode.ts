/**
 * 分销码管理工具函数（不依赖 React hooks）
 * 用于在任何地方读取和操作分销码
 */

const REFERRAL_CODE_KEY = "referral_code"
const REFERRAL_EXPIRY_DAYS = 7

interface ReferralData {
  code: string
  expiresAt: number
}

/**
 * 保存分销码到 localStorage
 */
export function saveReferralCode(code: string): boolean {
  try {
    const expiresAt = Date.now() + REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    const referralData: ReferralData = {
      code: code.toUpperCase(),
      expiresAt
    }

    localStorage.setItem(REFERRAL_CODE_KEY, JSON.stringify(referralData))
    console.log(`✅ 分销码已保存: ${code.toUpperCase()} (有效期${REFERRAL_EXPIRY_DAYS}天)`)
    return true
  } catch (error) {
    console.error("保存分销码失败:", error)
    return false
  }
}

/**
 * 从 localStorage 读取分销码
 * 自动检查过期并清理
 */
export function getReferralCode(): string | null {
  try {
    const stored = localStorage.getItem(REFERRAL_CODE_KEY)
    if (!stored) {
      console.log("📭 未找到分销码")
      return null
    }

    const referralData: ReferralData = JSON.parse(stored)

    // Check if expired
    if (Date.now() < referralData.expiresAt) {
      console.log(`📌 读取分销码: ${referralData.code}`)
      return referralData.code
    } else {
      // Expired, remove it
      localStorage.removeItem(REFERRAL_CODE_KEY)
      console.log("⏰ 分销码已过期，已清除")
      return null
    }
  } catch (error) {
    console.error("获取分销码失败:", error)
    return null
  }
}

/**
 * 清除分销码
 */
export function clearReferralCode(): boolean {
  try {
    localStorage.removeItem(REFERRAL_CODE_KEY)
    console.log("🗑️ 分销码已清除")
    return true
  } catch (error) {
    console.error("清除分销码失败:", error)
    return false
  }
}

/**
 * 从 URL 中提取并保存分销码
 */
export function captureReferralCodeFromURL(): string | null {
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const distParam = urlParams.get("dist")

    if (distParam) {
      saveReferralCode(distParam)
      return distParam.toUpperCase()
    }

    return null
  } catch (error) {
    console.error("从 URL 捕获分销码失败:", error)
    return null
  }
}
