import type { Request, Response, NextFunction } from 'express'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import { createError } from '../middleware/error.middleware.js'
import { z } from 'zod'

const reviewSchema = z.object({
    courseId: z.number().int().positive(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional()
})

const replySchema = z.object({
    message: z.string().min(1).max(1000)
})

const reactionSchema = z.object({
    value: z.number().int().min(-1).max(1)
})

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(new Date(date))
}

function formatRelativeDate(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return formatDate(date)
}

function mapReview(row: any) {
    return {
        id: row.id,
        user: row.username || row.first_name,
        date: formatRelativeDate(row.created_at),
        rating: row.rating,
        text: row.comment || '',
        isEdited: row.is_edited === 1
    }
}

/**
 * POST /api/reviews
 * Create a new review for a course
 */
export async function createReview(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!

        const blockedRows = await query<{ is_blocked_for_reviews: number }[]>(
            'SELECT is_blocked_for_reviews FROM users WHERE id = ?',
            [user.id]
        )
        if (blockedRows[0]?.is_blocked_for_reviews === 1) {
            throw createError('Reviews disabled for this user', 403)
        }

        // Validate input
        const validated = reviewSchema.parse(req.body)

        // Check if user has purchased this course
        const purchased = await query<any[]>(
            'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
            [user.id, validated.courseId]
        )

        if (purchased.length === 0) {
            throw createError('You must purchase this course to leave a review', 403)
        }

        // Check if user already reviewed this course
        const existingReview = await query<any[]>(
            'SELECT id FROM reviews WHERE user_id = ? AND course_id = ?',
            [user.id, validated.courseId]
        )

        if (existingReview.length > 0) {
            // Update existing review
            await query(
                `UPDATE reviews
                 SET rating = ?, comment = ?, is_edited = 1, updated_at = datetime('now')
                 WHERE user_id = ? AND course_id = ?`,
                [validated.rating, validated.comment || null, user.id, validated.courseId]
            )
        } else {
            // Create new review
            await query(
                "INSERT INTO reviews (user_id, course_id, rating, comment, is_edited, updated_at) VALUES (?, ?, ?, ?, 0, datetime('now'))",
                [user.id, validated.courseId, validated.rating, validated.comment || null]
            )
        }

        // Update course average rating
        await updateCourseRating(validated.courseId)

        // Invalidate cache
        await cache.del(CACHE_KEYS.COURSE(validated.courseId))

        res.json({ success: true, message: 'Review submitted successfully' })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(createError('Invalid review data', 400))
        }
        next(error)
    }
}

function buildReplyPayload(row: any) {
    if (!row.admin_reply) {
        return null
    }
    return {
        text: row.admin_reply,
        author: row.reply_username || row.reply_first_name || 'Admin',
        isEdited: row.admin_reply_is_edited === 1,
        createdAt: row.admin_reply_created_at ? String(row.admin_reply_created_at) : null,
        updatedAt: row.admin_reply_updated_at ? String(row.admin_reply_updated_at) : null
    }
}

/**
 * GET /api/reviews/:courseId/me
 * Get current user's review for a course
 */
