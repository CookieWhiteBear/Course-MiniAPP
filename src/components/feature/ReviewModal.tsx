import { motion, AnimatePresence } from "framer-motion"
import { Star, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

interface ReviewModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (_rating: number, _comment: string) => void
    courseTitle: string
    initialRating?: number
    initialComment?: string
}

export function ReviewModal({
    isOpen,
    onClose,
    onSubmit,
    courseTitle,
    initialRating,
    initialComment
}: ReviewModalProps) {
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState("")
    const [hoverRating, setHoverRating] = useState(0)
    const { t } = useI18n()

    useEffect(() => {
        if (!isOpen) return
        setRating(initialRating ?? 0)
        setComment(initialComment ?? "")
        setHoverRating(0)
    }, [isOpen, initialRating, initialComment])

    const handleSubmit = () => {
        onSubmit(rating, comment)
        onClose()
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="w-full max-w-md bg-[#1c1c1e] border border-white/10 rounded-3xl p-6 pointer-events-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white">{t("review.title")}</h2>
                                    <p className="text-sm text-white/50">{courseTitle}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="rounded-full hover:bg-white/10 text-white/50 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Stars */}
                            <div className="flex items-center justify-center gap-2 mb-8">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => setRating(star)}
                                        className="p-1 transition-transform hover:scale-110 focus:outline-none"
                                    >
                                        <Star
                                            className={cn(
                                                "w-8 h-8 transition-colors",
                                                (hoverRating || rating) >= star
                                                    ? "fill-yellow-500 text-yellow-500"
                                                    : "fill-transparent text-white/20"
                                            )}
                                        />
                                    </button>
                                ))}
                            </div>

                            {/* Comment */}
                            <div className="space-y-4">
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder={t("review.placeholder")}
                                    className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                />

                                <Button
                                    onClick={handleSubmit}
                                    disabled={rating === 0}
                                    className="w-full h-12 rounded-xl text-base font-medium"
                                >
                                    {t("review.submit")}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
