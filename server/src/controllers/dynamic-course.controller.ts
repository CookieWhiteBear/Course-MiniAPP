import type { Request, Response, NextFunction } from 'express'
import { createError } from '../middleware/error.middleware.js'
import {
    loadCourseFromFilesystem,
    courseExistsInFilesystem,
    loadCourseMetadata,
    loadLessonRemedialContent
} from '../services/filesystem-loader.js'
import { query } from '../config/database.js'

/**
 * GET /api/dynamic/courses/:id/lessons
 * Load course lessons from filesystem
 */
export async function getDynamicCourseLessons(
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
        if (user) {
            const purchased = await query<any[]>(
                'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
                [user.id, courseId]
            )

            if (purchased.length === 0) {
                throw createError('Course not purchased', 403)
            }
        }

        // Check if course exists in filesystem
        const exists = await courseExistsInFilesystem(courseId)
        if (!exists) {
            throw createError('Course not found in filesystem', 404)
        }

        // Load lessons from filesystem
        const lessons = await loadCourseFromFilesystem(courseId)

        // Transform to API response format
        const formatted = lessons.map(lesson => {
            const response: any = {
                id: lesson.id,
                title: lesson.title,
                content: lesson.content,
                type: lesson.type,
                image: lesson.imageUrl,
                video: lesson.videoUrl
            }

            // Add quiz data if present
            if (lesson.quiz) {
                response.quiz = {
                    questions: lesson.quiz.questions.map((q, idx) => ({
                        id: idx + 1,
                        question: q.question,
                        type: lesson.quiz!.type,
                        answers: q.answers.map((a, aIdx) => ({
                            id: aIdx + 1,
                            text: a
                        })),
                        points: 10
                    })),
                    settings: {
                        passingScore: 70,
                        maxAttempts: 3,
                        shuffleQuestions: false,
                        shuffleAnswers: true,
                        showExplanations: true,
                        requirePass: true
                    },
                    canAttempt: true
                }

                // Store correct answers in a separate endpoint for security
                // Frontend will submit and we'll validate server-side
            }

            return response
        })

        res.json({
            success: true,
            data: formatted
        })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/dynamic/quiz/:courseId/:lessonId/submit
 * Submit quiz answer for filesystem-based course
 */
export async function submitDynamicQuizAttempt(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const courseId = parseInt(req.params.courseId as string, 10)
        const lessonId = parseInt(req.params.lessonId as string, 10)
        const { answers, timeSpent } = req.body

        if (isNaN(courseId) || isNaN(lessonId)) {
            throw createError('Invalid course or lesson ID', 400)
        }

        // Load course from filesystem
        const lessons = await loadCourseFromFilesystem(courseId)
        const lesson = lessons.find(l => l.id === lessonId)

        if (!lesson || !lesson.quiz) {
            throw createError('Quiz not found', 404)
        }

        // Grade the quiz
        let totalScore = 0
        let maxScore = lesson.quiz.questions.length * 10

        const detailedAnswers: any = {}

        lesson.quiz.questions.forEach((question, qIdx) => {
            const questionId = qIdx + 1
            const userAnswer = answers[questionId]

            // Check if answer is correct
            let isCorrect = false

            if (Array.isArray(userAnswer)) {
                // Multiple choice - check if all correct answers are selected
                const userSet = new Set(userAnswer)
                const correctSet = new Set(question.correctAnswers)

                isCorrect = userSet.size === correctSet.size &&
                    [...userSet].every(id => correctSet.has(id))
            } else {
                // Single choice
                isCorrect = question.correctAnswers.includes(userAnswer)
            }

            if (isCorrect) {
                totalScore += 10
            }

            detailedAnswers[questionId] = {
                userAnswer,
                correct: isCorrect,
                correctAnswers: question.correctAnswers
            }
        })

        const percentage = (totalScore / maxScore) * 100
        const passed = percentage >= 70

        // Log attempt to database (optional - for analytics)
        try {
            await query(
                `INSERT INTO quiz_attempts
                 (user_id, lesson_id, course_id, score, max_score, percentage, answers_data, time_spent, passed, attempt_number)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    user.id,
                    lessonId,
                    courseId,
                    totalScore,
                    maxScore,
                    percentage,
                    JSON.stringify(detailedAnswers),
                    timeSpent || null,
                    passed ? 1 : 0,
                    1 // TODO: track attempt number
                ]
            )
        } catch (dbError) {
            console.error('Failed to log quiz attempt:', dbError)
            // Continue even if logging fails
        }

        res.json({
            success: true,
            data: {
                score: totalScore,
                maxScore,
                percentage,
                passed,
                attemptNumber: 1,
                timeSpent: timeSpent || null,
                createdAt: new Date().toISOString(),
                answersData: detailedAnswers
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/dynamic/quiz/:courseId/:lessonId/remedial
 * Get remedial content for failed quiz
 */
export async function getDynamicRemedialContent(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const courseId = parseInt(req.params.courseId as string, 10)
        const lessonId = parseInt(req.params.lessonId as string, 10)

        if (isNaN(courseId) || isNaN(lessonId)) {
            throw createError('Invalid course or lesson ID', 400)
        }

        const remconContent = await loadLessonRemedialContent(courseId, lessonId)

        if (!remconContent) {
            throw createError('No remedial content found', 404)
        }

        res.json({
            success: true,
            data: [{
                id: 1,
                title: 'Additional Study Material',
                content: remconContent,
                contentType: 'text'
            }]
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/dynamic/courses/:id
 * Get course metadata from filesystem
 */
export async function getDynamicCourse(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const courseId = parseInt(req.params.id as string, 10)

        if (isNaN(courseId)) {
            throw createError('Invalid course ID', 400)
        }

        const exists = await courseExistsInFilesystem(courseId)
        if (!exists) {
            throw createError('Course not found', 404)
        }

        const metadata = await loadCourseMetadata(courseId)
        const lessons = await loadCourseFromFilesystem(courseId)

        res.json({
            success: true,
            data: {
                id: courseId,
                ...metadata,
                lessonsCount: lessons.length,
                rating: 5.0,
                price: '$0.00',
                starsPrice: metadata?.starsPrice
            }
        })
    } catch (error) {
        next(error)
    }
}
