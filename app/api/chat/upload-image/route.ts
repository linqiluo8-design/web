import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import sharp from "sharp"
import { v4 as uuidv4 } from "uuid"
import { withRateLimit, RateLimitPresets } from "@/lib/rate-limit"

// 安全配置
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp"
]

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGE_DIMENSION = 4096 // 最大宽度或高度
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "chat")

/**
 * POST /api/chat/upload-image - 上传聊天图片
 *
 * 安全措施：
 * 1. 文件类型白名单验证（MIME + 扩展名）
 * 2. 文件大小限制（5MB）
 * 3. 使用sharp验证是否为真实图片
 * 4. 图片尺寸限制
 * 5. 随机文件名防止覆盖和路径遍历
 * 6. 速率限制（每分钟最多5张图片）
 * 7. 自动压缩优化
 */
export async function POST(req: Request) {
  return withRateLimit(req, { max: 5, windowSeconds: 60, prefix: 'chat-image' }, async () => {
    try {
      const formData = await req.formData()
      const file = formData.get("image") as File

      if (!file) {
        return NextResponse.json(
          { error: "未找到图片文件" },
          { status: 400 }
        )
      }

      // 1. 验证文件大小
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `图片大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        )
      }

      // 2. 验证MIME类型
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "只支持上传图片格式：JPG, PNG, GIF, WebP" },
          { status: 400 }
        )
      }

      // 3. 获取文件扩展名并验证
      const originalExtension = path.extname(file.name).toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(originalExtension)) {
        return NextResponse.json(
          { error: "不支持的图片格式" },
          { status: 400 }
        )
      }

      // 4. 读取文件内容
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // 5. 使用sharp验证是否为真实图片并获取元数据
      let metadata
      try {
        metadata = await sharp(buffer).metadata()
      } catch (error) {
        return NextResponse.json(
          { error: "无效的图片文件" },
          { status: 400 }
        )
      }

      // 6. 验证图片尺寸
      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width > MAX_IMAGE_DIMENSION ||
        metadata.height > MAX_IMAGE_DIMENSION
      ) {
        return NextResponse.json(
          { error: `图片尺寸不能超过 ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}` },
          { status: 400 }
        )
      }

      // 7. 创建上传目录（如果不存在）
      if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true })
      }

      // 8. 生成安全的随机文件名
      const fileId = uuidv4()
      const safeFilename = `${fileId}${originalExtension}`
      const filepath = path.join(UPLOAD_DIR, safeFilename)

      // 9. 处理和压缩图片
      let processedBuffer
      const { width, height } = metadata

      // 如果图片较大，进行压缩
      if (width! > 1920 || height! > 1920) {
        processedBuffer = await sharp(buffer)
          .resize(1920, 1920, {
            fit: "inside",
            withoutEnlargement: true
          })
          .jpeg({ quality: 85 })
          .toBuffer()
      } else {
        // 只进行质量压缩
        processedBuffer = await sharp(buffer)
          .jpeg({ quality: 90 })
          .toBuffer()
      }

      // 10. 保存文件
      await writeFile(filepath, processedBuffer)

      // 11. 获取处理后的图片信息
      const finalMetadata = await sharp(processedBuffer).metadata()

      // 12. 返回图片URL和元数据
      const imageUrl = `/uploads/chat/${safeFilename}`

      return NextResponse.json({
        success: true,
        imageUrl,
        width: finalMetadata.width,
        height: finalMetadata.height,
        size: processedBuffer.length,
        originalSize: file.size
      })

    } catch (error) {
      console.error("图片上传失败:", error)
      return NextResponse.json(
        { error: "图片上传失败，请重试" },
        { status: 500 }
      )
    }
  })
}
