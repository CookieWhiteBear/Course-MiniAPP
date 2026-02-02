import type { Request, Response, NextFunction } from 'express'
import { config } from '../config/env.js'
import { createError } from './error.middleware.js'

/**
 * Admin middleware - verifies user has admin privileges
 * Admin status is determined ONLY by telegram ID being in adminTelegramIds config
 *
 * SECURITY: Header-based admin bypass has been removed to prevent authorization bypass attacks
 */
export function adminMiddleware(req: Request, _res: Response, next: NextFunction) {
    const telegramId = req.telegramId ?? req.user?.telegram_id

    // In demo mode with demo users (negative telegram_id), allow admin access
    // only if explicitly configured in adminTelegramIds or if the list is empty (development convenience)
    if (config.demoMode && telegramId && telegramId < 0) {
        // Allow demo admin only in development with empty admin list
        if (config.nodeEnv !== 'production' && config.adminTelegramIds.length === 0) {
            return next()
        }
    }

    if (!telegramId || !config.adminTelegramIds.includes(telegramId)) {
        return next(createError('Admin access required', 403))
    }

    next()
}
