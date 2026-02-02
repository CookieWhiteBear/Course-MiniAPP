import rateLimit from 'express-rate-limit'

export const rateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        success: false,
        error: {
            message: 'Too many requests, please try again later.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting if we can't get IP (fixes trust proxy warning)
    skip: (req) => !req.ip,
    // Use X-Forwarded-For header from proxy
    validate: {
        xForwardedForHeader: false,
        trustProxy: false
    }
})

export const authRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10, // 10 auth attempts per minute
    message: {
        success: false,
        error: {
            message: 'Too many authentication attempts.'
        }
    },
    skip: (req) => !req.ip,
    validate: {
        xForwardedForHeader: false,
        trustProxy: false
    }
})

export const webhookRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 50,
    message: {
        success: false,
        error: {
            message: 'Webhook rate limit exceeded.'
        }
    },
    skip: (req) => !req.ip,
    validate: {
        xForwardedForHeader: false,
        trustProxy: false
    }
})
