import type { Request, Response, NextFunction } from 'express'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import { createError } from '../middleware/error.middleware.js'
import { loadCourseMetadata, loadCourseFromFilesystem } from '../services/filesystem-loader.js'
import type {
    Transaction,
    UserCourseResponse,
    TransactionResponse
} from '../types/models.js'

function formatPrice(amount: number, isNegative = true): string {
    const formatted = `$${Math.abs(amount).toFixed(2)}`
    return isNegative ? `-${formatted}` : formatted
}

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(new Date(date))
}

/**
 * GET /api/user/profile
 * Returns authenticated user profile
 */
export async function getProfile(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!

        res.json({
            success: true,
            data: {
                id: user.id,
                telegramId: user.telegram_id,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                photoUrl: user.photo_url,
                notificationsEnabled: user.notifications_enabled
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * PUT /api/user/settings
 * Update user settings
 */
export async function updateSettings(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const { notificationsEnabled } = req.body

        if (typeof notificationsEnabled === 'boolean') {
            await query(
                'UPDATE users SET notifications_enabled = ? WHERE id = ?',
                [notificationsEnabled, user.id]
            )

            // Invalidate cache
            await cache.del(CACHE_KEYS.USER(user.telegram_id))
        }

        res.json({ success: true, message: 'Settings updated' })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/user/courses
 * Returns user's purchased courses with progress
 */
export async function getUserCourses(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!

        // Check cache
        const cacheKey = CACHE_KEYS.USER_COURSES(user.id)
        const cached = await cache.get<UserCourseResponse[]>(cacheKey)
        if (cached) {
            return res.json({ success: true, data: cached })
        }

        // Get purchased courses from user_courses table
        const userCourses = await query<{ course_id: number; is_favorite: number; purchased_at: string }[]>(
            `SELECT course_id, is_favorite, purchased_at
             FROM user_courses
             WHERE user_id = ?
             ORDER BY purchased_at DESC`,
            [user.id]
        )

        // Load course data from filesystem for each purchased course
        const courses: Array<{
            id: number
            title: string
            author: string
            price: number
            rating: number
            category: string
            image_url: string
            description: string
            lessons_count: number
            duration?: string
            is_favorite: number
            purchased_at: string
        }> = []

        for (const uc of userCourses) {
            const courseId = uc.course_id

            // Load course metadata from filesystem
            const meta = await loadCourseMetadata(courseId)
            if (!meta) {
                continue // Skip if metadata not found
            }

            // Load lessons to count them
            const lessons = await loadCourseFromFilesystem(courseId)

            // Get rating from reviews
            const ratings = await query<{ rating: number }[]>(
                'SELECT rating FROM reviews WHERE course_id = ?',
                [courseId]
            )
            const avgRating = ratings.length > 0
                ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
                : 5.0

            courses.push({
                id: courseId,
                title: meta.title,
                author: meta.author,
                price: meta.price || 8.00,
                rating: Math.round(avgRating * 10) / 10,
                category: meta.category || 'General',
                image_url: meta.imageUrl || 'https://i.imgur.com/zOlPMhT.png',
                description: meta.description || '',
                lessons_count: lessons.length,
                duration: meta.duration,
                is_favorite: uc.is_favorite,
                purchased_at: uc.purchased_at
            })
        }

        // Get progress for each course
        const courseIds = courses.map(c => c.id)

        let progressMap: Record<number, number> = {}

        if (courseIds.length > 0) {
            // SQLite requires placeholders for each item in IN clause
            const placeholders = courseIds.map(() => '?').join(',')
            const progress = await query<{ course_id: number; completed: number }[]>(
                `SELECT course_id, COUNT(*) as completed
                 FROM lesson_progress
                 WHERE user_id = ? AND course_id IN (${placeholders})
                 GROUP BY course_id`,
                [user.id, ...courseIds]
            )

            progress.forEach(p => {
                progressMap[p.course_id] = p.completed
            })
        }

        const formatted: UserCourseResponse[] = courses.map(course => {
            const completed = progressMap[course.id] || 0
            const total = course.lessons_count || 1
            const progressPercent = Math.round((completed / total) * 100)

            return {
                id: course.id,
                title: course.title,
                author: course.author,
                price: `$${course.price.toFixed(2)}`,
                rating: course.rating,
                category: course.category,
                image: course.image_url,
                description: course.description || undefined,
                duration: course.duration || undefined,
                lessonsCount: course.lessons_count,
                variant: 'my-course',
                progress: progressPercent,
                isFavorite: Boolean(course.is_favorite)
            }
        })

        // Cache for 5 minutes
        await cache.set(cacheKey, formatted, 300)

        res.json({ success: true, data: formatted })
    } catch (error) {
        next(error)
    }
}

/**
 * PUT /api/user/courses/:id/favorite
 * Toggle course favorite status
 */
export async function toggleFavorite(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const courseId = parseInt(req.params.id as string, 10)

        if (isNaN(courseId)) {
            throw createError('Invalid course ID', 400)
        }

        // Toggle favorite
        await query(
            `UPDATE user_courses 
             SET is_favorite = NOT is_favorite 
             WHERE user_id = ? AND course_id = ?`,
            [user.id, courseId]
        )

        // Get new status
        const result = await query<{ is_favorite: boolean }[]>(
            'SELECT is_favorite FROM user_courses WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        )

        // Invalidate cache
        await cache.del(CACHE_KEYS.USER_COURSES(user.id))

        res.json({
            success: true,
            data: { isFavorite: result[0]?.is_favorite ?? false }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/user/transactions
 * Returns user's transaction history
 */
export async function getTransactions(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const page = parseInt(req.query.page as string, 10) || 1
        const limit = 20
        const offset = (page - 1) * limit

        const transactions = await query<Transaction[]>(
            `SELECT * FROM transactions
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [user.id, limit, offset]
        )

        // Load course titles from filesystem
        const formatted: TransactionResponse[] = await Promise.all(
            transactions.map(async tx => {
                let courseTitle = 'Purchase'

                // Load course title from filesystem if course_id exists
                if (tx.course_id) {
                    const meta = await loadCourseMetadata(tx.course_id)
                    if (meta) {
                        courseTitle = meta.title
                    }
                }

                return {
                    id: tx.id,
                    title: tx.status === 'failed' ? 'Payment Failed' : courseTitle,
                    date: formatDate(tx.created_at),
                    amount: tx.status === 'failed' ? '$0.00' : formatPrice(tx.amount),
                    status: tx.status === 'success' ? 'success' : 'failed',
                    type: tx.status === 'failed' ? 'error' : tx.type
                }
            })
        )

        res.json({
            success: true,
            data: formatted,
            pagination: { page, limit, hasMore: transactions.length === limit }
        })
    } catch (error) {
        next(error)
    }
}
