import { config } from '../config/env.js'

export function isAdminTelegramId(telegramId?: number | null): boolean {
    return !!telegramId && config.adminTelegramIds.includes(telegramId)
}
