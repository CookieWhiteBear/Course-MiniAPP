import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { validate } from '@telegram-apps/init-data-node'
import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'

const COOKIE_NAME = 'cg_hp'
const TOKEN_VERSION = 'v1'
const TOKEN_MIN_TTL_SECONDS = 60

const INIT_DATA_QUERY_KEYS = ['tgWebAppData', 'initData', 'initdata']

const ALLOWED_PATH_PREFIXES = [
    '/api/webhooks/telegram',
    '/api/webhooks/paypal',
    '/api/paypal-hook',
    '/webhooks/telegram',
    '/webhooks/paypal',
    '/paypal-hook'
]

const MINIAPP_ENTRY_PATHS = [
    '/tg',
    '/tg/',
    '/tg.html'
]

function getTokenTtlSeconds(): number {
    const fallback = 15 * 60
    const base = Number.isFinite(config.telegram.initDataMaxAgeSeconds)
        ? config.telegram.initDataMaxAgeSeconds
        : fallback
    return Math.max(TOKEN_MIN_TTL_SECONDS, base)
}

function isAllowedPath(pathname: string): boolean {
    if (!pathname) return false
    return ALLOWED_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function isMiniAppEntryPath(pathname: string): boolean {
    if (!pathname) return false
    return MINIAPP_ENTRY_PATHS.includes(pathname)
}

function isApiRequest(req: Request): boolean {
    const pathname = req.path || ''
    return pathname.startsWith('/api')
}

function getCookieValue(req: Request, name: string): string | null {
    const cookieHeader = req.headers.cookie
    if (!cookieHeader) return null
    const parts = cookieHeader.split(';')
    for (const part of parts) {
        const [rawKey, ...rest] = part.trim().split('=')
        if (!rawKey) continue
        if (rawKey === name) {
            const value = rest.join('=')
            if (!value) return ''
            try {
                return decodeURIComponent(value)
            } catch {
                return null
            }
        }
    }
    return null
}

type InitDataSource = 'header' | 'query'

function extractInitDataFromQuery(req: Request): string | null {
    for (const key of INIT_DATA_QUERY_KEYS) {
        const value = req.query[key]
        if (typeof value === 'string' && value.trim()) {
            return value
        }
    }
    return null
}

function buildCleanUrl(req: Request): string | null {
    try {
        const url = new URL(req.originalUrl || req.url || '', 'http://localhost')
        INIT_DATA_QUERY_KEYS.forEach(key => url.searchParams.delete(key))
        const next = `${url.pathname}${url.search}`
        return next || '/'
    } catch {
        return null
    }
}

function getInitDataFromRequest(req: Request): { value: string; source: InitDataSource } | null {
    const header = req.headers['x-telegram-init-data']
    if (typeof header === 'string' && header.trim()) {
        return { value: header, source: 'header' }
    }
    const queryValue = extractInitDataFromQuery(req)
    if (queryValue) {
        return { value: queryValue, source: 'query' }
    }
    return null
}

function getSigningKey(): Buffer | null {
    if (!config.telegram.botToken) return null
    return crypto.createHash('sha256').update(`hidepublic:${config.telegram.botToken}`).digest()
}

function signToken(payload: string): string {
    const key = getSigningKey()
    if (!key) return ''
    return crypto.createHmac('sha256', key).update(payload).digest('hex')
}

function timingSafeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a)
    const bBuf = Buffer.from(b)
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
}

function createToken(): string | null {
    const key = getSigningKey()
    if (!key) return null
    const issuedAt = Math.floor(Date.now() / 1000)
    const nonce = crypto.randomBytes(16).toString('hex')
    const payload = `${TOKEN_VERSION}.${issuedAt}.${nonce}`
    const signature = signToken(payload)
    if (!signature) return null
    return `${payload}.${signature}`
}

