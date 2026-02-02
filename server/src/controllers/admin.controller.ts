import type { Request, Response, NextFunction } from 'express'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import { createError } from '../middleware/error.middleware.js'
import { loadCourseMetadata, loadCourseFromFilesystem } from '../services/filesystem-loader.js'
import type { Transaction, User } from '../types/models.js'
import { loadAppConfig } from '../config/app-config.js'

const RANGE_WINDOWS: Record<string, string | null> = {
    '24h': '-1 day',
    '7d': '-7 days',
    'all': null
}

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

function parsePagination(req: Request) {
    const pageRaw = Number(req.query.page ?? 1)
    const limitRaw = Number(req.query.limit ?? 20)
    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(10, limitRaw)) : 20
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

function normalizeRange(value?: string) {
    if (!value) return '24h'
    if (value in RANGE_WINDOWS) return value
    return '24h'
}

function parseDate(value?: string) {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    return trimmed
}

function parseBoolean(value?: string) {
    if (value === undefined) return null
    if (value === 'true' || value === '1') return true
    if (value === 'false' || value === '0') return false
    return null
}

async function listAvailableCourses(): Promise<Array<{ id: number; title: string }>> {
    try {
        const config = await loadAppConfig()
        const courses = config.courses
            .filter(course => Number.isFinite(course.id))
            .map(course => ({ id: course.id, title: course.title }))

        return courses.sort((a, b) => a.id - b.id)
    } catch {
        return []
    }
}

