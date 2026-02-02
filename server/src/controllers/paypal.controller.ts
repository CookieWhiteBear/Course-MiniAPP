import type { Request, Response, NextFunction } from 'express'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import { config } from '../config/env.js'
import { createError } from '../middleware/error.middleware.js'
import * as paypalService from '../services/paypal.service.js'
import { sendPurchaseConfirmationNotification, sendPurchaseProcessingNotification } from '../services/telegram-notifications.service.js'
import { logger } from '../utils/logger.js'
import { COURSES_DIR, loadCourseMetadata } from '../services/filesystem-loader.js'
import { stat } from 'fs/promises'
import path from 'path'
/**
 * PayPal Webhook Event Types
 * https://developer.paypal.com/api/rest/webhooks/event-names/
 */
interface PayPalWebhookEvent {
    id: string
    event_version: string
    create_time: string
    resource_type: string
    event_type: 'PAYMENT.CAPTURE.COMPLETED' | 'PAYMENT.CAPTURE.DENIED' | 'PAYMENT.CAPTURE.REFUNDED' | 'CHECKOUT.ORDER.APPROVED'
    summary: string
    resource: {
        id: string
        status?: string
        amount?: {
            currency_code: string
            value: string
        }
        custom_id?: string
        supplementary_data?: {
            related_ids?: {
                order_id?: string
            }
        }
    }
}

/**
 * GET /api/webhooks/paypal/test
 * Test webhook endpoint accessibility
 */
export async function testWebhookEndpoint(
    _req: Request,
    res: Response
) {
    logger.info('WebhookTest', `Webhook test endpoint accessed successfully`)
    res.json({
        success: true,
        message: 'PayPal webhook endpoint is accessible',
        timestamp: new Date().toISOString(),
        server: 'running'
    })
}

/**
 * POST /api/webhooks/paypal
 * Handle PayPal webhook events
 */
export async function handlePayPalWebhook(
    req: Request,
    res: Response,
    _next: NextFunction
) {
    try {
        const rawBody = JSON.stringify(req.body)
        const event = req.body as PayPalWebhookEvent

        logger.info('WebhookReceived', `PayPal webhook event_type=${event.event_type} event_id=${event.id} resource_id=${event.resource?.id} custom_id=${event.resource?.custom_id || 'none'}`)

        // Verify webhook signature - ALWAYS verify when webhookId is configured
        // SECURITY: Skipping verification allows payment fraud attacks
        if (config.paypal.webhookId) {
            const headers: Record<string, string> = {
                'paypal-auth-algo': req.headers['paypal-auth-algo'] as string,
                'paypal-cert-url': req.headers['paypal-cert-url'] as string,
                'paypal-transmission-id': req.headers['paypal-transmission-id'] as string,
                'paypal-transmission-sig': req.headers['paypal-transmission-sig'] as string,
                'paypal-transmission-time': req.headers['paypal-transmission-time'] as string
            }

            const isValid = await paypalService.verifyWebhookSignature(
                headers,
                rawBody,
                config.paypal.webhookId
            )

            if (!isValid) {
                logger.error('WebhookSignatureInvalid', 'PayPal webhook signature verification failed')
                return res.status(401).json({ error: 'Invalid signature' })
            }

            logger.info('WebhookSignatureVerified', 'PayPal webhook signature verified successfully')
        } else if (config.nodeEnv === 'production') {
            // In production, webhookId MUST be configured
            logger.error('WebhookIdMissing', 'PayPal webhook ID not configured in production - rejecting webhook')
            return res.status(500).json({ error: 'Webhook verification not configured' })
        } else {
            // Development only: allow without verification but log warning
            logger.warn('WebhookVerificationSkipped', 'DEV ONLY: Skipping webhook verification - configure paypal.webhookId for security')
        }

        // Route to appropriate handler
        switch (event.event_type) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                await handlePaymentCaptureCompleted(event)
                break

            case 'PAYMENT.CAPTURE.DENIED':
                await handlePaymentCaptureDenied(event)
                break

            case 'PAYMENT.CAPTURE.REFUNDED':
                await handlePaymentCaptureRefunded(event)
                break

            case 'CHECKOUT.ORDER.APPROVED':
                // Order approved - automatically capture payment
                logger.info('OrderApproved', `Order ${event.resource.id} approved, capturing payment automatically`)
                await handleCheckoutOrderApproved(event)
                break

            default:
                logger.info('UnhandledEventType', `PayPal event type ${event.event_type} not handled by webhook processor`)
        }

        // Always respond with 200 OK
        res.status(200).json({ received: true })
    } catch (error) {
        logger.error('WebhookProcessingError', `PayPal webhook processing failed with error: ${error instanceof Error ? error.message : String(error)}`)
        // Still respond with 200 to avoid retries
        res.status(200).json({ received: true, error: 'processed with error' })
    }
}

/**
 * Handle CHECKOUT.ORDER.APPROVED event
 * Automatically capture payment when order is approved
 */
