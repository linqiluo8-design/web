import paypal from '@paypal/checkout-server-sdk'

// PayPal配置
function getPayPalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID || ''
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || ''
  const mode = process.env.PAYPAL_MODE || 'sandbox'

  const environment =
    mode === 'production'
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret)

  return new paypal.core.PayPalHttpClient(environment)
}

export interface PayPalCreateOrderParams {
  orderNumber: string
  totalAmount: number
  description: string
  currency?: string
}

/**
 * 创建PayPal支付订单
 */
export async function createPayPalOrder(params: PayPalCreateOrderParams) {
  try {
    const client = getPayPalClient()
    const request = new paypal.orders.OrdersCreateRequest()

    request.prefer('return=representation')
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.orderNumber,
          description: params.description,
          amount: {
            currency_code: params.currency || 'USD',
            value: params.totalAmount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: `${process.env.NEXTAUTH_URL}/payment/callback/paypal?success=true`,
        cancel_url: `${process.env.NEXTAUTH_URL}/payment/callback/paypal?success=false`,
        brand_name: '知识付费平台',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
      },
    })

    const response = await client.execute(request)

    // 获取审批链接
    const approvalUrl = response.result.links?.find(
      (link: any) => link.rel === 'approve'
    )?.href

    return {
      success: true,
      orderId: response.result.id,
      paymentUrl: approvalUrl,
      data: response.result,
    }
  } catch (error) {
    console.error('创建PayPal订单失败:', error)
    return {
      success: false,
      error: '创建PayPal订单失败',
    }
  }
}

/**
 * 捕获PayPal支付
 */
export async function capturePayPalOrder(paypalOrderId: string) {
  try {
    const client = getPayPalClient()
    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId)
    request.requestBody({})

    const response = await client.execute(request)

    return {
      success: true,
      data: response.result,
    }
  } catch (error) {
    console.error('捕获PayPal支付失败:', error)
    return {
      success: false,
      error: '捕获PayPal支付失败',
    }
  }
}

/**
 * 查询PayPal订单状态
 */
export async function queryPayPalOrder(paypalOrderId: string) {
  try {
    const client = getPayPalClient()
    const request = new paypal.orders.OrdersGetRequest(paypalOrderId)

    const response = await client.execute(request)

    return {
      success: true,
      data: response.result,
    }
  } catch (error) {
    console.error('查询PayPal订单失败:', error)
    return {
      success: false,
      error: '查询PayPal订单失败',
    }
  }
}

/**
 * 退款PayPal订单
 */
export async function refundPayPalOrder(captureId: string, amount?: number) {
  try {
    const client = getPayPalClient()
    const request = new paypal.payments.CapturesRefundRequest(captureId)

    if (amount) {
      request.requestBody({
        amount: {
          value: amount.toFixed(2),
          currency_code: 'USD',
        },
      })
    }

    const response = await client.execute(request)

    return {
      success: true,
      data: response.result,
    }
  } catch (error) {
    console.error('退款PayPal订单失败:', error)
    return {
      success: false,
      error: '退款PayPal订单失败',
    }
  }
}
