import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { existsSync } from "fs"

export async function POST(req: Request) {
  try {
    // 验证用户登录和权限
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "未授权，请先登录" },
        { status: 401 }
      )
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "无权限访问" },
        { status: 403 }
      )
    }

    // 获取上传的文件
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: "请选择要上传的文件" },
        { status: 400 }
      )
    }

    // 验证文件类型（MIME type）
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "只支持上传图片文件 (JPEG, PNG, GIF, WebP)" },
        { status: 400 }
      )
    }

    // 验证文件扩展名（白名单）
    const allowedExtensions = ["jpg", "jpeg", "png", "gif", "webp"]
    const fileExtension = file.name.split(".").pop()?.toLowerCase()
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: "不支持的文件扩展名" },
        { status: 400 }
      )
    }

    // 验证MIME类型与扩展名匹配
    const mimeToExtension: { [key: string]: string[] } = {
      "image/jpeg": ["jpg", "jpeg"],
      "image/jpg": ["jpg", "jpeg"],
      "image/png": ["png"],
      "image/gif": ["gif"],
      "image/webp": ["webp"]
    }
    const expectedExtensions = mimeToExtension[file.type]
    if (!expectedExtensions || !expectedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: "文件类型与扩展名不匹配" },
        { status: 400 }
      )
    }

    // 验证文件大小 (限制5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "图片大小不能超过5MB" },
        { status: 400 }
      )
    }

    // 生成唯一文件名（只使用验证过的扩展名）
    const fileName = `${uuidv4()}.${fileExtension}`

    // 将文件转换为Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 确保uploads目录存在
    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // 保存文件到public/uploads目录
    const uploadPath = path.join(uploadsDir, fileName)
    await writeFile(uploadPath, buffer)

    // 返回图片URL
    const imageUrl = `/uploads/${fileName}`

    return NextResponse.json({
      url: imageUrl,
      fileName: fileName,
      message: "图片上传成功"
    })
  } catch (error) {
    console.error("图片上传失败:", error)
    return NextResponse.json(
      { error: "图片上传失败" },
      { status: 500 }
    )
  }
}