function verifyToken(token: string, ttlSeconds: number): boolean {
    const parts = token.split('.')
    if (parts.length !== 4) return false
    const [version, issuedAtRaw, nonce, signature] = parts
    if (version !== TOKEN_VERSION) return false
    if (!issuedAtRaw || !nonce || !signature) return false
    const issuedAt = Number.parseInt(issuedAtRaw, 10)
    if (!Number.isFinite(issuedAt)) return false
    const now = Math.floor(Date.now() / 1000)
    if (issuedAt > now) return false
    if (now - issuedAt > ttlSeconds) return false
    const expected = signToken(`${version}.${issuedAtRaw}.${nonce}`)
    if (!expected) return false
    return timingSafeEqual(signature, expected)
}

function appendSetCookie(res: Response, value: string) {
    const current = res.getHeader('Set-Cookie')
    if (!current) {
        res.setHeader('Set-Cookie', value)
        return
    }
    if (Array.isArray(current)) {
        res.setHeader('Set-Cookie', [...current, value])
        return
    }
    res.setHeader('Set-Cookie', [String(current), value])
}

function setAccessCookie(res: Response, token: string, ttlSeconds: number, secure: boolean) {
    const parts = [
        `${COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${ttlSeconds}`
    ]
    if (secure) {
        parts.push('Secure')
    }
    appendSetCookie(res, parts.join('; '))
}

function isSecureRequest(req: Request): boolean {
    if (req.secure) return true
    const forwardedProto = req.headers['x-forwarded-proto']
    return typeof forwardedProto === 'string' && forwardedProto.split(',')[0]?.trim() === 'https'
}

function isDocumentRequest(req: Request): boolean {
    const dest = req.headers['sec-fetch-dest']
    if (typeof dest === 'string' && dest.toLowerCase() === 'document') {
        return true
    }
    const accept = req.headers.accept || ''
    return accept.includes('text/html')
}

function dropConnection(req: Request, res: Response) {
    const socket = res.socket ?? req.socket
    if (socket && !socket.destroyed) {
        socket.destroy()
        return
    }
    res.status(404).end()
}

function verifyInitData(initData: string, ttlSeconds: number): boolean {
    if (!config.telegram.botToken) {
        logger.error('HidePublicTokenMissing', 'hidePublic enabled but TELEGRAM_BOT_TOKEN is not configured')
        return false
    }
    try {
        validate(initData, config.telegram.botToken, { expiresIn: ttlSeconds })
        return true
    } catch (error) {
        logger.warn('HidePublicValidationFailed', `hidePublic initData validation failed: ${error instanceof Error ? error.message : String(error)}`)
        return false
    }
}

export function hidePublic() {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!config.hidePublic) {
            return next()
        }

        if (!isApiRequest(req)) {
            if (isMiniAppEntryPath(req.path)) {
                return next()
            }

            const ttlSeconds = getTokenTtlSeconds()
            const cookie = getCookieValue(req, COOKIE_NAME)
            if (cookie && verifyToken(cookie, ttlSeconds)) {
                return next()
            }

            return dropConnection(req, res)
        }

        if (isAllowedPath(req.path)) {
            return next()
        }

        const ttlSeconds = getTokenTtlSeconds()
        const cookie = getCookieValue(req, COOKIE_NAME)
        if (cookie && verifyToken(cookie, ttlSeconds)) {
            return next()
        }

        const initData = getInitDataFromRequest(req)
        if (initData && verifyInitData(initData.value, ttlSeconds)) {
            const token = createToken()
            if (token) {
                const secure = config.nodeEnv === 'production' ? true : isSecureRequest(req)
                setAccessCookie(res, token, ttlSeconds, secure)
                if (
                    initData.source === 'query'
                    && isDocumentRequest(req)
                    && (req.method === 'GET' || req.method === 'HEAD')
                ) {
                    const cleanUrl = buildCleanUrl(req)
                    if (cleanUrl && cleanUrl !== req.originalUrl) {
                        return res.redirect(302, cleanUrl)
                    }
                }
                return next()
            }
        }

        if (isDocumentRequest(req)) {
            return dropConnection(req, res)
        }
        res.status(404).end()
    }
}
