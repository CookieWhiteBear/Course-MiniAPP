import { Redis } from 'ioredis'
import { config } from './env.js'
import { logger } from '../utils/logger.js'

type CacheEntry = string

const redisEnabled = Boolean(config.redis?.enabled)

let redisClient: Redis | null = null
let redisReady = false
let connectPromise: Promise<void> | null = null

function initRedis() {
    if (!redisEnabled) {
        return null
    }

    if (redisClient) {
        return redisClient
    }

    const client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableReadyCheck: true
    })

    client.on('ready', () => {
        redisReady = true
        logger.info('RedisConnected', 'Redis cache connected')
    })
    client.on('error', (err: Error) => {
        redisReady = false
        logger.warn('RedisError', `Redis connection error: ${err.message}`)
    })
    client.on('end', () => {
        redisReady = false
        logger.warn('RedisDisconnected', 'Redis connection closed')
    })

    redisClient = client
    return client
}

async function getRedis() {
    const client = initRedis()
    if (!client) return null
    if (!redisReady) {
        if (!connectPromise) {
            connectPromise = client.connect().catch((err) => {
                logger.warn('RedisConnectFailed', `Redis connect failed: ${(err as Error).message}`)
            }).finally(() => {
                connectPromise = null
            })
        }
        await connectPromise
        if (!redisReady) {
            return null
        }
    }
    return client
}

function encode(value: unknown): CacheEntry {
    return JSON.stringify(value)
}

function decode<T>(value: CacheEntry | null): T | null {
    if (!value) return null
    try {
        return JSON.parse(value) as T
    } catch {
        return null
    }
}

export const cache = {
    async get<T>(key: string): Promise<T | null> {
        const client = await getRedis()
        if (!client) return null
        try {
            const value = await client.get(key)
            return decode<T>(value)
        } catch {
            return null
        }
    },

    async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
        const client = await getRedis()
        if (!client) return
        try {
            const payload = encode(value)
            if (ttlSeconds > 0) {
                await client.set(key, payload, 'EX', ttlSeconds)
            } else {
                await client.set(key, payload)
            }
        } catch {
            // ignore cache errors
        }
    },

    async del(key: string): Promise<void> {
        const client = await getRedis()
        if (!client) return
        try {
            await client.del(key)
        } catch {
            // ignore cache errors
        }
    },

    async invalidatePattern(pattern: string): Promise<void> {
        const client = await getRedis()
        if (!client) return

        try {
            let cursor = '0'
            do {
                const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
                cursor = nextCursor
                if (keys.length) {
                    await client.del(...keys)
                }
            } while (cursor !== '0')
        } catch {
            // ignore cache errors
        }
    }
}

export const CACHE_KEYS = {
    FEATURED_COURSES: 'courses:featured',
    COURSE: (id: number) => `courses:${id}`,
    COURSE_LESSONS: (id: number) => `courses:${id}:lessons`,
    USER: (telegramId: number) => `user:${telegramId}`,
    USER_COURSES: (userId: number) => `user:${userId}:courses`
}
