import type { Request, Response, NextFunction } from 'express'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import { config } from '../config/env.js'
import { createError } from '../middleware/error.middleware.js'
import { COURSES_DIR, loadCourseFromFilesystem, loadCourseMetadata, courseExistsInFilesystem } from '../services/filesystem-loader.js'
import { loadAppConfig } from '../config/app-config.js'
import { stat } from 'fs/promises'
import path from 'path'
import type {
    Review,
    CourseResponse,
    CourseDetailResponse,
    LessonStepResponse,
    ReviewResponse,
    QuizDataResponse
} from '../types/models.js'

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

async function attachMyReactions(reviews: ReviewResponse[], userId: number): Promise<ReviewResponse[]> {
    if (!reviews.length) return reviews
    const ids = reviews.map(review => review.id)
    const placeholders = ids.map(() => '?').join(', ')
    const rows = await query<{ review_id: number; value: number }[]>(
        `SELECT review_id, value
         FROM review_reactions
         WHERE user_id = ? AND review_id IN (${placeholders})`,
        [userId, ...ids]
    )
    const reactionMap = new Map(rows.map(row => [row.review_id, row.value]))
    return reviews.map(review => ({
        ...review,
        myReaction: reactionMap.get(review.id) ?? 0
    }))
}

function isDemoRequest(req: Request): boolean {
    const hasDemoHeader = !!req.headers['x-demo-user']
    return config.demoMode || (config.nodeEnv !== 'production' && hasDemoHeader)
}

/**
 * GET /api/courses/featured
 * Returns list of featured/published courses
 */
