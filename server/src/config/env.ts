import dotenv from 'dotenv'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

dotenv.config()

function resolveConfigPath(): string {
    if (process.env.CONFIG_PATH) {
        return process.env.CONFIG_PATH
    }

    const cwdConfig = path.join(process.cwd(), 'config.yaml')
    if (fs.existsSync(cwdConfig)) {
        return cwdConfig
    }

    const parentConfig = path.resolve(process.cwd(), '..', 'config.yaml')
    if (fs.existsSync(parentConfig)) {
        return parentConfig
    }

    return cwdConfig
}

function coerceEnvValue(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return undefined
}

function loadConfigEnv(): Record<string, string> {
    const configPath = resolveConfigPath()
    if (!fs.existsSync(configPath)) {
        return {}
    }

    try {
        const raw = fs.readFileSync(configPath, 'utf-8')
        const parsed = (YAML.parse(raw) || {}) as any
        const envConfig = parsed.env || {}
        const featuresConfig = parsed.features || {}

        const toEnv: Record<string, string> = {}
        const setEnv = (key: string, value: unknown) => {
            const coerced = coerceEnvValue(value)
            if (coerced !== undefined) {
                toEnv[key] = coerced
            }
        }

        setEnv('PORT', envConfig.port ?? envConfig.PORT)
        setEnv('NODE_ENV', envConfig.nodeEnv ?? envConfig.NODE_ENV)
        setEnv('DEMO_MODE', envConfig.demoMode ?? envConfig.DEMO_MODE ?? featuresConfig.demoMode)
        setEnv('FRONTEND_URL', envConfig.frontendUrl ?? envConfig.FRONTEND_URL)
        setEnv(
            'HIDE_PUBLIC',
            envConfig.hidePublic
                ?? envConfig.hidepublic
                ?? featuresConfig.hidePublic
                ?? featuresConfig.hidepublic
        )

        const redis = envConfig.redis || {}
        setEnv('REDIS_ENABLED', redis.enabled ?? redis.ENABLED)
        setEnv('REDIS_HOST', redis.host ?? redis.HOST)
        setEnv('REDIS_PORT', redis.port ?? redis.PORT)
        setEnv('REDIS_PASSWORD', redis.password ?? redis.PASSWORD)

        const telegram = envConfig.telegram || {}
        setEnv('TELEGRAM_BOT_TOKEN', telegram.botToken ?? telegram.BOT_TOKEN)
        setEnv('TELEGRAM_WEBHOOK_URL', telegram.webhookUrl ?? telegram.WEBHOOK_URL)
        setEnv(
            'TELEGRAM_INIT_DATA_TTL',
            telegram.initDataTtl
                ?? telegram.initDataMaxAge
                ?? telegram.initDataExpiration
                ?? telegram.INIT_DATA_TTL
                ?? telegram.INIT_DATA_MAX_AGE
                ?? telegram.INIT_DATA_EXPIRATION
        )
        if (Array.isArray(telegram.adminIds)) {
            setEnv('ADMIN_TELEGRAM_IDS', telegram.adminIds.join(','))
        } else {
            setEnv('ADMIN_TELEGRAM_IDS', telegram.adminIds ?? telegram.ADMIN_IDS)
        }

        const paypal = envConfig.paypal || {}
        setEnv('PAYPAL_CLIENT_ID', paypal.clientId ?? paypal.CLIENT_ID)
        setEnv('PAYPAL_SECRET', paypal.secret ?? paypal.SECRET)
        setEnv('PAYPAL_WEBHOOK_ID', paypal.webhookId ?? paypal.WEBHOOK_ID)
        setEnv('PAYPAL_MODE', paypal.mode ?? paypal.MODE)

        const cloudflare = envConfig.cloudflare || {}
        setEnv('CLOUDFLARE_ACCOUNT_ID', cloudflare.accountId ?? cloudflare.ACCOUNT_ID)
        setEnv('CLOUDFLARE_API_TOKEN', cloudflare.apiToken ?? cloudflare.API_TOKEN)
        setEnv('CLOUDFLARE_STREAM_SIGNING_KEY', cloudflare.signingKey ?? cloudflare.STREAM_SIGNING_KEY)
        setEnv('CLOUDFLARE_CUSTOMER_SUBDOMAIN', cloudflare.customerSubdomain ?? cloudflare.CUSTOMER_SUBDOMAIN)

        const video = envConfig.video || {}
        setEnv('VIDEO_SIGNING_KEY', video.signingKey ?? video.SIGNING_KEY)

        // i18n
        setEnv('DEFAULT_LANGUAGE', envConfig.defaultLanguage ?? envConfig.DEFAULT_LANGUAGE)

        return toEnv
    } catch {
        return {}
    }
}

