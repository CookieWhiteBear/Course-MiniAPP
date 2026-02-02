import { useState, useEffect, useLayoutEffect, useRef, type UIEvent } from "react"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import { ChevronLeft, Loader2 } from "lucide-react"
import { LessonFooter } from "@/components/feature/LessonFooter"
import { Button } from "@/components/ui/button"
import { ReviewModal } from "@/components/feature/ReviewModal"
import { Quiz } from "@/components/feature/Quiz"
import { RemedialContent } from "@/components/feature/RemedialContent"
import { VideoPlayer } from "@/components/feature/VideoPlayer"
import { CloudflareStreamPlayer } from "@/components/feature/CloudflareStreamPlayer"
import { useCourse, useCourseLessons, useCourseProgress } from "@/hooks/useApi"
import { useCloudflareStream } from "@/hooks/useCloudflareStream"
import * as api from "@/lib/api"
import { parseMarkdown, stripMarkdown } from "@/lib/markdown"
import { useI18n } from "@/lib/i18n"

/**
 * Lesson Content Component with Cloudflare Stream support
 */
function LessonContent({
    content,
    highlightTerm,
    isVideoOnly = false
}: {
    content: string
    highlightTerm: string
    isVideoOnly?: boolean
}) {
    const parsedHtml = highlightTerm
        ? parseMarkdown(content).replace(
            new RegExp(`(${highlightTerm})`, 'gi'),
            '<mark class="bg-yellow-500/30 text-white px-1 rounded">$1</mark>'
        )
        : parseMarkdown(content)

    const contentRef = useCloudflareStream(parsedHtml)

    return (
        <div
            ref={contentRef}
            data-video-only={isVideoOnly ? 'true' : undefined}
            className={`text-base text-white/80 leading-relaxed lesson-content${isVideoOnly ? ' w-full h-full' : ''}`}
            dangerouslySetInnerHTML={{ __html: parsedHtml }}
        />
    )
}

