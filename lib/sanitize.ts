/**
 * 文本清理工具
 * 防止 XSS 攻击和恶意内容注入
 */

/**
 * 清理用户输入的文本
 * 移除所有 HTML 标签、脚本和潜在危险内容
 */
export function sanitizeText(input: string): string {
  if (!input) return ''

  let cleaned = input

  // 1. 移除所有 HTML 标签
  cleaned = cleaned.replace(/<[^>]*>/g, '')

  // 2. 解码 HTML 实体（防止绕过）
  cleaned = cleaned
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&amp;/gi, '&')

  // 3. 再次移除可能通过实体编码绕过的标签
  cleaned = cleaned.replace(/<[^>]*>/g, '')

  // 4. 移除 javascript: 和 data: 协议
  cleaned = cleaned.replace(/javascript:/gi, '')
  cleaned = cleaned.replace(/data:text\/html/gi, '')

  // 5. 移除 on* 事件处理器
  cleaned = cleaned.replace(/on\w+\s*=/gi, '')

  // 6. 限制长度（防止 DoS）
  const maxLength = 5000
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength)
  }

  // 7. 去除首尾空白
  cleaned = cleaned.trim()

  return cleaned
}

/**
 * 清理 HTML 内容（保留安全的标签）
 * 用于需要富文本的场景
 */
export function sanitizeHtml(input: string): string {
  if (!input) return ''

  // 允许的标签白名单（仅保留最基本的格式化标签）
  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'code', 'pre']

  let cleaned = input

  // 1. 移除 <script> 标签及内容
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // 2. 移除 <style> 标签及内容
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // 3. 移除所有 on* 事件处理器
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')

  // 4. 移除 javascript: 和 data: 协议
  cleaned = cleaned.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
  cleaned = cleaned.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src="#"')
  cleaned = cleaned.replace(/src\s*=\s*["']data:text\/html[^"']*["']/gi, 'src="#"')

  // 5. 移除不在白名单中的标签
  cleaned = cleaned.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    return allowedTags.includes(tag.toLowerCase()) ? match : ''
  })

  // 6. 限制长度
  const maxLength = 10000
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength)
  }

  return cleaned.trim()
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * 清理文件名（防止路径遍历）
 */
export function sanitizeFilename(filename: string): string {
  // 移除路径分隔符和特殊字符
  let cleaned = filename.replace(/[\/\\]/g, '')
  cleaned = cleaned.replace(/\.\./g, '')
  cleaned = cleaned.replace(/[^a-zA-Z0-9._-]/g, '_')

  // 限制长度
  if (cleaned.length > 255) {
    const ext = cleaned.split('.').pop()
    cleaned = cleaned.substring(0, 250) + (ext ? '.' + ext : '')
  }

  return cleaned
}
