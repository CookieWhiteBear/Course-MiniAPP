import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, Clock, BookOpen, Star, Loader2, Edit2, Trash2, ThumbsUp, ThumbsDown, MessageSquare, Send, Video, HelpCircle, PenTool, FolderKanban, Radio, FileText, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNavigate, useParams } from "react-router-dom"
import { PurchaseDrawer } from "@/components/feature/PurchaseDrawer"
import { ReviewModal } from "@/components/feature/ReviewModal"
import { useCourse, useUser, useUserCourses } from "@/hooks/useApi"
import type { Review } from "@/lib/api"
import * as api from "@/lib/api"
import { useI18n } from "@/lib/i18n"

const PROGRAM_ICONS = {
    video: Video,
    read: BookOpen,
    quiz: HelpCircle,
    practice: PenTool,
    project: FolderKanban,
    live: Radio,
    file: FileText,
    clock: Clock,
    code: Code2
}

const sortReviews = (items: Review[]) => {
    const order = new Map(items.map((item, index) => [item.id, index]))
    return [...items].sort((a, b) => {
        const netA = (a.likes ?? 0) - (a.dislikes ?? 0)
        const netB = (b.likes ?? 0) - (b.dislikes ?? 0)
        if (netA !== netB) {
            return netB - netA
        }
        return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    })
}

