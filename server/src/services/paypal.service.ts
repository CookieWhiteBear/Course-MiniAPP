import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'

/**
 * PayPal Orders API v2 Service
 * Official documentation: https://developer.paypal.com/docs/api/orders/v2/
 */

const PAYPAL_API_BASE = config.paypal.mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

interface PayPalOrder {
    id: string
    status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED'
    links: Array<{
        href: string
        rel: string
        method: string
    }>
    purchase_units: Array<{
        reference_id: string
        amount: {
            currency_code: string
            value: string
        }
        payments?: {
            captures?: Array<{
                id: string
                status: string
                amount: {
                    currency_code: string
                    value: string
                }
            }>
        }
    }>
}

interface CreateOrderParams {
    amount: string
    currency: string
    description: string
    custom_id: string
    return_url?: string
    cancel_url?: string
}

/**
 * Get PayPal access token
 * Uses Basic Auth with Client ID and Secret
 */
async function getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${config.paypal.clientId}:${config.paypal.secret}`).toString('base64')

    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`PayPal auth error (${response.status}): ${errorText}`)
    }

    const data = await response.json() as { access_token: string }
    return data.access_token
}

/**
 * Create PayPal order
 * POST /v2/checkout/orders
 */
export async function createOrder(params: CreateOrderParams): Promise<{
    orderId: string
    approveUrl: string
    amount: string
    currency: string
}> {
    const accessToken = await getAccessToken()

    const requestBody = {
        intent: 'CAPTURE',
        purchase_units: [{
            reference_id: params.custom_id,
            description: params.description,
            custom_id: params.custom_id,
            amount: {
                currency_code: params.currency,
                value: params.amount
            }
        }],
        application_context: {
            return_url: params.return_url || `${config.frontendUrl}/`,
            cancel_url: params.cancel_url || `${config.frontendUrl}/`,
            brand_name: 'Course Platform',
            landing_page: 'LOGIN', // Show PayPal login page (light theme)
            user_action: 'PAY_NOW'
        }
    }

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`PayPal create order error (${response.status}): ${errorText}`)
    }

    const order = await response.json() as PayPalOrder

    // Find approve URL
    const approveLink = order.links.find(link => link.rel === 'approve')
    if (!approveLink) {
        throw new Error('PayPal approve link not found in response')
    }

    // Force light theme by adding color_scheme parameter
    const approveUrl = new URL(approveLink.href)
    approveUrl.searchParams.set('locale', 'uk_UA') // Ukrainian locale
    approveUrl.searchParams.set('buyer-country', 'UA')

    // Try to force light theme (PayPal may override based on device settings)
    const finalApproveUrl = approveUrl.toString()

    logger.info('OrderCreated', `PayPal order ${order.id} created successfully for amount ${params.amount} ${params.currency}`)

    return {
        orderId: order.id,
        approveUrl: finalApproveUrl,
        amount: params.amount,
        currency: params.currency
    }
}

/**
 * Capture payment for order
 * POST /v2/checkout/orders/{id}/capture
 */
export async function captureOrder(orderId: string): Promise<{
    captureId: string
    status: string
    amount: string
    currency: string
}> {
    const accessToken = await getAccessToken()

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`PayPal capture error (${response.status}): ${errorText}`)
    }

    const order = await response.json() as PayPalOrder
    const capture = order.purchase_units[0]?.payments?.captures?.[0]

    if (!capture) {
        throw new Error('PayPal capture data not found in response')
    }

    logger.info('PaymentCaptured', `PayPal payment ${capture.id} captured successfully, amount ${capture.amount.value} ${capture.amount.currency_code}, status ${capture.status}`)

    return {
        captureId: capture.id,
        status: capture.status,
        amount: capture.amount.value,
        currency: capture.amount.currency_code
    }
}

/**
 * Verify PayPal webhook signature
 * https://developer.paypal.com/api/rest/webhooks/rest/#verify-webhook-signature
 */
export async function verifyWebhookSignature(
    headers: Record<string, string>,
    body: string,
    webhookId: string
): Promise<boolean> {
    const accessToken = await getAccessToken()

    const verificationData = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(body)
    }

    const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(verificationData)
    })

    if (!response.ok) {
        const errorText = await response.text()
        logger.error('WebhookVerificationFailed', `PayPal webhook verification failed with response: ${errorText}`)
        return false
    }

    const result = await response.json() as { verification_status: string }
    return result.verification_status === 'SUCCESS'
}
