/**
 * 访客ID管理工具
 * 用于识别匿名用户，保存在 localStorage 中
 */

const VISITOR_ID_KEY = "visitor_id"

/**
 * 生成唯一的访客ID
 */
function generateVisitorId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `visitor_${timestamp}_${random}`
}

/**
 * 获取或创建访客ID
 * 如果localStorage中已有ID，则返回该ID
 * 否则创建新ID并保存
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') {
    // 服务端渲染时返回临时ID
    return generateVisitorId()
  }

  try {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY)

    if (!visitorId) {
      visitorId = generateVisitorId()
      localStorage.setItem(VISITOR_ID_KEY, visitorId)
    }

    return visitorId
  } catch (error) {
    // localStorage不可用时返回临时ID
    console.error('无法访问 localStorage:', error)
    return generateVisitorId()
  }
}

/**
 * 清除访客ID（用于测试或重置）
 */
export function clearVisitorId(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(VISITOR_ID_KEY)
    } catch (error) {
      console.error('无法清除访客ID:', error)
    }
  }
}
