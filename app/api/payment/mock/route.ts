import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 模拟支付页面（演示用）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const paymentId = searchParams.get("paymentId")
  const orderNumber = searchParams.get("orderNumber")
  const method = searchParams.get("method")
  const amount = searchParams.get("amount")

  if (!paymentId || !orderNumber) {
    return new Response("参数错误", { status: 400 })
  }

  // 返回模拟支付页面HTML
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>模拟支付 - ${method}</title>
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
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 400px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .logo {
      width: 80px;
      height: 80px;
      background: ${method === 'alipay' ? '#1677ff' : method === 'wechat' ? '#07c160' : '#0070ba'};
      border-radius: 50%;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 32px;
      font-weight: bold;
    }
    h1 { margin-bottom: 10px; color: #333; }
    .amount {
      font-size: 48px;
      font-weight: bold;
      color: #e74c3c;
      margin: 20px 0;
    }
    .info {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 10px;
      margin: 20px 0;
      font-size: 14px;
      color: #666;
    }
    .info p { margin: 5px 0; }
    button {
      width: 100%;
      padding: 15px;
      font-size: 18px;
      font-weight: bold;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      margin-top: 10px;
      transition: all 0.3s;
    }
    .pay-btn {
      background: ${method === 'alipay' ? '#1677ff' : method === 'wechat' ? '#07c160' : '#0070ba'};
      color: white;
    }
    .pay-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    .cancel-btn {
      background: #f5f5f5;
      color: #666;
    }
    .cancel-btn:hover { background: #e0e0e0; }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 10px;
      border-radius: 5px;
      margin-top: 20px;
      font-size: 12px;
      color: #856404;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">${method === 'alipay' ? '支' : method === 'wechat' ? '微' : 'P'}</div>
    <h1>${method === 'alipay' ? '支付宝支付' : method === 'wechat' ? '微信支付' : 'PayPal支付'}</h1>
    <p style="color: #999; margin-bottom: 20px;">演示模式 - 模拟支付环境</p>
    
    <div class="amount">¥${amount}</div>
    
    <div class="info">
      <p><strong>订单号</strong></p>
      <p style="font-family: monospace;">${orderNumber}</p>
    </div>
    
    <button class="pay-btn" onclick="mockPay()">
      确认支付
    </button>
    
    <button class="cancel-btn" onclick="cancelPay()">
      取消支付
    </button>
    
    <div class="warning">
      <strong>⚠️ 这是演示环境</strong><br>
      实际生产环境需要配置真实的${method === 'alipay' ? '支付宝' : method === 'wechat' ? '微信支付' : 'PayPal'}商户账号
    </div>
  </div>

  <script>
    async function mockPay() {
      const button = document.querySelector('.pay-btn');
      button.textContent = '支付处理中...';
      button.disabled = true;
      
      try {
        // 调用支付回调API
        const res = await fetch('/api/payment/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: '${paymentId}',
            orderNumber: '${orderNumber}',
            status: 'success'
          })
        });
        
        if (res.ok) {
          button.textContent = '支付成功！';
          button.style.background = '#27ae60';
          setTimeout(() => {
            window.location.href = '/payment/success?orderNumber=${orderNumber}&amount=${amount}';
          }, 1000);
        } else {
          alert('支付失败，请重试');
          button.textContent = '确认支付';
          button.disabled = false;
        }
      } catch (error) {
        alert('网络错误，请重试');
        button.textContent = '确认支付';
        button.disabled = false;
      }
    }
    
    function cancelPay() {
      if (confirm('确定要取消支付吗？')) {
        window.location.href = '/products';
      }
    }
  </script>
</body>
</html>
  `

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  })
}
