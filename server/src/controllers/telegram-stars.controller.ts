import type { Request, Response, NextFunction } from 'express'
import { createError } from '../middleware/error.middleware.js'
import { query } from '../config/database.js'
import { createTelegramInvoiceLink } from '../services/telegram-bot.service.js'
import { buildStarsPayload } from '../services/telegram-stars.service.js'
import { courseExistsInFilesystem, loadCourseMetadata } from '../services/filesystem-loader.js'

export async function createStarsInvoiceLink(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const courseId = parseInt(req.body.courseId, 10)

        if (!courseId || isNaN(courseId)) {
            throw createError('Invalid course ID', 400)
        }

        const exists = await courseExistsInFilesystem(courseId)
        if (!exists) {
            throw createError('Course not found', 404)
        }

        const meta = await loadCourseMetadata(courseId)
        if (!meta) {
            throw createError('Course metadata not found', 404)
        }

        const starsPriceValue = meta.starsPrice
        const starsPrice = Number(starsPriceValue)
        if (!Number.isFinite(starsPrice) || !Number.isInteger(starsPrice) || starsPrice <= 0) {
            throw createError('Stars price not configured', 400)
        }

        const purchased = await query<any[]>(
            'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        )

        if (purchased.length > 0) {
            throw createError('Course already purchased', 400)
        }

        const payload = buildStarsPayload(user.id, courseId)

        const invoiceLink = await createTelegramInvoiceLink({
            title: meta.title,
            description: meta.description || meta.title,
            payload,
            currency: 'XTR',
            prices: [
                {
                    label: meta.title,
                    amount: starsPrice
                }
            ],
            providerToken: ''
        })

        if (!invoiceLink) {
            throw createError('Failed to create Telegram invoice', 500)
        }

        await query(
            `INSERT INTO transactions (
                user_id, course_id, payment_id, amount, currency, status, type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                user.id,
                courseId,
                payload,
                starsPrice,
                'XTR',
                'pending',
                'purchase'
            ]
        )

        res.json({
            success: true,
            data: {
                invoiceLink
            }
        })
    } catch (error) {
        next(error)
    }
}
