import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../config/database.js'
import { createError } from '../middleware/error.middleware.js'
import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'

/**
 * Video token signing key - MUST be configured in production
 * SECURITY: Using a default/weak key allows token forgery and unauthorized video access
 */
function getVideoTokenSecret(): string {
    const secret = config.video.signingKey || process.env.VIDEO_TOKEN_SECRET

    if (!secret) {
        if (config.nodeEnv === 'production') {
            logger.error('VideoSecretMissing', 'VIDEO_TOKEN_SECRET or video.signingKey must be configured in production')
            throw new Error('Video signing key not configured')
        }
        // Development fallback - still log a warning
        logger.warn('VideoSecretDefault', 'Using development-only video signing key - configure video.signingKey for production')
        return 'dev-only-video-secret-do-not-use-in-production'
    }

    return secret
}

const VIDEO_TOKEN_EXPIRY = 5 * 60 // 5 minutes

/**
 * POST /api/video/access/:lessonId
 * Generate signed video URL with access logging
 */
export async function generateVideoAccess(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const lessonId = parseInt(req.params.lessonId as string, 10)

        if (isNaN(lessonId)) {
            throw createError('Invalid lesson ID', 400)
        }

        // Get lesson and verify it has a video
        const lessons = await query<any[]>(
            'SELECT id, course_id, video_url, type FROM lessons WHERE id = ?',
            [lessonId]
        )

        if (lessons.length === 0 || lessons[0].type !== 'video' || !lessons[0].video_url) {
            throw createError('Video not found', 404)
        }

        const lesson = lessons[0]
        const courseId = lesson.course_id

        // Check if user has access to this course
        const purchased = await query<any[]>(
            'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        )

        if (purchased.length === 0) {
            throw createError('Course not purchased', 403)
        }

        // Generate access token
        const token = jwt.sign(
            {
                userId: user.id,
                lessonId: lessonId,
                courseId: courseId,
                timestamp: Date.now()
            },
            getVideoTokenSecret(),
            { expiresIn: VIDEO_TOKEN_EXPIRY }
        )

        // Log access
        await query(
            `INSERT INTO video_access_log (user_id, lesson_id, course_id, ip_address, user_agent, access_token)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                lessonId,
                courseId,
                req.ip || req.socket.remoteAddress,
                req.headers['user-agent'] || null,
                token
            ]
        )

        // Return signed URL
        // In production, this would return a CDN URL with the token
        const signedUrl = `${lesson.video_url}?token=${token}`

        res.json({
            success: true,
            data: {
                videoUrl: signedUrl,
                expiresIn: VIDEO_TOKEN_EXPIRY,
                expiresAt: new Date(Date.now() + VIDEO_TOKEN_EXPIRY * 1000).toISOString()
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/video/verify/:token
 * Verify video access token (used by CDN/video server)
 */
export async function verifyVideoToken(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const token = req.params.token as string

        if (!token) {
            throw createError('Token required', 400)
        }

        // Verify JWT
        const decoded = jwt.verify(token, getVideoTokenSecret()) as {
            userId: number
            lessonId: number
            courseId: number
            timestamp: number
        }

        // Check if token has been used/logged
        const accessLogs = await query<any[]>(
            `SELECT id FROM video_access_log
             WHERE access_token = ? AND user_id = ? AND lesson_id = ?`,
            [token, decoded.userId, decoded.lessonId]
        )

        if (accessLogs.length === 0) {
            throw createError('Invalid token', 403)
        }

        res.json({
            success: true,
            data: {
                valid: true,
                userId: decoded.userId,
                lessonId: decoded.lessonId,
                courseId: decoded.courseId
            }
        })
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            throw createError('Invalid or expired token', 403)
        }
        next(error)
    }
}

/**
 * GET /api/video/analytics/:courseId
 * Get video access analytics for a course
 */
export async function getVideoAnalytics(
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

        // Get access logs for this user and course
        const logs = await query<any[]>(
            `SELECT
                l.id as lesson_id,
                l.title as lesson_title,
                COUNT(v.id) as view_count,
                MAX(v.accessed_at) as last_viewed
             FROM lessons l
             LEFT JOIN video_access_log v ON l.id = v.lesson_id AND v.user_id = ?
             WHERE l.course_id = ? AND l.type = 'video'
             GROUP BY l.id
             ORDER BY l.sort_order ASC`,
            [user.id, courseId]
        )

        res.json({
            success: true,
            data: logs
        })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/video/report-piracy
 * Report suspected piracy or unauthorized access
 */
export async function reportPiracy(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { lessonId, description, evidence } = req.body

        if (!lessonId) {
            throw createError('Lesson ID required', 400)
        }

        // In production, this would:
        // 1. Log to security monitoring system
        // 2. Alert administrators
        // 3. Potentially block access
        // 4. Analyze watermark data to identify source

        console.warn('Piracy report:', {
            lessonId,
            description,
            evidence,
            timestamp: new Date().toISOString()
        })

        res.json({
            success: true,
            data: {
                reportId: Date.now(),
                message: 'Report received and under investigation'
            }
        })
    } catch (error) {
        next(error)
    }
}
