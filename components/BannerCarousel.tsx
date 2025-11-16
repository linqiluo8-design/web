"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"

interface Banner {
  id: string
  title: string
  image: string
  link: string | null
  description: string | null
}

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    loadBannersAndConfig()
  }, [])

  // 自动轮播
  useEffect(() => {
    if (banners.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, 5000) // 每5秒切换一次

    return () => clearInterval(timer)
  }, [banners.length])

  const loadBannersAndConfig = async () => {
    try {
      // 并行加载轮播图和配置
      const [bannersRes, configRes] = await Promise.all([
        fetch("/api/banners"),
        fetch("/api/system-config?keys=banner_enabled")
      ])

      if (configRes.ok) {
        const config = await configRes.json()
        setEnabled(config.banner_enabled !== false)
      }

      if (bannersRes.ok) {
        const data = await bannersRes.json()
        setBanners(data.banners || [])
      }
    } catch (error) {
      console.error("加载轮播图失败:", error)
    } finally {
      setLoading(false)
    }
  }

  // 如果轮播图功能未启用，或没有轮播图，或正在加载，则不显示
  if (!enabled || loading || banners.length === 0) {
    return null
  }

  const currentBanner = banners[currentIndex]

  const BannerContent = () => (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden">
      <Image
        src={currentBanner.image}
        alt={currentBanner.title}
        fill
        className="object-cover"
        priority={currentIndex === 0}
      />
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

      {/* 文本内容 */}
      <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">{currentBanner.title}</h2>
        {currentBanner.description && (
          <p className="text-lg opacity-90">{currentBanner.description}</p>
        )}
      </div>

      {/* 指示器 */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-white w-8"
                  : "bg-white/50 hover:bg-white/75"
              }`}
              aria-label={`跳转到第 ${index + 1} 张`}
            />
          ))}
        </div>
      )}

      {/* 左右切换按钮 */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() =>
              setCurrentIndex((prev) =>
                prev === 0 ? banners.length - 1 : prev - 1
              )
            }
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition"
            aria-label="上一张"
          >
            ‹
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % banners.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition"
            aria-label="下一张"
          >
            ›
          </button>
        </>
      )}
    </div>
  )

  // 如果有链接，使用Link包装
  if (currentBanner.link) {
    return (
      <Link href={currentBanner.link} className="block">
        <BannerContent />
      </Link>
    )
  }

  return <BannerContent />
}