async function handleCheckoutOrderApproved(event: PayPalWebhookEvent) {
    const orderId = event.resource.id

    try {
        logger.info('CapturingPayment', `Initiating payment capture for order ${orderId}`)

        const captureResult = await paypalService.captureOrder(orderId)

        logger.info('PaymentCapturedFromOrder', `Payment captured successfully for order ${orderId}, capture_id ${captureResult.captureId}, amount ${captureResult.amount} ${captureResult.currency}`)

        // Now process as if we received PAYMENT.CAPTURE.COMPLETED
        const captureEvent: PayPalWebhookEvent = {
            ...event,
            event_type: 'PAYMENT.CAPTURE.COMPLETED',
            resource: {
                ...event.resource,
                id: captureResult.captureId,
                amount: {
                    currency_code: captureResult.currency,
                    value: captureResult.amount
                }
            }
        }

        await handlePaymentCaptureCompleted(captureEvent)
    } catch (error) {
        logger.error('PaymentCaptureFailure', `Failed to capture payment for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`)
        // Don't throw - we want to return 200 to PayPal
    }
}

/**
 * Handle PAYMENT.CAPTURE.COMPLETED event
 * Grant course access to user
 */
async function handlePaymentCaptureCompleted(event: PayPalWebhookEvent) {
    const captureId = event.resource.id
    const customId = event.resource.custom_id
    const orderId = event.resource.supplementary_data?.related_ids?.order_id

    if (!customId) {
        logger.error('MissingCustomId', `PayPal webhook missing custom_id field, cannot identify user and course for capture ${captureId}`)
        return
    }

    // Parse custom_id: "user_1_course_1"
    const match = customId.match(/user_(\d+)_course_(\d+)/)
    if (!match) {
        logger.error('InvalidCustomIdFormat', `PayPal webhook custom_id has invalid format: ${customId}, expected format user_X_course_Y`)
        return
    }

    const userId = parseInt(match[1], 10)
    const courseId = parseInt(match[2], 10)

    logger.info('ProcessingPayment', `Processing completed payment for user_id ${userId}, course_id ${courseId}, capture_id ${captureId}`)

    // Check if course exists in filesystem
    const courseDir = path.join(COURSES_DIR, courseId.toString())
    try {
        await stat(courseDir)
    } catch {
        logger.error('CourseNotFound', `Course ${courseId} not found in filesystem, cannot grant access for payment ${captureId}`)
        return
    }

    // Load course metadata
    const meta = await loadCourseMetadata(courseId)
    if (!meta) {
        logger.error('CourseMetadataNotFound', `Course ${courseId} metadata not found, cannot grant access for payment ${captureId}`)
        return
    }

    const course = {
        id: courseId,
        title: meta.title,
        price: meta.price || 8.00
    }

    // Check if already granted access
    const existing = await query<Array<{ id: number }>>(
        'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
        [userId, courseId]
    )

    if (existing.length > 0) {
        logger.warn('DuplicateAccess', `User ${userId} already has access to course ${courseId}, skipping duplicate grant for payment ${captureId}`)
        return
    }

    // Grant access
    await query(
        `INSERT INTO user_courses (user_id, course_id, purchased_at) VALUES (?, ?, datetime('now'))`,
        [userId, courseId]
    )

    const paymentAmount = event.resource.amount?.value || course.price
    const paymentCurrency = event.resource.amount?.currency_code || 'USD'
    let notificationMessageId: number | null = null
    let updatedTransaction = false

    if (orderId) {
        const pending = await query<Array<{ id: number, notification_message_id: number | null }>>(
            `SELECT id, notification_message_id
             FROM transactions
             WHERE user_id = ? AND course_id = ? AND status = 'pending' AND payment_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId, courseId, orderId]
        )

        if (pending.length > 0) {
            notificationMessageId = pending[0].notification_message_id
            await query(
                `UPDATE transactions
                 SET status = ?, payment_id = ?, amount = ?, currency = ?
                 WHERE id = ?`,
                ['success', captureId, paymentAmount, paymentCurrency, pending[0].id]
            )
            updatedTransaction = true
        }
    }

    if (!updatedTransaction) {
        await query(
            `INSERT INTO transactions (
                user_id, course_id, payment_id, amount, currency, status, type, notification_message_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                userId,
                courseId,
                captureId,
                paymentAmount,
                paymentCurrency,
                'success',
                'purchase',
                null
            ]
        )
    }

    // Invalidate cache
    await cache.del(CACHE_KEYS.USER_COURSES(userId))
    await cache.del(CACHE_KEYS.USER(userId))

    try {
        await sendPurchaseConfirmationNotification(userId, course.title, notificationMessageId)
    } catch (error) {
        logger.warn(
            'TelegramNotificationFailed',
            `Failed to send purchase confirmation: ${error instanceof Error ? error.message : String(error)}`
        )
    }

    logger.info('AccessGranted', `Access granted to user ${userId} for course ${courseId} "${course.title}", payment ${captureId}, amount ${paymentAmount} ${paymentCurrency}`)
}

