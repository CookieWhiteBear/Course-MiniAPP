import type { Request, Response, NextFunction } from 'express'
import { validate } from '@telegram-apps/init-data-node'
import { config } from '../config/env.js'
import { createError } from './error.middleware.js'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import type { User } from '../types/models.js'
import { logger } from '../utils/logger.js'

const DEMO_AVATAR_URL = 'https://i.imgur.com/zOlPMhT.png'

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: User
            telegramId?: number
            userId?: number
        }
    }
}

function hashDemoId(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i)
        hash |= 0
    }
    const abs = Math.abs(hash)
    return abs === 0 ? 1 : abs
}

function getDemoTelegramId(req: Request): number {
    const raw = (req.headers['x-demo-user'] as string | undefined) || ''
    if (raw) {
        const numeric = Number(raw)
        const base = Number.isFinite(numeric) ? Math.trunc(numeric) : hashDemoId(raw)
        return -Math.abs(base || 1)
    }
    return -1
}

function getDemoIndex(demoTelegramId: number): number {
    const base = Math.abs(demoTelegramId)
    return (base % 9) + 1
}

async function getOrCreateDemoUser(req: Request): Promise<User> {
    const demoTelegramId = getDemoTelegramId(req)
    const demoIndex = getDemoIndex(demoTelegramId)
    const username = `demo_${demoIndex}`
    const firstName = 'Demo'
    const lastName = String(demoIndex)
    const cached = await cache.get<User>(CACHE_KEYS.USER(demoTelegramId))
    if (cached) return cached

    const now = new Date()
    const user: User = {
        id: Math.abs(demoTelegramId),
        telegram_id: demoTelegramId,
        username,
        first_name: firstName,
        last_name: lastName,
        photo_url: DEMO_AVATAR_URL,
        notifications_enabled: true,
        has_started: 1,
        created_at: now,
        updated_at: now
    }

    await cache.set(CACHE_KEYS.USER(demoTelegramId), user, 900)
    return user
}

const INIT_DATA_MIN_TTL = 60
const INIT_DATA_MAX_TTL = 3600

function normalizeInitDataTtl(value: number | undefined): number {
    const fallback = Number.isFinite(config.telegram.initDataMaxAgeSeconds)
        ? config.telegram.initDataMaxAgeSeconds
        : INIT_DATA_MAX_TTL
    const ttl = typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback
    return Math.max(INIT_DATA_MIN_TTL, Math.min(ttl, INIT_DATA_MAX_TTL))
}

/**
 * Authentication middleware
 * Validates Telegram initData or handles demo mode users
 *
 * SECURITY: Demo mode is ONLY enabled when config.demoMode is explicitly true
 * Header-based demo bypass has been removed to prevent authentication bypass in production
 */
export async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    const correlationId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const initDataTtl = normalizeInitDataTtl(config.telegram.initDataMaxAgeSeconds)

    try {
        // Demo mode: only when explicitly enabled in config
        // SECURITY: Do not allow x-demo-user header to bypass auth in production
        if (config.demoMode) {
            const user = await getOrCreateDemoUser(req)
            req.user = user
            req.telegramId = user.telegram_id
            req.userId = user.id
            return next()
        }

        const initData = req.headers['x-telegram-init-data'] as string

        if (!initData) {
            logger.error('AuthHeaderMissing', `Auth failed for ${req.path}, no x-telegram-init-data header provided, correlation_id ${correlationId}`)
            throw createError('Telegram authorization required', 401)
        }

        if (!config.telegram.botToken) {
            logger.error('BotTokenNotConfigured', `Auth failed for ${req.path}, bot token not configured in environment, correlation_id ${correlationId}`)
            throw createError('Server configuration error', 500)
        }

        logger.debug('ValidatingAuth', `Validating Telegram auth for ${req.path}, correlation_id ${correlationId}`)

        // Use official Telegram validation package
        try {
            validate(initData, config.telegram.botToken, {
                expiresIn: initDataTtl
            })
            logger.debug('OfficialValidationPassed', `Telegram SDK validation successful for ${req.path}, correlation_id ${correlationId}`)
        } catch (err) {
            logger.error('OfficialValidationFailed', `Telegram SDK validation failed for ${req.path}: ${err instanceof Error ? err.message : String(err)}, correlation_id ${correlationId}`)
            throw createError('Invalid Telegram authorization', 401)
        }

        // Parse user data from initData
        const params = new URLSearchParams(initData)
        const userStr = params.get('user')
        if (!userStr) {
            throw createError('No user data in initData', 401)
        }

        const telegramUser = JSON.parse(userStr)
        logger.debug('AuthSuccessful', `Authentication successful for telegram_id ${telegramUser.id}, path ${req.path}, correlation_id ${correlationId}`)

        req.telegramId = telegramUser.id

        // Get or create user
        let user = await cache.get<User>(CACHE_KEYS.USER(telegramUser.id))

        if (!user) {
            const users = await query<User[]>(
                'SELECT * FROM users WHERE telegram_id = ?',
                [telegramUser.id]
            )

            if (users.length === 0) {
                // Create new user
                await query(
                    `INSERT OR IGNORE INTO users (telegram_id, username, first_name, last_name, photo_url, language_code, has_started)
                     VALUES (?, ?, ?, ?, ?, ?, 1)`,
                    [
                        telegramUser.id,
                        telegramUser.username || null,
                        telegramUser.first_name,
                        telegramUser.last_name || null,
                        telegramUser.photo_url || null,
                        telegramUser.language_code || 'en'
                    ]
                )

                const newUsers = await query<User[]>(
                    'SELECT * FROM users WHERE telegram_id = ?',
                    [telegramUser.id]
                )
                user = newUsers[0]
            } else {
                user = users[0]
                // Update language_code if changed
                if (telegramUser.language_code && user.language_code !== telegramUser.language_code) {
                    await query(
                        'UPDATE users SET language_code = ?, updated_at = datetime(\'now\') WHERE id = ?',
                        [telegramUser.language_code, user.id]
                    )
                    user.language_code = telegramUser.language_code
                }
            }

            // Cache user for 15 minutes
            await cache.set(CACHE_KEYS.USER(telegramUser.id), user, 900)
        }

        if (user && user.has_started !== 1) {
            await query(
                'UPDATE users SET has_started = 1, updated_at = datetime(\'now\') WHERE id = ?',
                [user.id]
            )
            user.has_started = 1
            await cache.set(CACHE_KEYS.USER(telegramUser.id), user, 900)
        }

        req.user = user
        req.userId = user?.id
        next()
    } catch (error) {
        next(error)
    }
}

export async function optionalAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const hasTelegram = !!req.headers['x-telegram-init-data']
    // Only proceed with auth if we have Telegram data or demo mode is enabled
    if (!config.demoMode && !hasTelegram) {
        return next()
    }

    let error: unknown = null
    await authMiddleware(req, res, (err?: unknown) => {
        if (err) {
            error = err
        }
    })
    if (error) {
        req.user = undefined
        req.telegramId = undefined
        req.userId = undefined
    }
    next()
}
