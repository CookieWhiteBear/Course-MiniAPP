import { query } from '../config/database.js'
import { logger } from '../utils/logger.js'
import { editTelegramMessageText, sendTelegramMessage } from './telegram-bot.service.js'
import { botT } from '../utils/bot-i18n.js'

interface TelegramUserRow {
    telegram_id: number
    notifications_enabled: number
    language_code: string | null
}

async function getUserForNotification(userId: number): Promise<TelegramUserRow | null> {
    const rows = await query<TelegramUserRow[]>(
        'SELECT telegram_id, notifications_enabled, language_code FROM users WHERE id = ?',
        [userId]
    )

    if (rows.length === 0) {
        logger.warn('TelegramUserMissing', `User ${userId} not found for notifications`)
        return null
    }

    if (rows[0].notifications_enabled === 0) {
        logger.info('TelegramNotificationsDisabled', `User ${userId} has notifications disabled`)
        return null
    }

    return rows[0]
}

export async function sendPurchaseProcessingNotification(
    userId: number,
    courseTitle: string
): Promise<number | null> {
    const user = await getUserForNotification(userId)
    if (!user) return null

    const text = botT(user.language_code, 'purchase.processing', { course: courseTitle })
    const message = await sendTelegramMessage(user.telegram_id, text)

    return message?.message_id || null
}

export async function sendPurchaseConfirmationNotification(
    userId: number,
    courseTitle: string,
    messageId?: number | null
): Promise<void> {
    const user = await getUserForNotification(userId)
    if (!user) return

    if (messageId) {
        const text = botT(user.language_code, 'purchase.confirmed', { course: courseTitle })
        const updated = await editTelegramMessageText(user.telegram_id, messageId, text)

        if (updated) {
            return
        }
    }

    const text = botT(user.language_code, 'purchase.success', { course: courseTitle })
    await sendTelegramMessage(user.telegram_id, text)
}
