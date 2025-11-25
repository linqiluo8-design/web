"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

const REFERRAL_CODE_KEY = "referral_code"
const REFERRAL_EXPIRY_KEY = "referral_code_expiry"
const REFERRAL_EXPIRY_DAYS = 7 // 分销链接有效期：7天

interface ReferralData {
  code: string
  expiresAt: number
}

export function useReferralCode() {
  const searchParams = useSearchParams()
  const [referralCode, setReferralCode] = useState<string | null>(null)

  useEffect(() => {
    // 1. Check if there's a 'dist' parameter in the URL
    const distParam = searchParams?.get("dist")

    if (distParam) {
      // Save new referral code with expiry
      const expiresAt = Date.now() + REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      const referralData: ReferralData = {
        code: distParam.toUpperCase(),
        expiresAt
      }

      try {
        localStorage.setItem(REFERRAL_CODE_KEY, JSON.stringify(referralData))
        setReferralCode(distParam.toUpperCase())
        console.log(`✅ 分销码已保存: ${distParam.toUpperCase()} (有效期${REFERRAL_EXPIRY_DAYS}天)`)
      } catch (error) {
        console.error("保存分销码失败:", error)
      }
    } else {
      // 2. If no URL parameter, check localStorage
      try {
        const stored = localStorage.getItem(REFERRAL_CODE_KEY)
        if (stored) {
          const referralData: ReferralData = JSON.parse(stored)

          // Check if expired
          if (Date.now() < referralData.expiresAt) {
            setReferralCode(referralData.code)
            console.log(`📌 使用已保存的分销码: ${referralData.code}`)
          } else {
            // Expired, remove it
            localStorage.removeItem(REFERRAL_CODE_KEY)
            setReferralCode(null)
            console.log("⏰ 分销码已过期，已清除")
          }
        }
      } catch (error) {
        console.error("读取分销码失败:", error)
        localStorage.removeItem(REFERRAL_CODE_KEY)
      }
    }
  }, [searchParams])

  // Function to get current referral code
  const getReferralCode = (): string | null => {
    try {
      const stored = localStorage.getItem(REFERRAL_CODE_KEY)
      if (!stored) return null

      const referralData: ReferralData = JSON.parse(stored)

      // Check if expired
      if (Date.now() < referralData.expiresAt) {
        return referralData.code
      } else {
        // Expired, remove it
        localStorage.removeItem(REFERRAL_CODE_KEY)
        return null
      }
    } catch (error) {
      console.error("获取分销码失败:", error)
      return null
    }
  }

  // Function to clear referral code
  const clearReferralCode = () => {
    try {
      localStorage.removeItem(REFERRAL_CODE_KEY)
      setReferralCode(null)
      console.log("🗑️ 分销码已清除")
    } catch (error) {
      console.error("清除分销码失败:", error)
    }
  }

  return {
    referralCode,
    getReferralCode,
    clearReferralCode
  }
}
