import { Wechatpay, getPublicKey } from 'wechatpay-node-v3'

// 微信支付配置
let wechatpayClient: Wechatpay | null = null

function getWechatpayClient() {
  if (!wechatpayClient && process.env.WECHAT_APP_ID) {
    wechatpayClient = new Wechatpay({
      appid: process.env.WECHAT_APP_ID,
      mchid: process.env.WECHAT_MCH_ID || '',
      private_key: process.env.WECHAT_API_KEY || '',
      serial_no: process.env.WECHAT_SERIAL_NO || '',
    })
  }
  return wechatpayClient
}

export interface WechatCreateOrderParams {
  orderNumber: string
  totalAmount: number
  description: string
  openid?: string // 用户的openid（公众号/小程序支付需要）
}

/**
 * 创建微信支付订单（H5支付）
 */
export async function createWechatOrder(params: WechatCreateOrderParams) {
  try {
    const client = getWechatpayClient()
    if (!client) {
      throw new Error('微信支付未配置')
    }

    const result = await client.transactions_h5({
      appid: process.env.WECHAT_APP_ID!,
      mchid: process.env.WECHAT_MCH_ID!,
      description: params.description,
      out_trade_no: params.orderNumber,
      notify_url: `${process.env.NEXTAUTH_URL}/api/payment/callback/wechat`,
      amount: {
        total: Math.round(params.totalAmount * 100), // 转换为分
        currency: 'CNY',
      },
      scene_info: {
        payer_client_ip: '127.0.0.1',
        h5_info: {
          type: 'Wap',
        },
      },
    })

    return {
      success: true,
      paymentUrl: result.h5_url,
    }
  } catch (error) {
    console.error('创建微信支付订单失败:', error)
    return {
      success: false,
      error: '创建微信支付订单失败',
    }
  }
}

/**
 * 创建微信JSAPI支付订单（公众号/小程序）
 */
export async function createWechatJsapiOrder(params: WechatCreateOrderParams) {
  try {
    const client = getWechatpayClient()
    if (!client) {
      throw new Error('微信支付未配置')
    }

    if (!params.openid) {
      throw new Error('JSAPI支付需要用户openid')
    }

    const result = await client.transactions_jsapi({
      appid: process.env.WECHAT_APP_ID!,
      mchid: process.env.WECHAT_MCH_ID!,
      description: params.description,
      out_trade_no: params.orderNumber,
      notify_url: `${process.env.NEXTAUTH_URL}/api/payment/callback/wechat`,
      amount: {
        total: Math.round(params.totalAmount * 100), // 转换为分
        currency: 'CNY',
      },
      payer: {
        openid: params.openid,
      },
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('创建微信JSAPI支付订单失败:', error)
    return {
      success: false,
      error: '创建微信JSAPI支付订单失败',
    }
  }
}

/**
 * 查询微信支付订单状态
 */
export async function queryWechatOrder(orderNumber: string) {
  try {
    const client = getWechatpayClient()
    if (!client) {
      throw new Error('微信支付未配置')
    }

    const result = await client.query({
      out_trade_no: orderNumber,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('查询微信支付订单失败:', error)
    return {
      success: false,
      error: '查询微信支付订单失败',
    }
  }
}

/**
 * 关闭微信支付订单
 */
export async function closeWechatOrder(orderNumber: string) {
  try {
    const client = getWechatpayClient()
    if (!client) {
      throw new Error('微信支付未配置')
    }

    const result = await client.close({
      out_trade_no: orderNumber,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('关闭微信支付订单失败:', error)
    return {
      success: false,
      error: '关闭微信支付订单失败',
    }
  }
}

/**
 * 验证微信支付回调签名
 */
export function verifyWechatCallback(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  serial: string
): boolean {
  try {
    const client = getWechatpayClient()
    if (!client) {
      return false
    }

    return client.verifySign({
      timestamp,
      nonce,
      body,
      signature,
      serial,
    })
  } catch (error) {
    console.error('验证微信支付签名失败:', error)
    return false
  }
}