export async function getFeaturedCourses(
    _req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        // Check cache first
        const cached = await cache.get<CourseResponse[]>(CACHE_KEYS.FEATURED_COURSES)
        if (cached) {
            return res.json({ success: true, data: cached })
        }

        // Load courses from config
        const config = await loadAppConfig()
        const configuredCourses = config.courses.filter(course => course.visibility !== 'hidden')
        const courses: CourseResponse[] = []

        for (const courseConfig of configuredCourses) {
            const courseId = courseConfig.id
            if (!Number.isFinite(courseId)) continue

            const exists = await courseExistsInFilesystem(courseId)
            if (!exists) continue

            try {
                const meta = await loadCourseMetadata(courseId)
                if (!meta) continue

                const lessons = await loadCourseFromFilesystem(courseId)

                // Get reviews to calculate rating
                const reviews = await query<{ rating: number }[]>(
                    'SELECT rating FROM reviews WHERE course_id = ?',
                    [courseId]
                )

                const avgRating = reviews.length > 0
                    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                    : 5.0

                const price = meta.price || 8.00

                courses.push({
                    id: courseId,
                    title: meta.title,
                    author: meta.author,
                    authorAvatar: meta.authorAvatar,
                    price: `$${price.toFixed(2)}`,
                    starsPrice: meta.starsPrice,
                    rating: Math.round(avgRating * 10) / 10,
                    category: meta.category || 'General',
                    image: meta.imageUrl || 'https://i.imgur.com/zOlPMhT.png',
                    description: meta.description || '',
                    lessonsCount: lessons.length,
                    duration: meta.duration || undefined
                })
            } catch (err) {
                console.error(`Failed to load course ${courseId}:`, err)
                continue
            }
        }

        // Cache for 5 minutes
        await cache.set(CACHE_KEYS.FEATURED_COURSES, courses, 300)

        res.json({ success: true, data: courses })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/courses/:id
 * Returns course details with reviews
 */
export async function getCourseById(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const courseId = parseInt(req.params.id as string, 10)
        const viewerId = req.user?.id

        if (isNaN(courseId)) {
            throw createError('Invalid course ID', 400)
        }

        // Check cache
        const cached = await cache.get<CourseDetailResponse>(CACHE_KEYS.COURSE(courseId))
        if (cached && !viewerId) {
            return res.json({ success: true, data: cached })
        }
        if (cached && viewerId) {
            const reviewsWithReaction = await attachMyReactions(cached.reviews, viewerId)
            return res.json({ success: true, data: { ...cached, reviews: reviewsWithReaction } })
        }

        // Check if course directory exists
        const courseDir = path.join(COURSES_DIR, courseId.toString())
        try {
            await stat(courseDir)
        } catch {
            throw createError('Course not found', 404)
        }

        const meta = await loadCourseMetadata(courseId)
        if (!meta) {
            throw createError('Course metadata not found', 404)
        }

        const lessons = await loadCourseFromFilesystem(courseId)

        // Get reviews from database
        const reviews = await query<(Review & {
            username: string
            first_name: string
            reply_username?: string | null
            reply_first_name?: string | null
            likes: number
            dislikes: number
        })[]>(
            `SELECT r.*,
                u.username,
                u.first_name,
                ru.username as reply_username,
                ru.first_name as reply_first_name,
                (SELECT COUNT(*) FROM review_reactions rr WHERE rr.review_id = r.id AND rr.value = 1) as likes,
                (SELECT COUNT(*) FROM review_reactions rr WHERE rr.review_id = r.id AND rr.value = -1) as dislikes
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             LEFT JOIN users ru ON r.admin_reply_user_id = ru.id
             WHERE r.course_id = ?
             ORDER BY (likes - dislikes) DESC, r.created_at DESC
             LIMIT 10`,
            [courseId]
        )

        const baseReviews: ReviewResponse[] = reviews.map(review => ({
            id: review.id,
            user: review.username || review.first_name,
            date: formatRelativeDate(review.created_at),
            rating: review.rating,
            text: review.comment || '',
            isEdited: review.is_edited === 1,
            likes: review.likes ?? 0,
            dislikes: review.dislikes ?? 0,
            reply: review.admin_reply
                ? {
                    text: review.admin_reply,
                    author: review.reply_username || review.reply_first_name || 'Admin',
                    isEdited: review.admin_reply_is_edited === 1,
                    createdAt: review.admin_reply_created_at ? String(review.admin_reply_created_at) : null,
                    updatedAt: review.admin_reply_updated_at ? String(review.admin_reply_updated_at) : null
                }
                : undefined
        }))
        const responseReviews = viewerId
            ? await attachMyReactions(baseReviews, viewerId)
            : baseReviews

        // Calculate average rating from reviews
        const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 5.0

        const price = meta.price || 8.00

        const result: CourseDetailResponse = {
            id: courseId,
            title: meta.title,
            author: meta.author,
            authorAvatar: meta.authorAvatar,
            price: `$${price.toFixed(2)}`,
            starsPrice: meta.starsPrice,
            rating: Math.round(avgRating * 10) / 10,
            category: meta.category || 'General',
            image: meta.imageUrl || 'https://i.imgur.com/zOlPMhT.png',
            description: meta.description || '',
            lessonsCount: lessons.length,
            duration: meta.duration || undefined,
            program: meta.program,
            reviews: responseReviews
        }

        // Cache for 5 minutes
        if (!viewerId) {
            await cache.set(CACHE_KEYS.COURSE(courseId), result, 300)
        } else {
            await cache.set(CACHE_KEYS.COURSE(courseId), { ...result, reviews: baseReviews }, 300)
        }

        res.json({ success: true, data: result })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/courses/:id/lessons
 * Returns lessons for a course (requires purchase)
 */
export async function getCourseLessons(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const courseId = parseInt(req.params.id as string, 10)
        const user = req.user

        if (isNaN(courseId)) {
            throw createError('Invalid course ID', 400)
        }

        // Check if user has access to this course
        if (user && !isDemoRequest(req)) {
            const purchased = await query<any[]>(
                'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
                [user.id, courseId]
            )

            if (purchased.length === 0) {
                throw createError('Course not purchased', 403)
            }
        }

        // Check cache
        const cacheKey = CACHE_KEYS.COURSE_LESSONS(courseId)
        const cached = await cache.get<LessonStepResponse[]>(cacheKey)
        if (cached) {
            return res.json({ success: true, data: cached })
        }

        // Load lessons from filesystem
        const lessons = await loadCourseFromFilesystem(courseId)

        // Convert to API response format
        const formatted: LessonStepResponse[] = lessons.map((lesson) => {
            const lessonResponse: LessonStepResponse = {
                id: lesson.id,
                title: lesson.title,
                content: lesson.content,
                type: lesson.type,
                image: null,
                video: null,
                quiz: null
            }

            // Add quiz data if present
            if (lesson.quiz) {
                const quizData: QuizDataResponse = {
                    questions: lesson.quiz.questions.map((q, qIdx) => ({
                        id: qIdx + 1,
                        question: q.question,
                        type: lesson.quiz!.type === 'multi' ? 'multiple' : 'single',
                        answers: q.answers.map((a, aIdx) => ({
                            id: aIdx + 1,
                            text: a,
                            isCorrect: undefined // Don't send correct answers to client
                        })),
                        explanation: null,
                        hint: null,
                        points: 10,
                        timeLimit: null
                    })),
                    settings: {
                        passingScore: 70,
                        maxAttempts: 3,
                        shuffleQuestions: false,
                        shuffleAnswers: true,
                        showExplanations: true,
                        requirePass: true
                    },
                    userAttempts: [],
                    canAttempt: true,
                    bestScore: undefined
                }

                lessonResponse.quiz = quizData
            }

            return lessonResponse
        })

        // Cache for 10 minutes
        await cache.set(cacheKey, formatted, 600)

        res.json({ success: true, data: formatted })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/courses/:id/reviews
 * Returns all reviews for a course (paginated)
 */
export async function getCourseReviews(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const courseId = parseInt(req.params.id as string, 10)
        const page = parseInt(req.query.page as string, 10) || 1
        const limit = 20
        const offset = (page - 1) * limit
        const viewerId = req.user?.id

        if (isNaN(courseId)) {
            throw createError('Invalid course ID', 400)
        }

        const reviews = await query<(Review & {
            username: string
            first_name: string
            reply_username?: string | null
            reply_first_name?: string | null
            likes: number
            dislikes: number
        })[]>(
            `SELECT r.*,
                u.username,
                u.first_name,
                ru.username as reply_username,
                ru.first_name as reply_first_name,
                (SELECT COUNT(*) FROM review_reactions rr WHERE rr.review_id = r.id AND rr.value = 1) as likes,
                (SELECT COUNT(*) FROM review_reactions rr WHERE rr.review_id = r.id AND rr.value = -1) as dislikes
             FROM reviews r 
             JOIN users u ON r.user_id = u.id 
             LEFT JOIN users ru ON r.admin_reply_user_id = ru.id
             WHERE r.course_id = ? 
             ORDER BY (likes - dislikes) DESC, r.created_at DESC 
             LIMIT ? OFFSET ?`,
            [courseId, limit, offset]
        )

        let formattedReviews: ReviewResponse[] = reviews.map(review => ({
            id: review.id,
            user: review.username || review.first_name,
            date: formatRelativeDate(review.created_at),
            rating: review.rating,
            text: review.comment || '',
            isEdited: review.is_edited === 1,
            likes: review.likes ?? 0,
            dislikes: review.dislikes ?? 0,
            reply: review.admin_reply
                ? {
                    text: review.admin_reply,
                    author: review.reply_username || review.reply_first_name || 'Admin',
                    isEdited: review.admin_reply_is_edited === 1,
                    createdAt: review.admin_reply_created_at ? String(review.admin_reply_created_at) : null,
                    updatedAt: review.admin_reply_updated_at ? String(review.admin_reply_updated_at) : null
                }
                : undefined
        }))
        if (viewerId) {
            formattedReviews = await attachMyReactions(formattedReviews, viewerId)
        }

        res.json({
            success: true,
            data: formattedReviews,
            pagination: { page, limit, hasMore: reviews.length === limit }
        })
    } catch (error) {
        next(error)
    }
}
