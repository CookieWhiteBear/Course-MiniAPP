import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { botT } from '../utils/bot-i18n.js'

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot'

interface TelegramApiResponse<T> {
    ok: boolean
    result: T
    description?: string
}

interface TelegramMessage {
    message_id: number
    chat: {
        id: number
    }
    text?: string
}

interface TelegramInlineKeyboardButton {
    text: string
    web_app?: {
        url: string
    }
}

interface TelegramInlineKeyboardMarkup {
    inline_keyboard: TelegramInlineKeyboardButton[][]
}

type TelegramReplyMarkup = TelegramInlineKeyboardMarkup

interface TelegramLabeledPrice {
    label: string
    amount: number
}

async function callTelegramApi<T>(
    method: string,
    payload: Record<string, unknown>
): Promise<T | null> {
    const token = config.telegram.botToken
    if (!token) {
        logger.warn('TelegramNotConfigured', 'Telegram bot token not configured')
        return null
    }

    try {
        const response = await fetch(`${TELEGRAM_API_BASE}${token}/${method}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json() as TelegramApiResponse<T>
        if (!response.ok || !data.ok) {
            logger.error(
                'TelegramApiError',
                `Telegram API ${method} failed: ${data.description || response.statusText}`
            )
            return null
        }

        return data.result
    } catch (error) {
        logger.error(
            'TelegramApiError',
            `Telegram API ${method} request failed: ${error instanceof Error ? error.message : String(error)}`
        )
        return null
    }
}

export async function sendTelegramMessage(
    chatId: number,
    text: string,
    replyMarkup?: TelegramReplyMarkup
): Promise<TelegramMessage | null> {
    const payload: Record<string, unknown> = {
        chat_id: chatId,
        text
    }

    if (replyMarkup) {
        payload.reply_markup = replyMarkup
    }

    return await callTelegramApi<TelegramMessage>('sendMessage', payload)
}

export async function editTelegramMessageText(
    chatId: number,
    messageId: number,
    text: string,
    replyMarkup?: TelegramReplyMarkup
): Promise<TelegramMessage | null> {
    const payload: Record<string, unknown> = {
        chat_id: chatId,
        message_id: messageId,
        text
    }

    if (replyMarkup) {
        payload.reply_markup = replyMarkup
    }

    return await callTelegramApi<TelegramMessage>('editMessageText', payload)
}

export async function sendStartMessage(chatId: number, languageCode?: string): Promise<TelegramMessage | null> {
    const replyMarkup: TelegramReplyMarkup = {
        inline_keyboard: [[
            {
                text: botT(languageCode, 'start.button'),
                web_app: {
                    url: config.frontendUrl
                }
            }
        ]]
    }

    const text = botT(languageCode, 'start.message')
    return await sendTelegramMessage(chatId, text, replyMarkup)
}

export async function sendFallbackMessage(chatId: number, languageCode?: string): Promise<TelegramMessage | null> {
    const replyMarkup: TelegramReplyMarkup = {
        inline_keyboard: [[
            {
                text: botT(languageCode, 'fallback.button'),
                web_app: {
                    url: config.frontendUrl
                }
            }
        ]]
    }

    const text = botT(languageCode, 'fallback.message')
    return await sendTelegramMessage(chatId, text, replyMarkup)
}

export async function sendDashboardMessage(chatId: number, languageCode?: string): Promise<TelegramMessage | null> {
    const replyMarkup: TelegramReplyMarkup = {
        inline_keyboard: [[
            {
                text: botT(languageCode, 'dashboard.button'),
                web_app: {
                    url: `${config.frontendUrl}/dash`
                }
            }
        ]]
    }

    const text = botT(languageCode, 'dashboard.message')
    return await sendTelegramMessage(chatId, text, replyMarkup)
}

export async function createTelegramInvoiceLink(payload: {
    title: string
    description: string
    payload: string
    currency: string
    prices: TelegramLabeledPrice[]
    providerToken?: string
}): Promise<string | null> {
    const requestPayload: Record<string, unknown> = {
        title: payload.title,
        description: payload.description,
        payload: payload.payload,
        currency: payload.currency,
        prices: payload.prices,
        provider_token: payload.providerToken ?? ''
    }

    return await callTelegramApi<string>('createInvoiceLink', requestPayload)
}

export async function answerPreCheckoutQuery(
    preCheckoutQueryId: string,
    ok: boolean,
    errorMessage?: string
): Promise<boolean | null> {
    const requestPayload: Record<string, unknown> = {
        pre_checkout_query_id: preCheckoutQueryId,
        ok
    }

    if (!ok && errorMessage) {
        requestPayload.error_message = errorMessage
    }

    return await callTelegramApi<boolean>('answerPreCheckoutQuery', requestPayload)
}

export async function registerTelegramWebhook(webhookUrl?: string): Promise<boolean> {
    if (!webhookUrl) {
        logger.warn('TelegramWebhookSkipped', 'Telegram webhook URL not configured')
        return false
    }

    const result = await callTelegramApi<boolean>('setWebhook', { url: webhookUrl })
    if (result) {
        logger.success('TelegramWebhookRegistered', `Webhook registered: ${webhookUrl}`)
        return true
    }

    logger.warn('TelegramWebhookFailed', 'Failed to register Telegram webhook')
    return false
}
