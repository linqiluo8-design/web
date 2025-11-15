"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useCart } from "@/hooks/useCart"

export default function CartPage() {
  const router = useRouter()
  const { cart, updateQuantity, removeFromCart, clearCart, total, isLoaded } = useCart()

  const handleRemoveItem = (productId: string) => {
    if (!confirm("确定要删除这个商品吗？")) return
    removeFromCart(productId)
  }

  const checkout = async () => {
    if (cart.length === 0) {
      alert("购物车是空的")
      return
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          }))
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "创建订单失败")
      }

      const data = await res.json()

      // Clear cart after successful order creation
      clearCart()

      // 跳转到支付页面（产品思维：不要立即弹出订单号，而是引导用户完成支付）
      router.push(`/payment/${data.order.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建订单失败")
    }
  }

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">购物车</h1>

      {cart.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">购物车是空的</p>
          <Link
            href="/products"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            去购物
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* 购物车列表 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex gap-4 p-4 border-b last:border-b-0"
                >
                  {/* 商品图片 */}
                  <Link
                    href={`/products/${item.productId}`}
                    className="relative w-24 h-24 bg-gray-100 rounded flex-shrink-0"
                  >
                    {item.coverImage ? (
                      <Image
                        src={item.coverImage}
                        alt={item.title}
                        fill
                        className="object-cover rounded"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                        暂无图片
                      </div>
                    )}
                  </Link>

                  {/* 商品信息 */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.productId}`}
                      className="font-semibold hover:text-blue-600 block mb-1"
                    >
                      {item.title}
                    </Link>

                    <div className="mt-2 text-lg font-bold text-blue-600">
                      ¥{item.price.toFixed(2)}
                    </div>
                  </div>

                  {/* 数量控制 */}
                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => handleRemoveItem(item.productId)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                        className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-12 text-center">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-sm text-gray-600">
                      小计: ¥{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 结算信息 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">订单摘要</h2>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">商品数量</span>
                  <span>{cart.length} 件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">总计数量</span>
                  <span>
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} 个
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">总金额</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ¥{total.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={checkout}
                className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
              >
                去结算
              </button>

              <Link
                href="/products"
                className="block text-center mt-4 text-blue-600 hover:underline"
              >
                继续购物
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
