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

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // 从localStorage加载购物车
  useEffect(() => {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (stored) {
      try {
        setCart(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse cart:", e)
        localStorage.removeItem(CART_STORAGE_KEY)
      }
    }
    setIsLoaded(true)
  }, [])

  // 保存到localStorage
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart)
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart))
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
