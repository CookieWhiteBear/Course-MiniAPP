import type { Request, Response, NextFunction } from 'express'
import { query } from '../config/database.js'
import { cache, CACHE_KEYS } from '../config/redis.js'
import { createError } from '../middleware/error.middleware.js'
import type { QuizQuestion, QuizAnswer, QuizSettings, QuizAttempt, RemedialContent } from '../types/models.js'
import type { QuizDataResponse, QuizAttemptResponse, RemedialContentResponse } from '../types/models.js'

/**
 * GET /api/quiz/:lessonId
 * Get quiz data for a lesson
 */
export async function getQuizData(
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

        // Check if user has access to this course
        const lesson = await query<any[]>(
            'SELECT course_id, type FROM lessons WHERE id = ?',
            [lessonId]
        )

        if (lesson.length === 0 || lesson[0].type !== 'quiz') {
            throw createError('Quiz not found', 404)
        }

        const courseId = lesson[0].course_id

        const purchased = await query<any[]>(
            'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        )

        if (purchased.length === 0) {
            throw createError('Course not purchased', 403)
        }

        // Get quiz questions
        const questions = await query<QuizQuestion[]>(
            `SELECT id, lesson_id, question, type, explanation, hint, points, time_limit, sort_order
             FROM quiz_questions
             WHERE lesson_id = ?
             ORDER BY sort_order ASC`,
            [lessonId]
        )

        if (questions.length === 0) {
            throw createError('No questions found for this quiz', 404)
        }

        // Get answers for all questions
        const questionIds = questions.map(q => q.id)
        const placeholders = questionIds.map(() => '?').join(',')
        const answers = await query<QuizAnswer[]>(
            `SELECT id, question_id, answer_text, is_correct, sort_order
             FROM quiz_answers
             WHERE question_id IN (${placeholders})
             ORDER BY question_id, sort_order ASC`,
            questionIds
        )

        // Get quiz settings
        const settingsResult = await query<QuizSettings[]>(
            'SELECT * FROM quiz_settings WHERE lesson_id = ?',
            [lessonId]
        )

        const settings = settingsResult[0] || {
            passing_score: 70,
            max_attempts: -1,
            shuffle_questions: false,
            shuffle_answers: true,
            show_explanations: true,
            require_pass: true
        }

        // Get user's previous attempts
        const attempts = await query<QuizAttempt[]>(
            `SELECT id, score, max_score, percentage, passed, attempt_number, time_spent, created_at, answers_data
             FROM quiz_attempts
             WHERE user_id = ? AND lesson_id = ?
             ORDER BY attempt_number DESC`,
            [user.id, lessonId]
        )

        // Check if user can attempt
        const canAttempt = settings.max_attempts === -1 || attempts.length < settings.max_attempts

        // Get best score
        const bestScore = attempts.length > 0
            ? Math.max(...attempts.map(a => a.percentage))
            : undefined

        // Format response
        const questionsMap = new Map<number, any>()
        questions.forEach(q => {
            questionsMap.set(q.id, {
                id: q.id,
                question: q.question,
                type: q.type,
                answers: [],
                explanation: settings.show_explanations ? q.explanation : null,
                hint: q.hint,
                points: q.points,
                timeLimit: q.time_limit
            })
        })

        answers.forEach(a => {
            const question = questionsMap.get(a.question_id)
            if (question) {
                question.answers.push({
                    id: a.id,
                    text: a.answer_text,
                    // Don't send correct answers to client
                    isCorrect: undefined
                })
            }
        })

        // Shuffle questions if enabled
        let formattedQuestions = Array.from(questionsMap.values())
        if (settings.shuffle_questions) {
            formattedQuestions = shuffleArray(formattedQuestions)
        }

        // Shuffle answers if enabled
        if (settings.shuffle_answers) {
            formattedQuestions.forEach(q => {
                q.answers = shuffleArray(q.answers)
            })
        }

        const response: QuizDataResponse = {
            questions: formattedQuestions,
            settings: {
                passingScore: settings.passing_score,
                maxAttempts: settings.max_attempts,
                shuffleQuestions: settings.shuffle_questions === 1,
                shuffleAnswers: settings.shuffle_answers === 1,
                showExplanations: settings.show_explanations === 1,
                requirePass: settings.require_pass === 1
            },
            userAttempts: attempts.map(a => ({
                id: a.id,
                score: a.score,
                maxScore: a.max_score,
                percentage: a.percentage,
                passed: a.passed === 1,
                attemptNumber: a.attempt_number,
                timeSpent: a.time_spent,
                createdAt: a.created_at.toString()
            })),
            canAttempt,
            bestScore
        }

        res.json({
            success: true,
            data: response
        })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/quiz/:lessonId/submit
 * Submit quiz attempt
 */
export async function submitQuizAttempt(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user!
        const lessonId = parseInt(req.params.lessonId as string, 10)
        const { answers, timeSpent } = req.body

        if (isNaN(lessonId)) {
            throw createError('Invalid lesson ID', 400)
        }

        if (!answers || typeof answers !== 'object') {
            throw createError('Invalid answers format', 400)
        }

        // Get lesson and course
        const lesson = await query<any[]>(
            'SELECT course_id, type FROM lessons WHERE id = ?',
            [lessonId]
        )

        if (lesson.length === 0 || lesson[0].type !== 'quiz') {
            throw createError('Quiz not found', 404)
        }

        const courseId = lesson[0].course_id

        // Check access
        const purchased = await query<any[]>(
            'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        )

        if (purchased.length === 0) {
            throw createError('Course not purchased', 403)
        }

        // Get quiz settings
        const settingsResult = await query<QuizSettings[]>(
            'SELECT * FROM quiz_settings WHERE lesson_id = ?',
            [lessonId]
        )

        const settings = settingsResult[0] || {
            passing_score: 70,
            max_attempts: -1,
            require_pass: true
        }

        // Check attempt limit
        const previousAttempts = await query<QuizAttempt[]>(
            'SELECT id FROM quiz_attempts WHERE user_id = ? AND lesson_id = ?',
            [user.id, lessonId]
        )

        if (settings.max_attempts !== -1 && previousAttempts.length >= settings.max_attempts) {
            throw createError('Maximum attempts reached', 403)
        }

        // Get correct answers
        const questions = await query<QuizQuestion[]>(
            'SELECT id, points FROM quiz_questions WHERE lesson_id = ?',
            [lessonId]
        )

        const questionIds = questions.map(q => q.id)
        const placeholders = questionIds.map(() => '?').join(',')
        const correctAnswers = await query<QuizAnswer[]>(
            `SELECT question_id, id, is_correct
             FROM quiz_answers
             WHERE question_id IN (${placeholders})
             AND is_correct = 1`,
            questionIds
        )

        // Build correct answers map
        const correctMap = new Map<number, Set<number>>()
        correctAnswers.forEach(a => {
            if (!correctMap.has(a.question_id)) {
                correctMap.set(a.question_id, new Set())
            }
            correctMap.get(a.question_id)!.add(a.id)
        })

        // Grade the quiz
        let totalScore = 0
        let maxScore = 0
        const detailedAnswers: any = {}

        questions.forEach(q => {
            const question = questions.find(qu => qu.id === q.id)!
            maxScore += question.points

            const userAnswer = answers[q.id]
            const correctAnswerIds = correctMap.get(q.id) || new Set()

            let isCorrect = false
            if (Array.isArray(userAnswer)) {
                // Multiple choice - all must match
                const userSet = new Set(userAnswer)
                isCorrect = userSet.size === correctAnswerIds.size &&
                    [...userSet].every(id => correctAnswerIds.has(id))
            } else {
                // Single choice or text
                isCorrect = correctAnswerIds.has(userAnswer)
            }

            if (isCorrect) {
                totalScore += question.points
            }

            detailedAnswers[q.id] = {
                userAnswer,
                correct: isCorrect,
                correctAnswers: Array.from(correctAnswerIds)
            }
        })

        const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
        const passed = percentage >= settings.passing_score
        const attemptNumber = previousAttempts.length + 1

        // Save attempt
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
                attemptNumber
            ]
        )

        // If passed, mark lesson as complete
        if (passed) {
            await query(
                `INSERT OR IGNORE INTO lesson_progress (user_id, course_id, lesson_id)
                 VALUES (?, ?, ?)`,
                [user.id, courseId, lessonId]
            )

            // Invalidate cache
            await cache.del(CACHE_KEYS.USER_COURSES(user.id))
        }

        const response: QuizAttemptResponse = {
            id: 0, // Would be from INSERT result
            score: totalScore,
            maxScore,
            percentage,
            passed,
            attemptNumber,
            timeSpent: timeSpent || null,
            createdAt: new Date().toISOString(),
            answersData: detailedAnswers
        }

        res.json({
            success: true,
            data: response
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/quiz/:lessonId/remedial
 * Get remedial content for failed quiz
 */
export async function getRemedialContent(
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

        // Check if user has failed attempts
        const failedAttempts = await query<QuizAttempt[]>(
            `SELECT id FROM quiz_attempts
             WHERE user_id = ? AND lesson_id = ? AND passed = 0`,
            [user.id, lessonId]
        )

        if (failedAttempts.length === 0) {
            throw createError('No failed attempts found', 404)
        }

        // Get remedial content
        const content = await query<RemedialContent[]>(
            `SELECT id, title, content, content_type, media_url, sort_order
             FROM remedial_content
             WHERE lesson_id = ?
             ORDER BY sort_order ASC`,
            [lessonId]
        )

        const response: RemedialContentResponse[] = content.map(c => ({
            id: c.id,
            title: c.title,
            content: c.content,
            contentType: c.content_type,
            mediaUrl: c.media_url
        }))

        res.json({
            success: true,
            data: response
        })
    } catch (error) {
        next(error)
    }
}

// Utility function to shuffle array
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}