const envSchema = z.object({
    // Server
    PORT: z.string().default('3001'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DEMO_MODE: z.string().optional().default('false'),

    // Redis
    REDIS_ENABLED: z.string().optional().default('false'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().default('6379'),
    REDIS_PASSWORD: z.string().default(''),

    // Telegram
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_WEBHOOK_URL: z.string().optional(),
    TELEGRAM_INIT_DATA_TTL: z.coerce.number().int().positive().default(300),
    ADMIN_TELEGRAM_IDS: z.string().optional(),

    // PayPal
    PAYPAL_CLIENT_ID: z.string().optional(),
    PAYPAL_SECRET: z.string().optional(),
    PAYPAL_WEBHOOK_ID: z.string().optional(),
    PAYPAL_MODE: z.enum(['sandbox', 'live']).default('sandbox'),

    // Cloudflare Stream
    CLOUDFLARE_ACCOUNT_ID: z.string().default(''),
    CLOUDFLARE_API_TOKEN: z.string().default(''),
    CLOUDFLARE_STREAM_SIGNING_KEY: z.string().default(''),
    CLOUDFLARE_CUSTOMER_SUBDOMAIN: z.string().optional(),

    // CDN (legacy - kept for compatibility)
    VIDEO_SIGNING_KEY: z.string().optional(),

    // i18n
    DEFAULT_LANGUAGE: z.enum(['en', 'ru', 'uk']).default('en'),

    // CORS
    FRONTEND_URL: z.string().default('http://localhost:5173'),

    // Access gating
    HIDE_PUBLIC: z.string().optional().default('false')
})

const env = envSchema.parse({
    ...loadConfigEnv(),
    ...process.env
})

export const config = {
    port: parseInt(env.PORT, 10),
    nodeEnv: env.NODE_ENV,
    demoMode: env.DEMO_MODE === 'true',

    redis: {
        enabled: env.REDIS_ENABLED === 'true',
        host: env.REDIS_HOST,
        port: parseInt(env.REDIS_PORT, 10),
        password: env.REDIS_PASSWORD || undefined
    },

    telegram: {
        botToken: env.TELEGRAM_BOT_TOKEN,
        webhookUrl: env.TELEGRAM_WEBHOOK_URL,
        initDataMaxAgeSeconds: env.TELEGRAM_INIT_DATA_TTL
    },
    adminTelegramIds: env.ADMIN_TELEGRAM_IDS
        ? env.ADMIN_TELEGRAM_IDS.split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(id => Number.isFinite(id))
        : [],

    paypal: {
        clientId: env.PAYPAL_CLIENT_ID || '',
        secret: env.PAYPAL_SECRET || '',
        webhookId: env.PAYPAL_WEBHOOK_ID || '',
        mode: env.PAYPAL_MODE as 'sandbox' | 'live'
    },

    cloudflare: {
        accountId: env.CLOUDFLARE_ACCOUNT_ID || '',
        apiToken: env.CLOUDFLARE_API_TOKEN || '',
        signingKey: env.CLOUDFLARE_STREAM_SIGNING_KEY || '',
        customerSubdomain: env.CLOUDFLARE_CUSTOMER_SUBDOMAIN || ''
    },

    video: {
        signingKey: env.VIDEO_SIGNING_KEY
    },

    defaultLanguage: env.DEFAULT_LANGUAGE,
    frontendUrl: env.FRONTEND_URL,
    hidePublic: env.HIDE_PUBLIC === 'true'
}