export function LessonPage() {
    const { id } = useParams()
    const courseId = Number(id)
    const navigate = useNavigate()
    const [currentIndex, setCurrentIndex] = useState(0)
    const [direction, setDirection] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")
    const [highlightTerm, setHighlightTerm] = useState("")
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [hasReviewed, setHasReviewed] = useState(false)
    const [reviewLoaded, setReviewLoaded] = useState(false)
    const [backButtonExpanded, setBackButtonExpanded] = useState(false)
    const [isContentExpanded, setIsContentExpanded] = useState(false)
    const [showRemedialContent, setShowRemedialContent] = useState(false)
    const [quizPassed, setQuizPassed] = useState<Record<number, boolean>>({})
    const [quizHeaderTitle, setQuizHeaderTitle] = useState<string | null>(null)
    const [topBarHeight, setTopBarHeight] = useState(0)
    const topBarRef = useRef<HTMLDivElement | null>(null)
    const { t } = useI18n()

    // Load lessons from API
    const { data: lessonSteps, loading, error } = useCourseLessons(courseId)
    const { data: progressData, refetch: refetchProgress } = useCourseProgress(courseId)
    const { data: course } = useCourse(courseId)

    useEffect(() => {
        let active = true
        setReviewLoaded(false)
        api.getMyReview(courseId)
            .then((review) => {
                if (!active) return
                setHasReviewed(!!review)
                setReviewLoaded(true)
            })
            .catch(() => {
                if (!active) return
                setHasReviewed(false)
                setReviewLoaded(true)
            })
        return () => {
            active = false
        }
    }, [courseId])

    // Start from last completed lesson
    useEffect(() => {
        if (progressData && lessonSteps && progressData.completedLessonIds.length > 0) {
            const lastCompletedIndex = lessonSteps.findIndex(
                l => l.id === progressData.completedLessonIds[progressData.completedLessonIds.length - 1]
            )
            if (lastCompletedIndex >= 0 && lastCompletedIndex < lessonSteps.length - 1) {
                setCurrentIndex(lastCompletedIndex + 1)
            }
        }
    }, [progressData, lessonSteps])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!progressData || !lessonSteps) return

        const completed = new Set(progressData.completedLessonIds)
        lessonSteps
            .filter(step => step.type === 'quiz')
            .forEach(step => {
                if (completed.has(step.id)) return
                const key = `quiz_progress_${courseId}_${step.id}`
                const raw = localStorage.getItem(key)
                if (!raw) return
                try {
                    const parsed = JSON.parse(raw)
                    if (parsed?.result?.passed) {
                        localStorage.removeItem(key)
                    }
                } catch {
                    localStorage.removeItem(key)
                }
            })
    }, [progressData, lessonSteps, courseId])

    const currentStep = lessonSteps?.[currentIndex]
    const progress = lessonSteps ? ((currentIndex + 1) / lessonSteps.length) * 100 : 0
    const currentContent = currentStep?.content || ''
    const streamTagRegex = /\{\{CLOUDFLARE_STREAM:[a-f0-9]{32}\}\}/gi
    const streamMatches = currentContent.match(streamTagRegex) || []
    const streamMatch = currentContent.match(/\{\{CLOUDFLARE_STREAM:([a-f0-9]{32})\}\}/i)
    const streamVideoId = streamMatch?.[1] || null
    const isStreamOnly = currentStep?.type === 'text'
        && streamMatches.length === 1
        && currentContent.replace(streamTagRegex, '').trim() === ''
    const isFullBleedVideo = currentStep?.type === 'video' || isStreamOnly
    const VIDEO_UI_BOTTOM_INSET = 96
    const isExpanded = isContentExpanded && !isFullBleedVideo

    useEffect(() => {
        setIsContentExpanded(false)
    }, [currentIndex])

    useEffect(() => {
        if (currentStep?.type === 'quiz') {
            const initialTitle = currentStep.quiz?.questions?.[0]?.question
            setQuizHeaderTitle(initialTitle ?? null)
        } else {
            setQuizHeaderTitle(null)
        }
    }, [currentStep?.id, currentStep?.type])

    useLayoutEffect(() => {
        if (!isExpanded) {
            setTopBarHeight(0)
            return
        }

        const element = topBarRef.current
        if (!element) return

        const updateHeight = () => {
            setTopBarHeight(element.getBoundingClientRect().height)
        }

        updateHeight()
        const frame = requestAnimationFrame(updateHeight)
        const observer = new ResizeObserver(updateHeight)
        observer.observe(element)
        return () => {
            cancelAnimationFrame(frame)
            observer.disconnect()
        }
    }, [isExpanded])


    // Check for completion
    useEffect(() => {
        if (currentStep?.type === 'completion' && reviewLoaded && !hasReviewed && !showReviewModal) {
            const timer = setTimeout(() => setShowReviewModal(true), 500)
            return () => clearTimeout(timer)
        }
    }, [currentStep, hasReviewed, reviewLoaded, showReviewModal])

    useEffect(() => {
        if (!lessonSteps || !progressData || !reviewLoaded || hasReviewed || showReviewModal) return
        if (progressData.total <= 0 || progressData.completed < progressData.total) return
        const lastLessonId = lessonSteps[lessonSteps.length - 1]?.id
        if (!lastLessonId) return
        if (!progressData.completedLessonIds.includes(lastLessonId)) return

        const timer = setTimeout(() => setShowReviewModal(true), 500)
        return () => clearTimeout(timer)
    }, [lessonSteps, progressData, reviewLoaded, hasReviewed, showReviewModal])

    // Mark lesson as complete when moving to next
    const markComplete = async (lessonId: number) => {
        try {
            await api.markLessonComplete(courseId, lessonId)
        } catch (err) {
            console.error('Failed to mark lesson complete:', err)
        }
    }

    const isQuizCompleted = (lessonId: number) => {
        if (quizPassed[lessonId]) return true
        if (progressData?.completedLessonIds?.includes(lessonId)) return true
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(`quiz_progress_${courseId}_${lessonId}`)
                if (!saved) return false
                const parsed = JSON.parse(saved)
                return Boolean(parsed?.result?.passed)
            } catch {
                return false
            }
        }
        return false
    }

    const handleNext = () => {
        if (lessonSteps && currentIndex < lessonSteps.length - 1) {
            // Block if current step is quiz and not passed
            if (currentStep?.type === 'quiz' && currentStep?.id && !isQuizCompleted(currentStep.id)) {
                // Don't allow next - quiz must be passed
                return
            }

            // Mark current lesson as complete
            if (currentStep) {
                markComplete(currentStep.id)
            }
            setHighlightTerm("")
            setDirection(1)
            setCurrentIndex(prev => prev + 1)
        }
    }

    const handleQuizComplete = (passed: boolean, lessonId: number) => {
        if (passed) {
            setQuizPassed(prev => ({ ...prev, [lessonId]: true }))
            markComplete(lessonId)
            refetchProgress()
        }
    }

    const handleShowRemedial = () => {
        setShowRemedialContent(true)
    }

    const handleRetryQuiz = () => {
        setShowRemedialContent(false)
        // Force re-render by incrementing a key or refetching quiz data
    }

    const handlePrev = () => {
        if (currentIndex > 0) {
            setHighlightTerm("")
            setDirection(-1)
            setCurrentIndex(prev => prev - 1)
        }
    }

    const handleReviewSubmit = async (rating: number, comment: string) => {
        try {
            await api.submitReview(courseId, rating, comment || undefined)
            setHasReviewed(true)
            setShowReviewModal(false)
        } catch (err) {
            console.error('Failed to submit review:', err)
        }
    }

    // Swipe handling
    const SWIPE_THRESHOLD = 50
    const onDragEnd = (_: unknown, info: PanInfo) => {
        if (info.offset.x < -SWIPE_THRESHOLD) {
            handleNext()
        } else if (info.offset.x > SWIPE_THRESHOLD) {
            handlePrev()
        }
    }

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? "100%" : "-100%",
            opacity: 0,
            scale: 0.95,
            rotateY: direction > 0 ? 10 : -10
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1,
            rotateY: 0
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? "100%" : "-100%",
            opacity: 0,
            scale: 0.95,
            rotateY: direction < 0 ? 10 : -10
        })
    }

    // Filter results
    const searchResults = (lessonSteps || []).filter(step => {
        if (!searchQuery) return false
        const lowerQuery = searchQuery.toLowerCase()
        return step.title.toLowerCase().includes(lowerQuery) ||
            step.content.toLowerCase().includes(lowerQuery)
    })

    const handleJumpTo = (index: number) => {
        setHighlightTerm(searchQuery)
        setCurrentIndex(index)
        setSearchQuery("")
    }

    const handleSearch = (query: string) => {
        setSearchQuery(query)
    }

    const handleContentScroll = (event: UIEvent<HTMLDivElement>) => {
        if (isFullBleedVideo) return
        const nextExpanded = event.currentTarget.scrollTop > 0
        if (nextExpanded !== isContentExpanded) {
            setIsContentExpanded(nextExpanded)
        }
    }
    const expandedCardStyle = isExpanded
        ? { top: 0, bottom: "92px", left: 0, right: 0 }
        : undefined

    const lessonTitle = currentStep?.type === 'quiz'
        ? quizHeaderTitle
        : currentStep?.title

    const stripLeadingHeading = (content: string, title?: string) => {
        if (!content || !title) return content
        const headingMatch = content.match(/^\s*#{1,6}\s+(.+)\s*(?:\r?\n|$)/)
        if (!headingMatch) return content
        const headingText = headingMatch[1]?.trim()
        if (!headingText) return content
        if (headingText.toLowerCase() !== title.trim().toLowerCase()) return content
        const withoutHeading = content.slice(headingMatch[0].length)
        return withoutHeading.replace(/^\s*\n/, '')
    }

    const contentToRender = currentStep?.type === 'text' && !isStreamOnly
        ? stripLeadingHeading(currentContent, currentStep?.title)
        : currentContent

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !lessonSteps || lessonSteps.length === 0) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-10">
                <p className="text-red-400 mb-4">{error || t('lesson.notFound')}</p>
                <Button onClick={() => navigate(-1)}>{t('common.back')}</Button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black text-white flex flex-col">
            {/* Collapsible Back Button - Middle Left */}
            <motion.div
                initial={{ x: -28 }}
                animate={{ x: backButtonExpanded ? 0 : -28 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                drag="x"
                dragConstraints={{ left: 0, right: 40 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                    if (info.offset.x > 20) {
                        setBackButtonExpanded(true)
                    } else if (info.offset.x < -10) {
                        setBackButtonExpanded(false)
                    }
                }}
                className="fixed top-1/2 -translate-y-1/2 left-0 z-50"
            >
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        if (backButtonExpanded) {
                            navigate(-1)
                        } else {
                            setBackButtonExpanded(true)
                        }
                    }}
                    className="text-white rounded-r-full bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/10 border-l-0 w-14 h-14 flex items-center justify-end pr-3"
                >
                    <ChevronLeft className={backButtonExpanded ? "" : "opacity-60"} />
                </Button>
            </motion.div>

            {/* Top Bar - Only lesson counter */}
            <div ref={topBarRef} className={`absolute top-0 left-0 right-0 px-4 z-50 flex items-center justify-center transition-all duration-300 ${isExpanded ? "bg-black/70 backdrop-blur-md" : "pt-[50px] pb-4 bg-gradient-to-b from-black/80 to-transparent"}`} style={isExpanded ? { paddingTop: "calc(env(safe-area-inset-top) + 5px)", paddingBottom: "5px" } : undefined}>
                <span className="text-sm font-medium text-white/50">
                    {t('lesson.counter', { current: currentIndex + 1, total: lessonSteps.length })}
                </span>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center perspective-1000">
                {/* Search Results Overlay */}
                <AnimatePresence>
                    {searchQuery && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute inset-0 z-40 bg-black/90 backdrop-blur-sm p-6 pt-24 overflow-y-auto"
                        >
                            <h3 className="text-lg font-semibold mb-4 text-white/70">
                                {t('lesson.searchResults', { count: searchResults.length, query: searchQuery })}
                            </h3>
                            <div className="space-y-3">
                                {searchResults.map(step => {
                                    const index = lessonSteps.findIndex(s => s.id === step.id)
                                    const cleanContent = stripMarkdown(step.content)
                                    return (
                                        <div
                                            key={step.id}
                                            onClick={() => handleJumpTo(index)}
                                            className="p-4 rounded-xl bg-white/10 border border-white/10 active:scale-95 transition-all cursor-pointer"
                                        >
                                            <h4 className="font-semibold text-white">{step.title}</h4>
                                            <p className="text-sm text-white/50 line-clamp-2">{cleanContent}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Swipeable Card */}
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={currentIndex}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.7}
                        onDragEnd={onDragEnd}
                        className={isFullBleedVideo
                            ? "absolute inset-0 overflow-hidden"
                            : `absolute overflow-hidden shadow-2xl transition-all duration-300 ease-out ${isExpanded
                                ? "rounded-none"
                                : "inset-6 top-24 bottom-36 rounded-3xl"
                            }`
                        }
                        style={{ transformStyle: "preserve-3d", ...expandedCardStyle }}
                    >
                        <div className={isFullBleedVideo
                            ? "w-full h-full bg-black flex flex-col overflow-hidden touch-pan-y"
                            : `w-full h-full bg-gradient-to-b from-white/5 to-white/0 ${isExpanded ? "px-6 pb-6" : "p-6"} flex flex-col border border-white/10 backdrop-blur-sm overflow-y-auto touch-pan-y transition-all duration-300 ease-out ${isExpanded ? "rounded-none" : "rounded-3xl"}`
                        }
                            style={{
                                touchAction: "pan-y",
                                ...(isExpanded && !isFullBleedVideo
                                    ? { paddingTop: topBarHeight ? `${topBarHeight}px` : "calc(env(safe-area-inset-top) + 30px)" }
                                    : undefined)
                            }}
                            onScroll={isFullBleedVideo ? undefined : handleContentScroll}
                        >
                            {!isFullBleedVideo && lessonTitle && (
                                <h2 className="text-2xl font-bold mb-4">{lessonTitle}</h2>
                            )}

                            {/* Content based on type */}
                            {currentStep?.type === 'video' && currentStep.video && (
                                <div className={isFullBleedVideo ? "flex-1" : "mb-4"}>
                                    <VideoPlayer
                                        videoUrl={currentStep.video}
                                        nextVideoUrl={lessonSteps?.[currentIndex + 1]?.video || undefined}
                                        lessonId={currentStep.id}
                                        userId={1} // Will be replaced with actual user ID from auth
                                        fill={isFullBleedVideo}
                                        controlsInsetBottom={isFullBleedVideo ? VIDEO_UI_BOTTOM_INSET : undefined}
                                        className={isFullBleedVideo ? "w-full h-full" : "rounded-xl overflow-hidden"}
                                    />
                                </div>
                            )}

                            {currentStep?.type === 'image' && currentStep.image && (
                                <div className="mb-4 rounded-xl overflow-hidden">
                                    <img
                                        src={currentStep.image}
                                        alt={currentStep.title}
                                        className="w-full rounded-xl object-cover"
                                    />
                                </div>
                            )}

                            {currentStep?.type === 'quiz' && currentStep.quiz && !showRemedialContent && (
                                <div className="flex-1 overflow-y-auto" onScroll={handleContentScroll}>
                                    <Quiz
                                        courseId={courseId}
                                        lessonId={currentStep.id}
                                        quizData={currentStep.quiz}
                                        onComplete={(passed) => handleQuizComplete(passed, currentStep.id)}
                                        onShowRemedial={handleShowRemedial}
                                        onQuestionChange={setQuizHeaderTitle}
                                        hideQuestionTitle
                                    />
                                </div>
                            )}

                            {currentStep?.type === 'quiz' && showRemedialContent && (
                                <div className="flex-1 overflow-y-auto" onScroll={handleContentScroll}>
                                    <RemedialContent
                                        courseId={courseId}
                                        lessonId={currentStep.id}
                                        onClose={() => setShowRemedialContent(false)}
                                        onRetry={handleRetryQuiz}
                                    />
                                </div>
                            )}

                            {isStreamOnly && streamVideoId && (
                                <div className="flex-1">
                                    <CloudflareStreamPlayer
                                        videoId={streamVideoId}
                                        controls={true}
                                        autoplay={false}
                                        fill={true}
                                        bottomInset={VIDEO_UI_BOTTOM_INSET}
                                    />
                                </div>
                            )}

                            {currentStep?.type === 'text' && !isStreamOnly && (
                                <LessonContent
                                    content={contentToRender}
                                    highlightTerm={highlightTerm}
                                />
                            )}

                            {currentStep?.type === 'completion' && (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="text-4xl">{t('common.done')}</span>
                                        </div>
                                        <p className="text-xl font-bold text-green-400">{t('lesson.completionTitle')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer with Progress */}
            <LessonFooter
                progress={progress}
                currentPage={currentIndex}
                totalPages={lessonSteps.length}
                onPrev={handlePrev}
                onNext={handleNext}
                onSearch={handleSearch}
            />

            {/* Review Modal */}
            <ReviewModal
                isOpen={showReviewModal}
                onClose={() => {
                    setShowReviewModal(false)
                    setHasReviewed(true)
                }}
                onSubmit={handleReviewSubmit}
                courseTitle={course?.title || t('lesson.reviewCourseFallback')}
            />
        </div>
    )
}
