import Link from "next/link"

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <section className="text-center py-20">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          欢迎来到知识付费平台
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          发现优质知识内容，提升自我价值。我们提供各类专业课程、电子书、教程等知识产品。
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/products"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            浏览商品
          </Link>
          <Link
            href="/auth/signup"
            className="px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition"
          >
            立即注册
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
            <div className="text-blue-600 text-4xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">优质内容</h3>
            <p className="text-gray-600">
              精选优质知识产品，涵盖各个领域，满足不同学习需求
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
            <div className="text-blue-600 text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold mb-2">安全可靠</h3>
            <p className="text-gray-600">
              采用业界领先的安全技术，保护您的个人信息和交易安全
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
