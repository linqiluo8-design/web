"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
}

export default function ImageUpload({ value, onChange, label = "封面图片" }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadMode, setUploadMode] = useState<"url" | "upload">("url")
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pasteAreaRef = useRef<HTMLDivElement>(null)

  // 监听粘贴事件
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // 只在上传模式且聚焦在粘贴区域时处理
      if (uploadMode !== "upload") return
      if (!pasteAreaRef.current?.contains(document.activeElement)) return

      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await uploadFile(file)
          }
          break
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [uploadMode])

  const uploadFile = async (file: File) => {
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "上传失败")
      }

      const data = await response.json()
      onChange(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败")
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await uploadFile(file)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      await uploadFile(file)
    } else {
      setError("请拖拽图片文件")
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setUploadMode("url")}
            className={`px-2 py-1 text-xs rounded ${
              uploadMode === "url"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setUploadMode("upload")}
            className={`px-2 py-1 text-xs rounded ${
              uploadMode === "upload"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            上传
          </button>
        </div>
      </div>

      {uploadMode === "url" ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://example.com/image.jpg"
        />
      ) : (
        <div>
          <div
            ref={pasteAreaRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            tabIndex={0}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="text-blue-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm">上传中...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-gray-600">
                  <svg
                    className="mx-auto h-12 w-12"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-medium">点击选择图片</p>
                  <p className="text-xs mt-1">或拖拽图片到此处</p>
                  <p className="text-xs mt-1 text-blue-600">也可以直接粘贴图片 (Ctrl+V)</p>
                </div>
                <p className="text-xs text-gray-500">支持 JPG, PNG, GIF, WebP (最大5MB)</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {value && uploadMode === "upload" && (
            <div className="mt-2 text-xs text-gray-600">
              <span className="font-medium">当前URL:</span>{" "}
              <span className="text-blue-600">{value}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {value && (
        <div>
          <p className="text-xs text-gray-600 mb-2">预览：</p>
          <div className="relative w-32 h-32 border rounded overflow-hidden">
            <Image src={value} alt="预览" fill className="object-cover" />
          </div>
        </div>
      )}
    </div>
  )
}
