import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/payment/mock-membership - 模拟会员支付页面
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const membershipId = searchParams.get("membershipId")
    const method = searchParams.get("method")
    const amount = searchParams.get("amount")

    if (!membershipId || !method || !amount) {
      return new Response(
        `<html><body><h1>参数错误</h1><p>缺少必要参数</p></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    }

    // 验证会员记录是否存在
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId }
    })

    if (!membership) {
      return new Response(
        `<html><body><h1>会员订单不存在</h1></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    }

    const methodNames: Record<string, string> = {
      alipay: "支付宝",
      wechat: "微信支付",
      paypal: "PayPal"
    }

    const methodName = methodNames[method] || method

    // 返回模拟支付页面
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>模拟${methodName}支付</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 480px;
      width: 100%;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: bold;
      color: white;
    }
    .alipay { background: linear-gradient(135deg, #1677ff, #69c0ff); }
    .wechat { background: linear-gradient(135deg, #07c160, #95ec69); }
    .paypal { background: linear-gradient(135deg, #ffc439, #ffe58f); color: #333; }
    h1 { font-size: 24px; color: #333; margin-bottom: 8px; }
    .subtitle { color: #666; font-size: 14px; }
    .info-box {
      background: #f5f5f5;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e8e8e8;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #666; font-size: 14px; }
    .info-value { color: #333; font-weight: 600; font-size: 14px; }
    .amount { color: #f5222d; font-size: 32px; font-weight: bold; text-align: center; margin: 24px 0; }
    .code { font-family: "Courier New", monospace; background: #fff; padding: 12px; border-radius: 8px; border: 2px dashed #d9d9d9; text-align: center; font-size: 16px; font-weight: bold; color: #1890ff; letter-spacing: 2px; }
    .buttons { display: flex; gap: 12px; margin-top: 30px; }
    .btn {
      flex: 1;
      padding: 14px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4); }
    .btn-secondary {
      background: white;
      color: #666;
      border: 1px solid #d9d9d9;
    }
    .btn-secondary:hover { background: #f5f5f5; }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .note {
      background: #fffbe6;
      border: 1px solid #ffe58f;
      border-radius: 8px;
      padding: 12px;
      margin-top: 20px;
      font-size: 12px;
      color: #8c8c8c;
    }
    .loading {
      display: none;
      text-align: center;
      color: #667eea;
      margin-top: 16px;
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo ${method}">${methodName.charAt(0)}</div>
      <h1>${methodName}支付</h1>
      <div class="subtitle">模拟支付环境（开发/测试）</div>
    </div>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">会员码</span>
        <span class="info-value code">${membership.membershipCode}</span>
      </div>
      <div class="info-row">
        <span class="info-label">支付方式</span>
        <span class="info-value">${methodName}</span>
      </div>
    </div>

    <div class="amount">¥${parseFloat(amount).toFixed(2)}</div>

    <div class="buttons">
      <button class="btn btn-secondary" onclick="handleCancel()">取消支付</button>
      <button class="btn btn-primary" id="payBtn" onclick="handlePay()">确认支付</button>
    </div>

    <div class="loading" id="loading">
      <div class="spinner"></div>
      <div>正在处理支付...</div>
    </div>

    <div class="note">
      ⚠️ 这是模拟支付环境，点击"确认支付"将直接模拟支付成功。真实支付模式请在后台管理中配置支付商户信息后启用。
    </div>
  </div>

  <script>
    async function handlePay() {
      const payBtn = document.getElementById('payBtn')
      const loading = document.getElementById('loading')

      payBtn.disabled = true
      loading.style.display = 'block'

      try {
        // 调用支付回调API
        const response = await fetch('/api/payment/membership-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            membershipId: '${membershipId}',
            membershipCode: '${membership.membershipCode}',
            status: 'success'
          })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // 支付成功，跳转到成功页面
          window.location.href = '/membership/success?code=${membership.membershipCode}&amount=${amount}'
        } else {
          throw new Error(data.message || '支付处理失败')
        }
      } catch (error) {
        alert('支付失败：' + error.message)
        payBtn.disabled = false
        loading.style.display = 'none'
      }
    }

    function handleCancel() {
      if (confirm('确定要取消支付吗？')) {
        window.history.back()
      }
    }
  </script>
</body>
</html>
    `

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    })

  } catch (error) {
    console.error("模拟支付页面加载失败:", error)
    return new Response(
      `<html><body><h1>系统错误</h1><p>${error instanceof Error ? error.message : "未知错误"}</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 500 }
    )
  }
}
