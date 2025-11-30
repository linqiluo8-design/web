"use client"

import { useEffect, useState } from "react"
import { captureReferralCodeFromURL, getReferralCode as getReferralCodeUtil, clearReferralCode as clearReferralCodeUtil } from "@/lib/referralCode"

/**
 * React Hook for managing referral codes
 * 自动捕获 URL 中的 dist 参数并保存到 localStorage
 */
export function useReferralCode() {
  const [referralCode, setReferralCode] = useState<string | null>(null)

  useEffect(() => {
    // 尝试从 URL 捕获分销码
    const captured = captureReferralCodeFromURL()

    if (captured) {
      setReferralCode(captured)
    } else {
      // 如果 URL 中没有，尝试从 localStorage 读取
      const stored = getReferralCodeUtil()
      setReferralCode(stored)
    }
  }, [])

  return {
    referralCode,
    getReferralCode: getReferralCodeUtil,
    clearReferralCode: clearReferralCodeUtil
  }
}