export async function getMyReview(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const courseId = parseInt(req.params.courseId as string, 10)

        if (isNaN(courseId)) {
            throw createError('Invalid course ID', 400)
        }

        const rows = await query<any[]>(
            `SELECT r.*, u.username, u.first_name,
                ru.username as reply_username,
                ru.first_name as reply_first_name,
                (SELECT COUNT(*) FROM review_reactions rr WHERE rr.review_id = r.id AND rr.value = 1) as likes,
                (SELECT COUNT(*) FROM review_reactions rr WHERE rr.review_id = r.id AND rr.value = -1) as dislikes,
                (SELECT value FROM review_reactions rr WHERE rr.review_id = r.id AND rr.user_id = ?) as my_reaction
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             LEFT JOIN users ru ON r.admin_reply_user_id = ru.id
             WHERE r.user_id = ? AND r.course_id = ?
             LIMIT 1`,
            [user.id, user.id, courseId]
        )

        const review = rows[0]
            ? {
                ...mapReview(rows[0]),
                likes: rows[0].likes ?? 0,
                dislikes: rows[0].dislikes ?? 0,
                myReaction: rows[0].my_reaction ?? 0,
                reply: buildReplyPayload(rows[0]) || undefined
            }
            : null
        res.json({ success: true, data: review })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/reviews/:id/reaction
 * Set like/dislike for a review
 */
export async function setReviewReaction(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const reviewId = parseInt(req.params.id as string, 10)
        if (isNaN(reviewId)) {
            throw createError('Invalid review ID', 400)
        }

        const { value } = reactionSchema.parse(req.body)

        if (value === 0) {
            await query(
                'DELETE FROM review_reactions WHERE review_id = ? AND user_id = ?',
                [reviewId, user.id]
            )
        } else {
            await query(
                `INSERT INTO review_reactions (review_id, user_id, value)
                 VALUES (?, ?, ?)
                 ON CONFLICT(review_id, user_id) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
                [reviewId, user.id, value]
            )
        }

        const counts = await query<{ likes: number; dislikes: number }[]>(
            `SELECT
                SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) as dislikes
             FROM review_reactions
             WHERE review_id = ?`,
            [reviewId]
        )

        const rows = await query<{ course_id: number }[]>(
            'SELECT course_id FROM reviews WHERE id = ?',
            [reviewId]
        )
        const courseId = rows[0]?.course_id
        if (courseId) {
            await cache.del(CACHE_KEYS.COURSE(courseId))
        }

        res.json({
            success: true,
            data: {
                likes: counts[0]?.likes || 0,
                dislikes: counts[0]?.dislikes || 0,
                myReaction: value
            }
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(createError('Invalid reaction data', 400))
        }
        next(error)
    }
}

/**
 * POST /api/reviews/:id/reply
 * Admin reply to a review
 */
export async function replyToReview(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const reviewId = parseInt(req.params.id as string, 10)
        if (isNaN(reviewId)) {
            throw createError('Invalid review ID', 400)
        }

        const { message } = replySchema.parse(req.body)

        const existing = await query<any[]>(
            'SELECT admin_reply FROM reviews WHERE id = ?',
            [reviewId]
        )
        if (existing.length === 0) {
            throw createError('Review not found', 404)
        }
        const hadReply = !!existing[0]?.admin_reply

        await query(
            `UPDATE reviews
             SET admin_reply = ?,
                 admin_reply_user_id = ?,
                 admin_reply_is_edited = ?,
                 admin_reply_created_at = COALESCE(admin_reply_created_at, datetime('now')),
                 admin_reply_updated_at = datetime('now')
             WHERE id = ?`,
            [message, user.id, hadReply ? 1 : 0, reviewId]
        )

        const rows = await query<any[]>(
            `SELECT r.admin_reply, r.admin_reply_is_edited, r.admin_reply_created_at, r.admin_reply_updated_at,
                u.username as reply_username, u.first_name as reply_first_name
             FROM reviews r
             LEFT JOIN users u ON r.admin_reply_user_id = u.id
             WHERE r.id = ?
             LIMIT 1`,
            [reviewId]
        )

        const reply = rows[0] ? buildReplyPayload(rows[0]) : null
        const courseRows = await query<{ course_id: number }[]>(
            'SELECT course_id FROM reviews WHERE id = ?',
            [reviewId]
        )
        const courseId = courseRows[0]?.course_id
        if (courseId) {
            await cache.del(CACHE_KEYS.COURSE(courseId))
        }

        res.json({
            success: true,
            data: reply
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(createError('Invalid reply data', 400))
        }
        next(error)
    }
}

/**
 * DELETE /api/reviews/:id
 * Admin-only delete review
 */
export async function deleteReview(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const reviewId = parseInt(req.params.id as string, 10)
        if (isNaN(reviewId)) {
            throw createError('Invalid review ID', 400)
        }

        const rows = await query<any[]>(
            'SELECT course_id FROM reviews WHERE id = ?',
            [reviewId]
        )
        if (rows.length === 0) {
            throw createError('Review not found', 404)
        }
        const courseId = rows[0].course_id as number

        await query('DELETE FROM reviews WHERE id = ?', [reviewId])
        await updateCourseRating(courseId)
        await cache.del(CACHE_KEYS.COURSE(courseId))

        res.json({ success: true, data: null })
    } catch (error) {
        next(error)
    }
}

/**
 * Recalculate and update course average rating
 */
async function updateCourseRating(courseId: number): Promise<void> {
    const result = await query<{ avg_rating: number }[]>(
        'SELECT AVG(rating) as avg_rating FROM reviews WHERE course_id = ?',
        [courseId]
    )

    const avgRating = result[0]?.avg_rating || 0

    await query(
        'UPDATE courses SET rating = ? WHERE id = ?',
        [Math.round(avgRating * 10) / 10, courseId] // Round to 1 decimal
    )
}
