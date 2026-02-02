import type { Request, Response, NextFunction } from 'express'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import { createError } from '../middleware/error.middleware.js'
import { loadCourseFromFilesystem } from '../services/filesystem-loader.js'

/**
 * POST /api/progress/:courseId/lesson/:lessonId
 * Mark a lesson as completed
 */
export async function markLessonComplete(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const courseId = parseInt(req.params.courseId as string, 10)
        const lessonId = parseInt(req.params.lessonId as string, 10)

        if (isNaN(courseId) || isNaN(lessonId)) {
            throw createError('Invalid course or lesson ID', 400)
        }

        // Check if user has access to this course
        const purchased = await query<any[]>(
            'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        )

        if (purchased.length === 0) {
            throw createError('Course not purchased', 403)
        }

        // Load course from filesystem to validate lesson exists
        const lessons = await loadCourseFromFilesystem(courseId)
        const lessonExists = lessons.some(l => l.id === lessonId)

        if (!lessonExists) {
            throw createError('Lesson not found', 404)
        }

        // Mark as complete (ignore if already completed)
        await query(
            `INSERT OR IGNORE INTO lesson_progress (user_id, course_id, lesson_id)
             VALUES (?, ?, ?)`,
            [user.id, courseId, lessonId]
        )

        // Get completed lessons count from DB
        const completedResult = await query<{ count: number }[]>(
            'SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        )

        const completed = completedResult[0]?.count || 0
        const total = lessons.length
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0

        // Invalidate user courses cache
        await cache.del(CACHE_KEYS.USER_COURSES(user.id))

        res.json({
            success: true,
            data: {
                completed,
                total,
                progress: progressPercent
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/progress/:courseId
 * Get user's progress for a course
 */
export async function getCourseProgress(
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

        // Get completed lessons from DB
        const completedLessons = await query<{ lesson_id: number }[]>(
            'SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        )

        // Get total lessons from filesystem
        let total = 0
        try {
            const lessons = await loadCourseFromFilesystem(courseId)
            total = lessons.length
        } catch {
            // Course might not exist in filesystem
            total = 0
        }

        const completed = completedLessons.length
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0

        res.json({
            success: true,
            data: {
                completedLessonIds: completedLessons.map(l => l.lesson_id),
                completed,
                total,
                progress: progressPercent
            }
        })
    } catch (error) {
        next(error)
    }
}