async function collectMetrics(window: string | null) {
    const windowClause = window ? ' AND created_at >= datetime(\'now\', ?)' : ''
    const windowParams = window ? [window] : []

    const [users] = await query<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM users WHERE telegram_id > 0${windowClause}`,
        windowParams
    )

    const [orders] = await query<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM transactions WHERE status = 'success'${windowClause}`,
        windowParams
    )

    const [revenue] = await query<{ total: number }[]>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'success'${windowClause}`,
        windowParams
    )

    const activeSql = window
        ? `SELECT COUNT(DISTINCT user_id) as count FROM (
                SELECT user_id FROM lesson_progress WHERE completed_at >= datetime('now', ?)
                UNION
                SELECT user_id FROM transactions WHERE created_at >= datetime('now', ?)
                UNION
                SELECT chat_user_id as user_id FROM support_messages WHERE created_at >= datetime('now', ?)
           )`
        : `SELECT COUNT(DISTINCT user_id) as count FROM (
                SELECT user_id FROM lesson_progress
                UNION
                SELECT user_id FROM transactions
                UNION
                SELECT chat_user_id as user_id FROM support_messages
           )`

    const activeParams = window ? [window, window, window] : []
    const [active] = await query<{ count: number }[]>(activeSql, activeParams)

    return {
        users: users?.count ?? 0,
        orders: orders?.count ?? 0,
        revenue: revenue?.total ?? 0,
        activeUsers: active?.count ?? 0
    }
}

/**
 * GET /api/admin/metrics
 */
export async function getMetrics(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const range = normalizeRange(req.query.range as string | undefined)

        const metrics = await collectMetrics(RANGE_WINDOWS[range])

        if (range !== '24h' && range !== '7d' && range !== 'all') {
            return res.json({ success: true, data: { range, metrics } })
        }

        if (req.query.range) {
            return res.json({ success: true, data: { range, metrics } })
        }

        const [metrics24h, metrics7d, metricsAll] = await Promise.all([
            collectMetrics(RANGE_WINDOWS['24h']),
            collectMetrics(RANGE_WINDOWS['7d']),
            collectMetrics(RANGE_WINDOWS['all'])
        ])

        res.json({
            success: true,
            data: {
                ranges: {
                    '24h': metrics24h,
                    '7d': metrics7d,
                    'all': metricsAll
                }
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/admin/users
 */
export async function listUsers(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { page, limit, offset } = parsePagination(req)
        const queryText = String(req.query.q ?? '').trim()
        const includeDemo = parseBoolean(req.query.includeDemo as string | undefined) ?? false
        const blocked = parseBoolean(req.query.blocked as string | undefined)

        const filters: string[] = []
        const params: Array<string | number> = []

        if (!includeDemo) {
            filters.push('u.telegram_id > 0')
        }

        if (queryText) {
            filters.push(`(
                u.username LIKE ? OR
                u.first_name LIKE ? OR
                u.last_name LIKE ? OR
                CAST(u.telegram_id AS TEXT) LIKE ? OR
                CAST(u.id AS TEXT) LIKE ?
            )`)
            const like = `%${queryText}%`
            params.push(like, like, like, like, like)
        }

        if (blocked !== null) {
            filters.push('u.is_blocked_for_reviews = ?')
            params.push(blocked ? 1 : 0)
        }

        const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

        const totalRows = await query<{ count: number }[]>(
            `SELECT COUNT(*) as count FROM users u ${whereSql}`,
            params
        )

        const rows = await query<Array<{
            id: number
            telegram_id: number
            username: string | null
            first_name: string
            last_name: string | null
            photo_url: string | null
            created_at: string
            updated_at: string
            has_started: number
            is_blocked_for_reviews: number
            courses_count: number
            orders_count: number
        }>>(
            `SELECT
                u.id,
                u.telegram_id,
                u.username,
                u.first_name,
                u.last_name,
                u.photo_url,
                u.created_at,
                u.updated_at,
                u.has_started,
                u.is_blocked_for_reviews,
                (SELECT COUNT(*) FROM user_courses uc WHERE uc.user_id = u.id) as courses_count,
                (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id AND t.status = 'success') as orders_count
             FROM users u
             ${whereSql}
             ORDER BY u.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        )

        res.json({
            success: true,
            data: {
                items: rows.map(row => ({
                    id: row.id,
                    telegramId: row.telegram_id,
                    username: row.username,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    photoUrl: row.photo_url,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    hasStarted: row.has_started === 1,
                    isBlockedForReviews: row.is_blocked_for_reviews === 1,
                    coursesCount: row.courses_count,
                    ordersCount: row.orders_count
                })),
                pagination: {
                    page,
                    limit,
                    total: totalRows[0]?.count ?? 0
                }
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * PATCH /api/admin/users/:userId
 */
export async function updateUser(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = Number(req.params.userId)
        if (!Number.isFinite(userId)) {
            throw createError('Invalid user id', 400)
        }

        const { firstName, lastName, username, blockReviews } = req.body as {
            firstName?: string
            lastName?: string | null
            username?: string | null
            blockReviews?: boolean
        }

        const updates: string[] = []
        const params: Array<string | number | null> = []

        if (typeof firstName === 'string') {
            updates.push('first_name = ?')
            params.push(firstName.trim())
        }
        if (typeof lastName === 'string') {
            updates.push('last_name = ?')
            params.push(lastName.trim())
        } else if (lastName === null) {
            updates.push('last_name = NULL')
        }
        if (typeof username === 'string') {
            updates.push('username = ?')
            params.push(username.trim() || null)
        } else if (username === null) {
            updates.push('username = NULL')
        }
        if (typeof blockReviews === 'boolean') {
            updates.push('is_blocked_for_reviews = ?')
            params.push(blockReviews ? 1 : 0)
        }

        if (!updates.length) {
            throw createError('No updates provided', 400)
        }

        updates.push('updated_at = datetime(\'now\')')
        params.push(userId)

        await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

        const rows = await query<{ telegram_id: number }[]>(
            'SELECT telegram_id FROM users WHERE id = ?',
            [userId]
        )
        if (rows[0]?.telegram_id) {
            await cache.del(CACHE_KEYS.USER(rows[0].telegram_id))
        }

        res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/admin/transactions
 */
export async function listTransactions(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { page, limit, offset } = parsePagination(req)
        const status = (req.query.status as string | undefined)?.trim()
        const from = parseDate(req.query.from as string | undefined)
        const to = parseDate(req.query.to as string | undefined)
        const queryText = String(req.query.q ?? '').trim()
        const userIdParam = req.query.userId as string | undefined
        const courseIdParam = req.query.courseId as string | undefined
        const userId = userIdParam ? Number(userIdParam) : null
        const courseId = courseIdParam ? Number(courseIdParam) : null

        const filters: string[] = []
        const params: Array<string | number> = []

        if (status) {
            filters.push('t.status = ?')
            params.push(status)
        }
        if (from) {
            filters.push('t.created_at >= ?')
            params.push(from)
        }
        if (to) {
            filters.push('t.created_at <= ?')
            params.push(to)
        }
        if (userId !== null && Number.isFinite(userId)) {
            filters.push('t.user_id = ?')
            params.push(userId)
        }
        if (courseId !== null && Number.isFinite(courseId)) {
            filters.push('t.course_id = ?')
            params.push(courseId)
        }
        if (queryText) {
            const like = `%${queryText}%`
            filters.push(`(
                t.payment_id LIKE ? OR
                u.username LIKE ? OR
                u.first_name LIKE ? OR
                u.last_name LIKE ? OR
                CAST(u.telegram_id AS TEXT) LIKE ? OR
                CAST(t.id AS TEXT) LIKE ?
            )`)
            params.push(like, like, like, like, like, like)
        }

        const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

        const totalRows = await query<{ count: number }[]>(
            `SELECT COUNT(*) as count
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             ${whereSql}`,
            params
        )

        const rows = await query<Array<{
            id: number
            user_id: number
            course_id: number | null
            payment_id: string | null
            amount: number
            currency: string
            status: string
            type: string
            created_at: string
            telegram_id: number
            username: string | null
            first_name: string
            last_name: string | null
        }>>(
            `SELECT
                t.*,
                u.telegram_id,
                u.username,
                u.first_name,
                u.last_name
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             ${whereSql}
             ORDER BY t.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        )

        const courseIds = Array.from(new Set(rows.map(row => row.course_id).filter((id): id is number => Number.isFinite(id))))
        const courseMap = new Map<number, { title: string }>()

        await Promise.all(courseIds.map(async (courseId) => {
            const meta = await loadCourseMetadata(courseId)
            if (meta) {
                courseMap.set(courseId, { title: meta.title })
            }
        }))

        res.json({
            success: true,
            data: {
                items: rows.map(row => ({
                    id: row.id,
                    userId: row.user_id,
                    telegramId: row.telegram_id,
                    username: row.username,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    courseId: row.course_id,
                    courseTitle: row.course_id ? courseMap.get(row.course_id)?.title || `Course ${row.course_id}` : null,
                    paymentId: row.payment_id,
                    amount: row.amount,
                    currency: row.currency,
                    status: row.status,
                    type: row.type,
                    createdAt: row.created_at
                })),
                pagination: {
                    page,
                    limit,
                    total: totalRows[0]?.count ?? 0
                }
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/admin/reviews
 */
export async function listReviews(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { page, limit, offset } = parsePagination(req)
        const courseIdParam = req.query.courseId as string | undefined
        const ratingParam = req.query.rating as string | undefined
        const courseId = courseIdParam ? Number(courseIdParam) : null
        const rating = ratingParam ? Number(ratingParam) : null
        const from = parseDate(req.query.from as string | undefined)
        const to = parseDate(req.query.to as string | undefined)
        const queryText = String(req.query.q ?? '').trim()
        const includeDemo = parseBoolean(req.query.includeDemo as string | undefined) ?? false

        const filters: string[] = []
        const params: Array<string | number> = []

        if (courseId !== null && Number.isFinite(courseId)) {
            filters.push('r.course_id = ?')
            params.push(courseId)
        }
        if (rating !== null && Number.isFinite(rating)) {
            filters.push('r.rating = ?')
            params.push(rating)
        }
        if (from) {
            filters.push('r.created_at >= ?')
            params.push(from)
        }
        if (to) {
            filters.push('r.created_at <= ?')
            params.push(to)
        }
        if (!includeDemo) {
            filters.push('u.telegram_id > 0')
        }
        if (queryText) {
            const like = `%${queryText}%`
            filters.push(`(
                r.comment LIKE ? OR
                u.username LIKE ? OR
                u.first_name LIKE ? OR
                u.last_name LIKE ?
            )`)
            params.push(like, like, like, like)
        }

        const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

        const totalRows = await query<{ count: number }[]>(
            `SELECT COUNT(*) as count
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             ${whereSql}`,
            params
        )

        const rows = await query<Array<{
            id: number
            user_id: number
            course_id: number
            rating: number
            comment: string | null
            is_edited: number
            admin_reply: string | null
            admin_reply_is_edited: number | null
            admin_reply_created_at: string | null
            admin_reply_updated_at: string | null
            created_at: string
            updated_at: string
            username: string | null
            first_name: string
            last_name: string | null
            telegram_id: number
            reply_username: string | null
            reply_first_name: string | null
        }>>(
            `SELECT
                r.*,
                u.username,
                u.first_name,
                u.last_name,
                u.telegram_id,
                ru.username as reply_username,
                ru.first_name as reply_first_name
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             LEFT JOIN users ru ON r.admin_reply_user_id = ru.id
             ${whereSql}
             ORDER BY r.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        )

        const courseIds = Array.from(new Set(rows.map(row => row.course_id)))
        const courseMap = new Map<number, { title: string }>()
        await Promise.all(courseIds.map(async (id) => {
            const meta = await loadCourseMetadata(id)
            if (meta) {
                courseMap.set(id, { title: meta.title })
            }
        }))

        res.json({
            success: true,
            data: {
                items: rows.map(row => ({
                    id: row.id,
                    courseId: row.course_id,
                    courseTitle: courseMap.get(row.course_id)?.title || `Course ${row.course_id}`,
                    userId: row.user_id,
                    telegramId: row.telegram_id,
                    username: row.username,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    rating: row.rating,
                    comment: row.comment || '',
                    isEdited: row.is_edited === 1,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    reply: row.admin_reply
                        ? {
                            text: row.admin_reply,
                            author: row.reply_username || row.reply_first_name || 'Admin',
                            isEdited: row.admin_reply_is_edited === 1,
                            createdAt: row.admin_reply_created_at,
                            updatedAt: row.admin_reply_updated_at
                        }
                        : null
                })),
                pagination: {
                    page,
                    limit,
                    total: totalRows[0]?.count ?? 0
                }
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/admin/courses
 */
export async function listCourses(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const config = await loadAppConfig()
        const courses = config.courses
            .map(course => ({
                ...course,
                id: Number(course.id)
            }))
            .filter(course => Number.isFinite(course.id))

        const courseIds = courses.map(course => course.id)

        if (!courseIds.length) {
            return res.json({ success: true, data: [] })
        }

        const placeholders = courseIds.map(() => '?').join(',')
        const purchaseRows = await query<{ course_id: number; count: number }[]>(
            `SELECT course_id, COUNT(*) as count
             FROM user_courses
             WHERE course_id IN (${placeholders})
             GROUP BY course_id`,
            courseIds
        )

        const ratingRows = await query<{ course_id: number; avg_rating: number; total: number }[]>(
            `SELECT course_id, AVG(rating) as avg_rating, COUNT(*) as total
             FROM reviews
             WHERE course_id IN (${placeholders})
             GROUP BY course_id`,
            courseIds
        )

        const revenueRows = await query<{ course_id: number; total: number }[]>(
            `SELECT course_id, COALESCE(SUM(amount), 0) as total
             FROM transactions
             WHERE course_id IN (${placeholders}) AND status = 'success'
             GROUP BY course_id`,
            courseIds
        )

        const purchaseMap = new Map(purchaseRows.map(row => [row.course_id, row.count]))
        const ratingMap = new Map(ratingRows.map(row => [row.course_id, {
            avgRating: row.avg_rating || 0,
            reviewsCount: row.total || 0
        }]))
        const revenueMap = new Map(revenueRows.map(row => [row.course_id, row.total || 0]))

        res.json({
            success: true,
            data: courses.map(course => ({
                id: course.id,
                title: course.title,
                authorId: course.authorId,
                category: course.category,
                price: course.price,
                starsPrice: course.starsPrice,
                currency: course.currency,
                visibility: course.visibility,
                imageUrl: course.imageUrl,
                studentsCount: purchaseMap.get(course.id) || 0,
                avgRating: ratingMap.get(course.id)?.avgRating || 0,
                reviewsCount: ratingMap.get(course.id)?.reviewsCount || 0,
                revenue: revenueMap.get(course.id) || 0
            }))
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/admin/users/:userId/overview
 */
export async function getUserOverview(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = Number(req.params.userId)
        if (!Number.isFinite(userId)) {
            throw createError('Invalid user id', 400)
        }

        const users = await query<User[]>(
            'SELECT id, telegram_id, username, first_name, last_name, photo_url FROM users WHERE id = ?',
            [userId]
        )
        const user = users[0]
        if (!user) {
            throw createError('User not found', 404)
        }

        const userCourses = await query<{ course_id: number; is_favorite: number; purchased_at: string }[]>(
            `SELECT course_id, is_favorite, purchased_at
             FROM user_courses
             WHERE user_id = ?
             ORDER BY purchased_at DESC`,
            [userId]
        )

        const courseIds = userCourses.map(c => c.course_id)
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

        const courses = await Promise.all(
            userCourses.map(async course => {
                const meta = await loadCourseMetadata(course.course_id)
                const lessons = await loadCourseFromFilesystem(course.course_id).catch(() => [])
                const total = lessons.length || 1
                const completed = progressMap[course.course_id] || 0
                const progress = Math.round((completed / total) * 100)

                return {
                    id: course.course_id,
                    title: meta?.title || `Course ${course.course_id}`,
                    author: meta?.author || 'Unknown',
                    price: `$${(meta?.price || 0).toFixed(2)}`,
                    category: meta?.category || 'Course',
                    image: meta?.imageUrl || 'https://i.imgur.com/zOlPMhT.png',
                    lessonsCount: total,
                    progress,
                    isFavorite: Boolean(course.is_favorite),
                    purchasedAt: course.purchased_at
                }
            })
        )

        const transactions = await query<Transaction[]>(
            `SELECT * FROM transactions
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId]
        )

        const formattedTransactions = await Promise.all(
            transactions.map(async tx => {
                let courseTitle = 'Purchase'
                if (tx.course_id) {
                    const meta = await loadCourseMetadata(tx.course_id)
                    if (meta) courseTitle = meta.title
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

        const availableCourses = await listAvailableCourses()

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    telegramId: user.telegram_id,
                    username: user.username,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    photoUrl: user.photo_url
                },
                courses,
                transactions: formattedTransactions,
                availableCourses
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/admin/users/:userId/courses/:courseId
 */
export async function grantCourseToUser(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = Number(req.params.userId)
        const courseId = Number(req.params.courseId)
        if (!Number.isFinite(userId) || !Number.isFinite(courseId)) {
            throw createError('Invalid user or course id', 400)
        }

        await query(
            `INSERT OR IGNORE INTO user_courses (user_id, course_id, is_favorite, purchased_at)
             VALUES (?, ?, 0, datetime('now'))`,
            [userId, courseId]
        )

        await cache.del(CACHE_KEYS.USER_COURSES(userId))

        res.json({ success: true, data: null })
    } catch (error) {
        next(error)
    }
}

/**
 * DELETE /api/admin/users/:userId/courses/:courseId
 */
export async function revokeCourseFromUser(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = Number(req.params.userId)
        const courseId = Number(req.params.courseId)
        if (!Number.isFinite(userId) || !Number.isFinite(courseId)) {
            throw createError('Invalid user or course id', 400)
        }

        await query('DELETE FROM user_courses WHERE user_id = ? AND course_id = ?', [userId, courseId])
        await query('DELETE FROM lesson_progress WHERE user_id = ? AND course_id = ?', [userId, courseId])
        await query('DELETE FROM quiz_attempts WHERE user_id = ? AND course_id = ?', [userId, courseId])

        await cache.del(CACHE_KEYS.USER_COURSES(userId))

        res.json({ success: true, data: null })
    } catch (error) {
        next(error)
    }
}
