import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

export interface AppError extends Error {
    statusCode: number
    isOperational: boolean
    code?: string
}

export function createError(message: string, statusCode: number, code?: string): AppError {
    const error = new Error(message) as AppError
    error.statusCode = statusCode
    error.isOperational = true
    error.code = code
    return error
}

// Common error codes
export const ErrorCodes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    RATE_LIMITED: 'RATE_LIMITED',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
} as const

export function errorHandler(
    err: AppError,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    const statusCode = err.statusCode || 500
    const message = err.isOperational ? err.message : 'Internal Server Error'
    const correlationId = req.headers['x-correlation-id'] || `err-${Date.now()}`

    // Enhanced error logging
    const errorContext = {
        method: req.method,
        path: req.path,
        userId: (req as any).user?.id,
        correlationId,
        statusCode,
        code: err.code,
    }

    if (!err.isOperational) {
        // Log full details for unexpected errors
        logger.error('UnhandledError',
            `${req.method} ${req.path} → ${err.message} [${correlationId}]`)

        // Log stack trace in development
        if (process.env.NODE_ENV === 'development' && err.stack) {
            console.error('\x1b[31m' + err.stack + '\x1b[0m')
        }
    } else {
        // Log operational errors with less severity
        logger.warn('OperationalError',
            `${req.method} ${req.path} → ${statusCode} ${message} [${err.code || 'no-code'}]`)
    }

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            code: err.code,
            correlationId,
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
                context: errorContext
            })
        }
    })
}
