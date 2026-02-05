import { query } from '../config/database.js'
import { sendTelegramMessage } from './telegram-bot.service.js'
import { logger } from '../utils/logger.js'
import { buildWebAppUrl } from '../utils/webapp-url.js'

interface TelegramUserRow {
    telegram_id: number | null
    has_started?: number | null
}

export async function notifyNewSupportMessage(
    recipientUserId: number,
    senderName: string
): Promise<void> {
    try {
        const rows = await query<TelegramUserRow[]>(
            'SELECT telegram_id, has_started FROM users WHERE id = ?',
            [recipientUserId]
        )

        const telegramId = rows[0]?.telegram_id
        const hasStarted = rows[0]?.has_started === 1
        if (!telegramId || !hasStarted) return

        const text = `You have a new support message!

From: ${senderName}

Open the app to view it.`

        const replyMarkup = {
            inline_keyboard: [[
                {
                    text: 'Open ticket',
                    web_app: {
                        url: buildWebAppUrl('/support')
                    }
                }
            ]]
        }

        await sendTelegramMessage(telegramId, text, replyMarkup)
    } catch (error) {
        logger.error(
            'SupportNotificationFailed',
            `Failed to send support notification: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}
