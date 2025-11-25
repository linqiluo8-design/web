import Link from "next/link"
import BannerCarousel from "@/components/BannerCarousel"

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* 轮播图 */}
      <section className="mb-12">
        <BannerCarousel />
      </section>

      {/* 分销横幅 */}
      <section className="mb-12">
        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between p-6 md:p-8">
            <div className="flex items-center gap-4 md:gap-6 mb-4 md:mb-0">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-2xl md:text-3xl font-bold">💰 成为分销商，轻松赚佣金</h3>
                  <span className="text-xs bg-yellow-400 text-orange-800 px-2 py-1 rounded-full font-bold animate-pulse">HOT</span>
                </div>
                <p className="text-sm md:text-base text-white text-opacity-95">
                  分享商品给好友，每笔成交最高可获得 <span className="font-bold text-yellow-300 text-lg">15% 佣金</span>，零成本创业，月入过万不是梦！
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 w-full md:w-auto">
              <Link
                href="/distribution"
                className="block w-full md:w-auto px-8 py-3.5 bg-white text-orange-600 rounded-xl font-bold hover:bg-yellow-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 text-center text-lg"
              >
                立即加入 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <section className="text-center py-20">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          欢迎来到知识付费平台
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          发现优质知识内容，提升自我价值。无需注册，即可购买各类专业课程、电子书、教程等知识产品。
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/products"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-md hover:shadow-lg"
          >
            立即浏览商品
          </Link>
          <Link
            href="/membership"
            className="px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition"
          >
            购买会员
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          平台特色
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 bg-white rounded-lg shadow-sm border">
            <div className="text-blue-600 text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-semibold mb-2">无需注册</h3>
            <p className="text-gray-600">
              匿名购物，保护隐私。无需填写复杂信息，点击购买即可下单
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm border">
            <div className="text-blue-600 text-4xl mb-4">💳</div>
            <h3 className="text-xl font-semibold mb-2">多种支付</h3>
            <p className="text-gray-600">
              支持支付宝、微信、PayPal等多种支付方式，购买便捷
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm border">
            <div className="text-blue-600 text-4xl mb-4">📦</div>
            <h3 className="text-xl font-semibold mb-2">订单查询</h3>
            <p className="text-gray-600">
              获得唯一订单号，随时查询订单状态，安全便捷
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-50 rounded-lg text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          准备开始学习了吗？
        </h2>
        <p className="text-gray-600 mb-6">
          立即浏览我们的商品，找到适合你的知识产品
        </p>
        <Link
          href="/products"
          className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          探索商品
        </Link>
      </section>
    </div>
  )
}
