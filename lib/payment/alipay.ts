import AlipaySdk from 'alipay-sdk'
import AlipayFormData from 'alipay-sdk/lib/form'

// 支付宝SDK配置
const alipayClient = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID || '',
  privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
  gateway: 'https://openapi.alipay.com/gateway.do',
  signType: 'RSA2',
})

export interface AlipayCreateOrderParams {
  orderNumber: string
  totalAmount: number
  subject: string
  body?: string
}

/**
 * 创建支付宝支付订单（网页支付）
 */
export async function createAlipayOrder(params: AlipayCreateOrderParams) {
  try {
    const formData = new AlipayFormData()
    
    // 设置参数
    formData.setMethod('get')
    formData.addField('returnUrl', `${process.env.NEXTAUTH_URL}/payment/callback/alipay`)
    formData.addField('notifyUrl', `${process.env.NEXTAUTH_URL}/api/payment/callback/alipay`)
    
    // 业务参数
    formData.addField('bizContent', {
      outTradeNo: params.orderNumber,
      productCode: 'FAST_INSTANT_TRADE_PAY',
      totalAmount: params.totalAmount.toFixed(2),
      subject: params.subject,
      body: params.body || params.subject,
    })

    // 生成支付链接
    const result = await alipayClient.exec(
      'alipay.trade.page.pay',
      {},
      { formData }
    )

    return {
      success: true,
      paymentUrl: result,
    }
  } catch (error) {
    console.error('创建支付宝订单失败:', error)
    return {
      success: false,
      error: '创建支付宝订单失败',
    }
  }
}

/**
 * 验证支付宝支付回调签名
 */
export function verifyAlipayCallback(params: any): boolean {
  try {
    return alipayClient.checkNotifySign(params)
  } catch (error) {
    console.error('验证支付宝签名失败:', error)
    return false
  }
}

/**
 * 查询支付订单状态
 */
export async function queryAlipayOrder(orderNumber: string) {
  try {
    const result = await alipayClient.exec('alipay.trade.query', {
      bizContent: {
        outTradeNo: orderNumber,
      },
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('查询支付宝订单失败:', error)
    return {
      success: false,
      error: '查询支付宝订单失败',
    }
  }
}

/**
 * 关闭支付订单
 */
export async function closeAlipayOrder(orderNumber: string) {
  try {
    const result = await alipayClient.exec('alipay.trade.close', {
      bizContent: {
        outTradeNo: orderNumber,
      },
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('关闭支付宝订单失败:', error)
    return {
      success: false,
      error: '关闭支付宝订单失败',
    }
  }
}
