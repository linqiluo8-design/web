/**
 * API 请求缓存和防抖工具
 * 防止短时间内对同一 URL 的重复请求
 */

interface CacheEntry {
  promise: Promise<any>
  timestamp: number
}

class APICache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly CACHE_DURATION = 1000 // 1秒内的重复请求会被缓存

  /**
   * 带缓存的 fetch 请求
   * @param url 请求 URL
   * @param options fetch 选项
   * @returns Promise
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const cacheKey = this.getCacheKey(url, options)
    const now = Date.now()

    // 检查缓存
    const cached = this.cache.get(cacheKey)
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      console.log(`[API Cache] 使用缓存: ${url}`)
      return cached.promise.then(res => res.clone())
    }

    // 发起新请求
    console.log(`[API Cache] 新请求: ${url}`)
    const promise = fetch(url, options)

    // 存入缓存
    this.cache.set(cacheKey, {
      promise,
      timestamp: now
    })

    // 清理过期缓存
    this.cleanupCache(now)

    return promise
  }

  private getCacheKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET'
    return `${method}:${url}`
  }

  private cleanupCache(now: number) {
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION * 2) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * 清空所有缓存
   */
  clear() {
    this.cache.clear()
  }
}

// 导出单例
export const apiCache = new APICache()