/**
 * Handle PAYMENT.CAPTURE.DENIED event
 * Log failed payment
 */
async function handlePaymentCaptureDenied(event: PayPalWebhookEvent) {
    const captureId = event.resource.id
    const customId = event.resource.custom_id

    logger.warn('PaymentDenied', `PayPal payment capture denied, capture_id ${captureId}, custom_id ${customId || 'none'}`)

    if (!customId) return

    const match = customId.match(/user_(\d+)_course_(\d+)/)
    if (!match) return

    const userId = parseInt(match[1], 10)
    const courseId = parseInt(match[2], 10)

    // Record failed transaction
    await query(
        `INSERT INTO transactions (
            user_id, course_id, payment_id, amount, currency, status, type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
            userId,
            courseId,
            captureId,
            event.resource.amount?.value || 0,
            event.resource.amount?.currency_code || 'USD',
            'failed',
            'purchase'
        ]
    )

    logger.info('FailedTransactionRecorded', `Failed transaction recorded for user ${userId}, course ${courseId}, capture ${captureId}`)
}

/**
 * Handle PAYMENT.CAPTURE.REFUNDED event
 * Revoke course access
 */
async function handlePaymentCaptureRefunded(event: PayPalWebhookEvent) {
    const captureId = event.resource.id
    const customId = event.resource.custom_id

    logger.info('PaymentRefunded', `PayPal payment refunded, capture_id ${captureId}, custom_id ${customId || 'none'}`)

    if (!customId) return

    const match = customId.match(/user_(\d+)_course_(\d+)/)
    if (!match) return

    const userId = parseInt(match[1], 10)
    const courseId = parseInt(match[2], 10)

    // Revoke access
    await query(
        'DELETE FROM user_courses WHERE user_id = ? AND course_id = ?',
        [userId, courseId]
    )

    // Record refund transaction
    await query(
        `INSERT INTO transactions (
            user_id, course_id, payment_id, amount, currency, status, type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
            userId,
            courseId,
            captureId,
            event.resource.amount?.value || 0,
            event.resource.amount?.currency_code || 'USD',
            'refunded',
            'refund'
        ]
    )

    // Invalidate cache
    await cache.del(CACHE_KEYS.USER_COURSES(userId))

    logger.info('AccessRevoked', `Access revoked and refund processed for user ${userId}, course ${courseId}, capture ${captureId}`)
}

/**
 * POST /api/purchase/create
 * Create PayPal order for course purchase
 */
export async function createPurchaseOrder(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const courseId = parseInt(req.body.courseId, 10)

        if (!courseId || isNaN(courseId)) {
            throw createError('Invalid course ID', 400)
        }

        // Check if course exists in filesystem
        const courseDir = path.join(COURSES_DIR, courseId.toString())
        try {
            await stat(courseDir)
        } catch {
            throw createError('Course not found', 404)
        }

        // Load course metadata
        const meta = await loadCourseMetadata(courseId)
        if (!meta) {
            throw createError('Course not found', 404)
        }

        const course = {
            id: courseId,
            title: meta.title,
            price: meta.price || 8.00
        }

        // Check if already purchased
        const purchased = await query<any[]>(
            'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        )

        if (purchased.length > 0) {
            throw createError('Course already purchased', 400)
        }

        // Create PayPal order
        const customId = `user_${user.id}_course_${courseId}`

        const order = await paypalService.createOrder({
            amount: course.price.toFixed(2),
            currency: 'USD',
            description: course.title,
            custom_id: customId,
            return_url: `${config.frontendUrl}/purchase/success`,
            cancel_url: `${config.frontendUrl}/purchase/cancelled`
        })

        let notificationMessageId: number | null = null
        try {
            notificationMessageId = await sendPurchaseProcessingNotification(user.id, course.title)
        } catch (error) {
            logger.warn(
                'TelegramNotificationFailed',
                `Failed to send purchase processing notification: ${error instanceof Error ? error.message : String(error)}`
            )
        }

        await query(
            `INSERT INTO transactions (
                user_id, course_id, payment_id, amount, currency, status, type, notification_message_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                courseId,
                order.orderId,
                course.price,
                order.currency,
                'pending',
                'purchase',
                notificationMessageId
            ]
        )

        logger.info('PurchaseOrderCreated', `PayPal order ${order.orderId} created for user ${user.id}, course ${courseId} "${course.title}", amount ${order.amount} ${order.currency}`)

        res.json({
            success: true,
            data: {
                orderId: order.orderId,
                approveUrl: order.approveUrl,
                price: course.price,
                amount: order.amount,
                currency: order.currency
            }
        })
    } catch (error) {
        logger.error('PurchaseOrderCreationFailed', `Failed to create PayPal order: ${error instanceof Error ? error.message : String(error)}`)
        next(error)
    }
}