export function CoursePage() {
    const navigate = useNavigate()
    const { id } = useParams()
    const courseId = Number(id)
    const [backButtonExpanded, setBackButtonExpanded] = useState(false)
    const { t } = useI18n()
    const { user } = useUser()
    const { data: userCourses } = useUserCourses()
    const [myReview, setMyReview] = useState<Review | null>(null)
    const [reviewModalOpen, setReviewModalOpen] = useState(false)
    const [reviews, setReviews] = useState<Review[]>([])
    const [replyOpen, setReplyOpen] = useState<Record<number, boolean>>({})
    const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
    const [replySaving, setReplySaving] = useState<Record<number, boolean>>({})
    const [reactionSaving, setReactionSaving] = useState<Record<number, boolean>>({})

    // Fetch course from API
    const { data: course, loading, error, refetch } = useCourse(courseId)

    useEffect(() => {
        let active = true
        if (!Number.isFinite(courseId)) {
            setMyReview(null)
            return () => {
                active = false
            }
        }
        api.getMyReview(courseId)
            .then((review) => {
                if (active) setMyReview(review)
            })
            .catch(() => {
                if (active) setMyReview(null)
            })
        return () => {
            active = false
        }
    }, [courseId])

    const isAdmin = api.isAdmin(user?.telegramId)
    const iconButtonClass = "w-9 h-9 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/30 hover:bg-white/10 transition-colors flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"

    useEffect(() => {
        if (!course?.reviews) {
            setReviews([])
            return
        }
        setReviews(sortReviews(course.reviews))
    }, [course?.reviews])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !course) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background text-white p-10">
                <p className="text-red-400 mb-4">{error || t("course.notFound")}</p>
                <Button onClick={() => navigate(-1)}>{t("common.back")}</Button>
            </div>
        )
    }

    const reviewsCount = reviews.length || 0
    const lessonsCountLabel = course.lessonsCount !== undefined && course.lessonsCount !== null
        ? t("course.lessonsCount", { count: course.lessonsCount })
        : t("common.na")
    const isPurchased = !!userCourses?.some((item) => item.id === course.id)
    const courseProgram = (course.program || []).filter(Boolean)
    const programItems = courseProgram
        .map((item) => {
            const match = item.match(/<ico:([a-z0-9_-]+)>/i)
            const iconKey = match?.[1]?.toLowerCase()
            const text = item.replace(/<ico:[^>]+>/i, '').trim()
            const Icon = iconKey ? PROGRAM_ICONS[iconKey as keyof typeof PROGRAM_ICONS] : undefined
            if (!text) return null
            return { text, Icon }
        })
        .filter((item): item is { text: string; Icon: typeof Video | undefined } => item !== null)

    const handleReviewSubmit = async (rating: number, comment: string) => {
        await api.submitReview(course.id, rating, comment || undefined)
        await refetch()
        const updated = await api.getMyReview(course.id)
        setMyReview(updated)
        setReviewModalOpen(false)
    }

    const handleDeleteReview = async (reviewId: number) => {
        if (!confirm(t("review.confirmDelete"))) return
        await api.deleteReview(reviewId)
        await refetch()
    }

    const updateReviewById = (reviewId: number, updater: (review: Review) => Review) => {
        setReviews(prev => sortReviews(prev.map(review => review.id === reviewId ? updater(review) : review)))
    }

    const handleReaction = async (review: Review, nextValue: -1 | 1) => {
        if (reactionSaving[review.id]) return
        const current = review.myReaction ?? 0
        const value = current === nextValue ? 0 : nextValue
        setReactionSaving(prev => ({ ...prev, [review.id]: true }))
        try {
            const result = await api.reactReview(review.id, value)
            updateReviewById(review.id, existing => ({
                ...existing,
                likes: result.likes,
                dislikes: result.dislikes,
                myReaction: result.myReaction
            }))
        } catch (err) {
            console.error('Failed to set reaction:', err)
        } finally {
            setReactionSaving(prev => ({ ...prev, [review.id]: false }))
        }
    }

    const handleToggleReply = (review: Review) => {
        setReplyOpen(prev => {
            const next = !prev[review.id]
            if (next) {
                setReplyDrafts(drafts => ({
                    ...drafts,
                    [review.id]: drafts[review.id] ?? review.reply?.text ?? ''
                }))
            }
            return { ...prev, [review.id]: next }
        })
    }

    const handleSendReply = async (reviewId: number) => {
        const message = (replyDrafts[reviewId] || '').trim()
        if (!message) return
        setReplySaving(prev => ({ ...prev, [reviewId]: true }))
        try {
            const reply = await api.replyToReview(reviewId, message)
            updateReviewById(reviewId, existing => ({
                ...existing,
                reply: reply || undefined
            }))
            setReplyOpen(prev => ({ ...prev, [reviewId]: false }))
        } catch (err) {
            console.error('Failed to reply to review:', err)
        } finally {
            setReplySaving(prev => ({ ...prev, [reviewId]: false }))
        }
    }

    return (
        <motion.div
            className="min-h-screen bg-background text-white pb-40 overflow-hidden rounded-t-[30px] rounded-b-[30px] relative"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >
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
                    <ArrowLeft className={backButtonExpanded ? "w-5 h-5" : "w-5 h-5 opacity-60"} />
                </Button>
            </motion.div>

            {/* Sticky Branding Pill */}
            <div className="fixed top-[50px] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                <div className="px-4 py-1.5 rounded-full bg-background/80 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center justify-center">
                    <span className="text-xs font-medium tracking-wide text-white/90">{t("course.stickyPill")}</span>
                </div>
            </div>

            {/* Hero Section */}
            <div className="relative h-[45vh] w-full">
                <img
                    src={course.image}
                    className="w-full h-full object-cover rounded-b-[40px]"
                    alt={course.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-90 rounded-b-[40px]" />

                <div className="absolute bottom-0 left-0 right-0 p-6 z-10 space-y-2">
                    <Badge className="bg-blue-500/80 backdrop-blur-md text-white border-0 mb-2">{course.category}</Badge>
                    <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md leading-tight">{course.title}</h1>
                    <div className="flex items-center space-x-2 text-white/90 text-sm mt-2">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{course.rating}</span>
                        <span className="opacity-70">{t("course.reviewsCount", { count: reviewsCount })}</span>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="px-6 mt-6 space-y-8">
                {/* Instructor & Stats */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                            <img src={course.authorAvatar || "https://i.imgur.com/zOlPMhT.png"} alt={t("course.instructorAlt")} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">{course.author}</p>
                            <p className="text-xs text-muted-foreground">{t("course.authorLabel")}</p>
                        </div>
                    </div>

                    <div className="flex space-x-4 text-xs text-muted-foreground">
                        <div className="flex flex-col items-center">
                            <Clock className="w-4 h-4 mb-1" />
                            <span>{course.duration || t("common.na")}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <BookOpen className="w-4 h-4 mb-1" />
                            <span>{lessonsCountLabel}</span>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white">{t("course.aboutTitle")}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                        {course.description || t("course.aboutFallback")}
                    </p>
                </div>

                {/* Course Program */}
                {programItems.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-white">{t("course.programTitle")}</h3>
                        <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                            {programItems.map((item, index) => (
                                <div key={`${index}-${item.text}`} className="flex items-start gap-3 text-sm">
                                    {item.Icon ? (
                                        <item.Icon className="mt-0.5 h-4 w-4 text-primary/80" />
                                    ) : (
                                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/70" />
                                    )}
                                    <span className="text-white/80">{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reviews Section */}
                <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                        <h3 className="text-lg font-bold text-white">{t("course.reviewsTitle")}</h3>
                        <div className="flex items-center gap-3">
                            {!myReview && isPurchased && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                                    onClick={() => setReviewModalOpen(true)}
                                >
                                    {t("review.submit")}
                                </Button>
                            )}
                            {myReview && (
                                <button
                                    onClick={() => setReviewModalOpen(true)}
                                    className={iconButtonClass}
                                    aria-label={t("review.edit")}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                            {reviews.length > 3 && (
                                <button className="text-sm text-primary font-medium hover:text-primary/80 transition-colors">{t("course.reviewsAll")}</button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {reviews.length > 0 ? (
                            reviews.slice(0, 3).map((review: Review) => {
                                const likes = review.likes ?? 0
                                const dislikes = review.dislikes ?? 0
                                const myReaction = review.myReaction ?? 0
                                const isOwnReview = myReview?.id === review.id
                                const isReplying = !!replyOpen[review.id]
                                return (
                                    <div key={review.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                                                    {review.user.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{review.user}</p>
                                                    <p className="text-[10px] text-white/40">
                                                        {review.date}
                                                        {review.isEdited && ` - ${t("review.edited")}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-3 h-3 ${i < review.rating ? "fill-yellow-500 text-yellow-500" : "fill-transparent text-white/20"}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-sm text-white/70 leading-relaxed">
                                            {review.text}
                                        </p>
                                        {review.reply && (
                                            <div className="mt-3 pl-4 border-l border-white/10 space-y-1">
                                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                                                    {t("review.replyTitle")}
                                                </p>
                                                <p className="text-sm text-white/70 leading-relaxed">
                                                    {review.reply.text}
                                                </p>
                                                <p className="text-[10px] text-white/40">
                                                    {review.reply.author}
                                                    {review.reply.isEdited && ` - ${t("review.edited")}`}
                                                </p>
                                            </div>
                                        )}
                                        {isAdmin && isReplying && (
                                            <div className="mt-3 space-y-2">
                                                <textarea
                                                    value={replyDrafts[review.id] ?? ""}
                                                    onChange={(event) => setReplyDrafts(prev => ({ ...prev, [review.id]: event.target.value }))}
                                                    placeholder={t("review.replyPlaceholder")}
                                                    className="w-full min-h-[88px] bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                                                />
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={() => handleSendReply(review.id)}
                                                        disabled={replySaving[review.id]}
                                                        className={iconButtonClass}
                                                        aria-label={t("review.replySend")}
                                                    >
                                                        {replySaving[review.id]
                                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                                            : <Send className="w-4 h-4" />
                                                        }
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handleReaction(review, 1)}
                                                        disabled={reactionSaving[review.id]}
                                                        className={`${iconButtonClass} ${myReaction === 1 ? "border-primary/40 text-primary bg-primary/10" : ""}`}
                                                        aria-label={t("review.like")}
                                                    >
                                                        <ThumbsUp className={`w-4 h-4 ${myReaction === 1 ? "fill-primary text-primary" : ""}`} />
                                                    </button>
                                                    <span className="text-xs text-white/60">{likes}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handleReaction(review, -1)}
                                                        disabled={reactionSaving[review.id]}
                                                        className={`${iconButtonClass} ${myReaction === -1 ? "border-primary/40 text-primary bg-primary/10" : ""}`}
                                                        aria-label={t("review.dislike")}
                                                    >
                                                        <ThumbsDown className={`w-4 h-4 ${myReaction === -1 ? "fill-primary text-primary" : ""}`} />
                                                    </button>
                                                    <span className="text-xs text-white/60">{dislikes}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isOwnReview && (
                                                    <button
                                                        onClick={() => setReviewModalOpen(true)}
                                                        className={iconButtonClass}
                                                        aria-label={t("review.edit")}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <>
                                                        <button
                                                            onClick={() => handleToggleReply(review)}
                                                            className={iconButtonClass}
                                                            aria-label={isReplying ? t("common.close") : t("review.reply")}
                                                        >
                                                            <MessageSquare className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteReview(review.id)}
                                                            className={iconButtonClass}
                                                            aria-label={t("review.delete")}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-muted-foreground text-sm">{t("course.reviewsNone")}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Action Bar */}
            <PurchaseDrawer price={course.price} courseId={course.id} starsPrice={course.starsPrice} />

            <ReviewModal
                isOpen={reviewModalOpen}
                onClose={() => setReviewModalOpen(false)}
                onSubmit={handleReviewSubmit}
                courseTitle={course.title}
                initialRating={myReview?.rating}
                initialComment={myReview?.text}
            />
        </motion.div>
    )
}
