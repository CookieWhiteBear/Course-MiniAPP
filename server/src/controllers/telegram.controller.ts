import type { Request, Response } from 'express'
import { logger } from '../utils/logger.js'
import { isAdminTelegramId } from '../utils/admin.js'
import { sendDashboardMessage, sendFallbackMessage, sendStartMessage, answerPreCheckoutQuery } from '../services/telegram-bot.service.js'
import { parseStarsPayload } from '../services/telegram-stars.service.js'
import { loadCourseMetadata } from '../services/filesystem-loader.js'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import { sendPurchaseConfirmationNotification } from '../services/telegram-notifications.service.js'

interface TelegramUpdate {
    message?: {
        text?: string
        chat?: {
            id: number
        }
        from?: {
            id: number
            language_code?: string
        }
        successful_payment?: {
            currency: string
            total_amount: number
            invoice_payload: string
            telegram_payment_charge_id?: string
            provider_payment_charge_id?: string
        }
    }
    pre_checkout_query?: {
        id: string
        invoice_payload: string
        currency: string
        total_amount: number
        from: {
            id: number
            language_code?: string
        }
    }
}

export async function handleTelegramWebhook(req: Request, res: Response) {
    const update = req.body as TelegramUpdate

    try {
        if (update.pre_checkout_query) {
            await handlePreCheckoutQuery(update.pre_checkout_query)
            return res.status(200).json({ ok: true })
        }

        const successfulPayment = update.message?.successful_payment
        if (successfulPayment) {
            await handleSuccessfulPayment(successfulPayment)
            return res.status(200).json({ ok: true })
        }

        const messageText = update.message?.text?.trim()
        const chatId = update.message?.chat?.id
        const senderId = update.message?.from?.id ?? chatId
        const languageCode = update.message?.from?.language_code

        if (typeof chatId !== 'number') {
            return res.status(200).json({ ok: true })
        }

        if (messageText?.startsWith('/dash')) {
            if (isAdminTelegramId(senderId)) {
                await sendDashboardMessage(chatId, languageCode)
            } else {
                await sendFallbackMessage(chatId, languageCode)
            }
        } else if (messageText?.startsWith('/start')) {
            await sendStartMessage(chatId, languageCode)
        } else if (messageText) {
            await sendFallbackMessage(chatId, languageCode)
        }
    } catch (error) {
        logger.error(
            'TelegramWebhookError',
            `Failed to process Telegram update: ${error instanceof Error ? error.message : String(error)}`
        )
    }

    res.status(200).json({ ok: true })
}

async function handlePreCheckoutQuery(preCheckoutQuery: {
    id: string
    invoice_payload: string
    currency: string
    total_amount: number
    from: { id: number }
}) {
    const payload = preCheckoutQuery.invoice_payload
    const parsed = parseStarsPayload(payload)

    if (!parsed) {
        await answerPreCheckoutQuery(preCheckoutQuery.id, false, 'Invalid payment payload')
        return
    }

    const { userId, courseId } = parsed
    const userRows = await query<Array<{ telegram_id: number }>>(
        'SELECT telegram_id FROM users WHERE id = ?',
        [userId]
    )

    if (userRows.length === 0 || userRows[0].telegram_id !== preCheckoutQuery.from.id) {
        await answerPreCheckoutQuery(preCheckoutQuery.id, false, 'Invalid user')
        return
    }

    if (preCheckoutQuery.currency !== 'XTR') {
        await answerPreCheckoutQuery(preCheckoutQuery.id, false, 'Invalid currency')
        return
    }

    const meta = await loadCourseMetadata(courseId)
    const starsPriceValue = meta?.starsPrice
    const starsPrice = Number(starsPriceValue)

    if (!Number.isFinite(starsPrice) || !Number.isInteger(starsPrice) || starsPrice <= 0) {
        await answerPreCheckoutQuery(preCheckoutQuery.id, false, 'Stars price not configured')
        return
    }

    if (preCheckoutQuery.total_amount !== starsPrice) {
        await answerPreCheckoutQuery(preCheckoutQuery.id, false, 'Price mismatch')
        return
    }

    const purchased = await query<any[]>(
        'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
        [userId, courseId]
    )

    if (purchased.length > 0) {
        await answerPreCheckoutQuery(preCheckoutQuery.id, false, 'Course already purchased')
        return
    }

    const pending = await query<Array<{ id: number }>>(
        `SELECT id FROM transactions
         WHERE user_id = ? AND course_id = ? AND status = 'pending' AND payment_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, courseId, payload]
    )

    if (pending.length === 0) {
        await answerPreCheckoutQuery(preCheckoutQuery.id, false, 'Invoice not found')
        return
    }

    await answerPreCheckoutQuery(preCheckoutQuery.id, true)
}

async function handleSuccessfulPayment(successfulPayment: {
    currency: string
    total_amount: number
    invoice_payload: string
    telegram_payment_charge_id?: string
    provider_payment_charge_id?: string
}) {
    const payload = successfulPayment.invoice_payload
    const parsed = parseStarsPayload(payload)

    if (!parsed) {
        logger.warn('StarsPaymentInvalidPayload', `Invalid stars payload: ${payload}`)
        return
    }

    const { userId, courseId } = parsed
    const meta = await loadCourseMetadata(courseId)
    if (!meta) {
        logger.error('StarsCourseMetadataMissing', `Course ${courseId} metadata missing for stars payment`)
        return
    }

    const existing = await query<Array<{ id: number }>>(
        'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
        [userId, courseId]
    )

    if (existing.length === 0) {
        await query(
            `INSERT INTO user_courses (user_id, course_id, purchased_at)
             VALUES (?, ?, datetime('now'))`,
            [userId, courseId]
        )
    }

    const chargeId = successfulPayment.telegram_payment_charge_id || payload
    const pending = await query<Array<{ id: number }>>(
        `SELECT id FROM transactions
         WHERE user_id = ? AND course_id = ? AND status = 'pending' AND payment_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, courseId, payload]
    )

    if (pending.length > 0) {
        await query(
            `UPDATE transactions
             SET status = ?, payment_id = ?, amount = ?, currency = ?
             WHERE id = ?`,
            [
                'success',
                chargeId,
                successfulPayment.total_amount,
                successfulPayment.currency,
                pending[0].id
            ]
        )
    } else {
        await query(
            `INSERT INTO transactions (
                user_id, course_id, payment_id, amount, currency, status, type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                userId,
                courseId,
                chargeId,
                successfulPayment.total_amount,
                successfulPayment.currency,
                'success',
                'purchase'
            ]
        )
    }

    await cache.del(CACHE_KEYS.USER_COURSES(userId))
    await cache.del(CACHE_KEYS.USER(userId))

    try {
        await sendPurchaseConfirmationNotification(userId, meta.title)
    } catch (error) {
        logger.warn(
            'StarsTelegramNotificationFailed',
            `Failed to send stars confirmation: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}
