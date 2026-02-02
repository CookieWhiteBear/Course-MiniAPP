import type { Request, Response, NextFunction } from 'express'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import { loadCourseMetadata, loadCourseFromFilesystem } from '../services/filesystem-loader.js'
import { config } from '../config/env.js'
import type {
    Transaction,
    TransactionResponse,
    UserCourseResponse
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

async function getUserCourses(userId: number): Promise<UserCourseResponse[]> {
    const cacheKey = CACHE_KEYS.USER_COURSES(userId)
    const cached = await cache.get<UserCourseResponse[]>(cacheKey)
    if (cached) return cached

    const userCourses = await query<{ course_id: number; is_favorite: number; purchased_at: string }[]>(
        `SELECT course_id, is_favorite, purchased_at
         FROM user_courses
         WHERE user_id = ?
         ORDER BY purchased_at DESC`,
        [userId]
    )

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
        const meta = await loadCourseMetadata(courseId)
        if (!meta) {
            continue
        }

        const lessons = await loadCourseFromFilesystem(courseId)
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

    const courseIds = courses.map(c => c.id)
    let progressMap: Record<number, number> = {}

    if (courseIds.length > 0) {
        const placeholders = courseIds.map(() => '?').join(',')
        const progress = await query<{ course_id: number; completed: number }[]>(
            `SELECT course_id, COUNT(*) as completed
             FROM lesson_progress
             WHERE user_id = ? AND course_id IN (${placeholders})
             GROUP BY course_id`,
            [userId, ...courseIds]
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

    await cache.set(cacheKey, formatted, 300)
    return formatted
}

async function getTransactions(userId: number): Promise<TransactionResponse[]> {
    const transactions = await query<Transaction[]>(
        `SELECT * FROM transactions
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 20`,
        [userId]
    )

    return Promise.all(
        transactions.map(async tx => {
            let courseTitle = 'Purchase'
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
}

async function getUnreadCount(userId: number, isAdmin: boolean): Promise<number> {
    const rows = isAdmin
        ? await query<{ count: number }[]>(
            `SELECT COUNT(*) as count
             FROM support_messages
             WHERE sender_type = 'user' AND is_read = 0 AND is_deleted = 0`
        )
        : await query<{ count: number }[]>(
            `SELECT COUNT(*) as count
             FROM support_messages
             WHERE chat_user_id = ? AND sender_type = 'admin' AND is_read = 0 AND is_deleted = 0`,
            [userId]
        )

    return rows[0]?.count || 0
}

/**
 * GET /api/bootstrap
 * Combined payload for initial app hydration
 */
export async function getBootstrap(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!
        const isAdmin = config.adminTelegramIds.includes(user.telegram_id)

        const [courses, transactions, unreadCount] = await Promise.all([
            getUserCourses(user.id),
            getTransactions(user.id),
            getUnreadCount(user.id, isAdmin)
        ])

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    telegramId: user.telegram_id,
                    username: user.username,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    photoUrl: user.photo_url,
                    notificationsEnabled: user.notifications_enabled
                },
                courses,
                transactions,
                unreadCount,
                isAdmin
            }
        })
    } catch (error) {
        next(error)
    }
}
