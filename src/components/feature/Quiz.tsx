import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { CheckCircle, AlertCircle, Award, RefreshCw, ChevronRight, Lightbulb } from 'lucide-react'
import { Button } from '../ui/button'
import { BrandingButton } from '../ui/branding-button'
import { Progress } from '../ui/progress'
import type { QuizData, QuizAttempt } from '../../lib/api'
import { submitQuizAttempt } from '../../lib/api'
import { cn } from '../../lib/utils'
import { useI18n } from '@/lib/i18n'

interface QuizProps {
    courseId: number
    lessonId: number
    quizData: QuizData
    onComplete: (_passed: boolean) => void
    onShowRemedial: () => void
    onQuestionChange?: (_title: string) => void
    hideQuestionTitle?: boolean
}

export function Quiz({
    courseId,
    lessonId,
    quizData,
    onComplete,
    onShowRemedial,
    onQuestionChange,
    hideQuestionTitle = false
}: QuizProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [answers, setAnswers] = useState<Record<number, number | number[]>>({})
    const [showResult, setShowResult] = useState(false)
    const [result, setResult] = useState<QuizAttempt | null>(null)
    const [timeSpent, setTimeSpent] = useState(0)
    const [showHint, setShowHint] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [direction, setDirection] = useState(0)
    const { t } = useI18n()

    const STORAGE_KEY = `quiz_progress_${courseId}_${lessonId}`
    const quizActionButtonClassName = "h-[41px] px-7 rounded-full"

    const currentQuestion = quizData.questions[currentQuestionIndex]
    const totalQuestions = quizData.questions.length
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100

    useEffect(() => {
        if (currentQuestion?.question && onQuestionChange) {
            onQuestionChange(currentQuestion.question)
        }
    }, [currentQuestion?.question, onQuestionChange])

    // Restore saved progress on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setAnswers(parsed.answers || {})
                setCurrentQuestionIndex(parsed.currentIndex || 0)
                setTimeSpent(parsed.timeSpent || 0)
                // Restore completed quiz result if exists
                if (parsed.result) {
                    setResult(parsed.result)
                    setShowResult(true)
                }
            } catch (e) {
                console.error('Failed to restore quiz progress:', e)
            }
        }
    }, [STORAGE_KEY])

    // Save progress on every change
    useEffect(() => {
        // Don't save if no answers yet
        if (Object.keys(answers).length === 0 && !result) return

        const saveData: {
            answers: Record<number, number | number[]>
            currentIndex: number
            timeSpent: number
            savedAt: number
            result?: QuizAttempt
        } = {
            answers,
            currentIndex: currentQuestionIndex,
            timeSpent,
            savedAt: Date.now()
        }

        // If quiz completed, save result too
        if (result) {
            saveData.result = result
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
    }, [answers, currentQuestionIndex, timeSpent, result, STORAGE_KEY])

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeSpent(prev => prev + 1)
        }, 1000)

        return () => clearInterval(interval)
    }, [])

    // Handle answer selection
    const handleAnswerSelect = useCallback((answerId: number) => {
        if (!currentQuestion) return

        if (currentQuestion.type === 'multiple') {
            const currentAnswers = (answers[currentQuestion.id] as number[]) || []
            const newAnswers = currentAnswers.includes(answerId)
                ? currentAnswers.filter(id => id !== answerId)
                : [...currentAnswers, answerId]
            setAnswers(prev => ({ ...prev, [currentQuestion.id]: newAnswers }))
        } else {
            setAnswers(prev => ({ ...prev, [currentQuestion.id]: answerId }))
        }
    }, [currentQuestion, answers])

    // Navigate to next question
    const handleNext = useCallback(() => {
        if (currentQuestionIndex < totalQuestions - 1) {
            setDirection(1)
            setCurrentQuestionIndex(prev => prev + 1)
            setShowHint(false)
        }
    }, [currentQuestionIndex, totalQuestions])

    // Navigate to previous question
    const handlePrevious = useCallback(() => {
        if (currentQuestionIndex > 0) {
            setDirection(-1)
            setCurrentQuestionIndex(prev => prev - 1)
            setShowHint(false)
        }
    }, [currentQuestionIndex])

    // Submit quiz
    const handleSubmit = useCallback(async () => {
        if (isSubmitting) return

        try {
            setIsSubmitting(true)
            const attemptResult = await submitQuizAttempt(courseId, lessonId, answers, timeSpent)
            setResult(attemptResult)
            setShowResult(true)
            // Result will be saved to localStorage by useEffect
            // Don't remove here - we want to preserve the completed state

            if (attemptResult.passed) {
                onComplete(true)
            }
        } catch (error) {
            console.error('Failed to submit quiz:', error)
            alert(t('quiz.submitError'))
        } finally {
            setIsSubmitting(false)
        }
    }, [courseId, lessonId, answers, timeSpent, onComplete, isSubmitting, t])


    // Retry quiz
    const handleRetry = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY)
        setAnswers({})
        setCurrentQuestionIndex(0)
        setShowResult(false)
        setResult(null)
        setTimeSpent(0)
        setShowHint(false)
    }, [STORAGE_KEY])

    // Show remedial content
    const handleShowRemedial = useCallback(() => {
        onShowRemedial()
    }, [onShowRemedial])

    // Swipe handling
    const SWIPE_THRESHOLD = 50
    const onDragEnd = (_: unknown, info: PanInfo) => {
        if (info.offset.x < -SWIPE_THRESHOLD && isCurrentQuestionAnswered) {
            if (currentQuestionIndex < totalQuestions - 1) {
                setDirection(1)
                handleNext()
            }
        } else if (info.offset.x > SWIPE_THRESHOLD) {
            if (currentQuestionIndex > 0) {
                setDirection(-1)
                handlePrevious()
            }
        }
    }

    const variants = {
        enter: (directionValue: number) => ({
            x: directionValue > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
        },
        exit: (directionValue: number) => ({
            zIndex: 0,
            x: directionValue < 0 ? '100%' : '-100%',
            opacity: 0,
        }),
    }

    // Check if current question is answered
    const isCurrentQuestionAnswered = currentQuestion && answers[currentQuestion.id] !== undefined

    // Check if all questions are answered
    const allQuestionsAnswered = quizData.questions.every(q => answers[q.id] !== undefined)

    // Format time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Result screen
    if (showResult && result) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="quiz-result p-6 text-center"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className={cn(
                        'w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center backdrop-blur-md',
                        result.passed ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
                    )}
                >
                    {result.passed ? (
                        <Award className="w-12 h-12 text-green-400" />
                    ) : (
                        <AlertCircle className="w-12 h-12 text-red-400" />
                    )}
                </motion.div>

                <h2 className={cn(
                    'text-2xl font-bold mb-2',
                    result.passed ? 'text-green-400' : 'text-red-400'
                )}>
                    {result.passed ? t('quiz.passedTitle') : t('quiz.failedTitle')}
                </h2>

                <p className="text-white/60 mb-6">
                    {result.passed
                        ? t('quiz.passedSubtitle')
                        : t('quiz.failedSubtitle', { score: quizData.settings.passingScore })
                    }
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6 max-w-md mx-auto">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <p className="text-sm text-white/50 mb-1">{t('quiz.yourScore')}</p>
                        <p className="text-3xl font-bold text-accentpurple">
                            {Math.round(result.percentage)}%
                        </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <p className="text-sm text-white/50 mb-1">{t('quiz.points')}</p>
                        <p className="text-3xl font-bold text-accentpurple">
                            {result.score}/{result.maxScore}
                        </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <p className="text-sm text-white/50 mb-1">{t('quiz.time')}</p>
                        <p className="text-2xl font-bold text-white">
                            {formatTime(result.timeSpent || 0)}
                        </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <p className="text-sm text-white/50 mb-1">{t('quiz.attempt')}</p>
                        <p className="text-2xl font-bold text-white">
                            #{result.attemptNumber}
                        </p>
                    </div>
                </div>

                {!result.passed && (
                    <div className="space-y-3">
                        {quizData.canAttempt && (
                            <Button
                                onClick={handleRetry}
                                className="w-full max-w-md"
                                variant="default"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                {t('quiz.tryAgain')}
                            </Button>
                        )}
                        <Button
                            onClick={handleShowRemedial}
                            className="w-full max-w-md"
                            variant="outline"
                        >
                            <Lightbulb className="w-4 h-4 mr-2" />
                            {t('quiz.reviewMaterials')}
                        </Button>
                    </div>
                )}

                {result.passed && quizData.settings.showExplanations && Boolean(result.answersData) && (
                    <div className="mt-6">
                        <Button
                            onClick={() => setShowResult(false)}
                            variant="outline"
                            className="max-w-md"
                        >
                            {t('quiz.reviewExplanations')}
                        </Button>
                    </div>
                )}
            </motion.div>
        )
    }

    // Quiz not started or can't attempt
    if (!quizData.canAttempt) {
        return (
            <div className="quiz-blocked p-6 text-center">
                <AlertCircle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2 text-white">{t('quiz.noAttemptsTitle')}</h2>
                <p className="text-white/60 mb-4">
                    {t('quiz.noAttemptsSubtitle', { max: quizData.settings.maxAttempts })}
                </p>
                {quizData.bestScore !== undefined && (
                    <p className="text-sm text-white/50">
                        {t('quiz.bestScore', { score: Math.round(quizData.bestScore) })}
                    </p>
                )}
            </div>
        )
    }

    // Quiz in progress
    return (
        <div className="quiz-container">
            {/* Header */}
            <div className="quiz-header pb-4 border-b border-white/10 mb-6">
                <div className="flex items-center justify-center mb-3">
                    <div className="text-sm text-white/60">
                        {t('quiz.questionCounter', { current: currentQuestionIndex + 1, total: totalQuestions })}
                    </div>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            {/* Question */}
            <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                    key={currentQuestion.id}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.7}
                    onDragEnd={onDragEnd}
                    className="quiz-question mb-6"
                >
                    {!hideQuestionTitle && (
                        <h3 className="text-xl font-bold mb-4 text-white">
                            {currentQuestion.question}
                        </h3>
                    )}

                    {/* Hint */}
                    {currentQuestion.hint && (
                        <div className="mb-4">
                            <button
                                onClick={() => setShowHint(!showHint)}
                                className="text-sm text-accentpurple hover:text-accentpurple/80 flex items-center gap-1"
                            >
                                <Lightbulb className="w-4 h-4" />
                                {showHint ? t('quiz.hideHint') : t('quiz.showHint')}
                            </button>
                            <AnimatePresence>
                                {showHint && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-2 p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70"
                                    >
                                        {currentQuestion.hint}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Answers */}
                    <div className="space-y-3">
                        {currentQuestion.answers.map((answer) => {
                            const isSelected = currentQuestion.type === 'multiple'
                                ? ((answers[currentQuestion.id] as number[]) || []).includes(answer.id)
                                : answers[currentQuestion.id] === answer.id

                            return (
                                <motion.button
                                    key={answer.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleAnswerSelect(answer.id)}
                                    className={cn(
                                        'w-full p-4 rounded-xl border border-white/10 text-left transition-all backdrop-blur-sm',
                                        isSelected
                                            ? 'border-accentpurple bg-accentpurple/10'
                                            : 'bg-white/5 hover:bg-white/10 hover:border-white/20'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                                            isSelected
                                                ? 'border-accentpurple bg-accentpurple'
                                                : 'border-white/30'
                                        )}>
                                            {isSelected && (
                                                <CheckCircle className="w-4 h-4 text-white" />
                                            )}
                                        </div>
                                        <span className="text-white">{answer.text}</span>
                                    </div>
                                </motion.button>
                            )
                        })}
                    </div>

                    {/* Type hint for multiple choice */}
                    {currentQuestion.type === 'multiple' && (
                        <p className="text-xs text-white/40 mt-3 italic">
                            {t('quiz.multiSelectHint')}
                        </p>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="quiz-footer relative flex items-center justify-between pt-6 border-t border-white/10 overflow-hidden">
                <Button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    variant="outline"
                    className={quizActionButtonClassName}
                >
                    {t('quiz.back')}
                </Button>

                {currentQuestionIndex < totalQuestions - 1 ? (
                    <Button
                        onClick={handleNext}
                        disabled={!isCurrentQuestionAnswered}
                        className={quizActionButtonClassName}
                    >
                        {t('quiz.next')}
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                ) : (
                    <BrandingButton
                        onClick={handleSubmit}
                        disabled={!allQuestionsAnswered || isSubmitting}
                        text={isSubmitting ? t('quiz.submitting') : t('quiz.finish')}
                        className="shrink-0"
                        buttonClassName={quizActionButtonClassName}
                    />
                )}
            </div>
        </div>
    )
}

