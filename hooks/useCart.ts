"use client"

import { useState, useEffect } from "react"

export interface CartItem {
  productId: string
  title: string
  price: number
  quantity: number
  coverImage?: string | null
}

const CART_STORAGE_KEY = "shopping_cart"
const CART_UPDATE_EVENT = "cart-updated"

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // 从localStorage加载购物车
  const loadCart = () => {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (stored) {
      try {
        setCart(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse cart:", e)
        localStorage.removeItem(CART_STORAGE_KEY)
      }
    } else {
      setCart([])
    }
  }

  // 初始加载
  useEffect(() => {
    loadCart()
    setIsLoaded(true)
  }, [])

  // 监听购物车更新事件（实时同步所有组件）
  useEffect(() => {
    const handleCartUpdate = () => {
      loadCart()
    }

    window.addEventListener(CART_UPDATE_EVENT, handleCartUpdate)

    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleCartUpdate)
    }
  }, [])

  // 保存到localStorage并触发更新事件
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart)
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart))

    // 触发自定义事件，通知所有组件购物车已更新
    window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT))
  }

  // 添加商品到购物车
  const addToCart = (product: {
    id: string
    title: string
    price: number
    coverImage?: string | null
  }, quantity: number = 1) => {
    const existingIndex = cart.findIndex(item => item.productId === product.id)

    if (existingIndex >= 0) {
      // 更新现有商品数量
      const newCart = [...cart]
      newCart[existingIndex].quantity += quantity
      saveCart(newCart)
    } else {
      // 添加新商品
      saveCart([...cart, {
        productId: product.id,
        title: product.title,
        price: product.price,
        quantity,
        coverImage: product.coverImage
      }])
    }
  }

  // 更新商品数量
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    const newCart = cart.map(item =>
      item.productId === productId ? { ...item, quantity } : item
    )
    saveCart(newCart)
  }

  // 从购物车移除商品
  const removeFromCart = (productId: string) => {
    saveCart(cart.filter(item => item.productId !== productId))
  }

  // 清空购物车
  const clearCart = () => {
    saveCart([])
  }

  // 计算总价
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // 商品总数
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return {
    cart,
    isLoaded,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    total,
    itemCount
  }
}
