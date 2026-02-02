import { useEffect, useState } from "react"
import { CalendarIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { useI18n } from "@/lib/i18n"
import * as api from "@/lib/api"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function DashReviewsPage() {
    const { t } = useI18n()
    const [query, setQuery] = useState("")
    const [rating, setRating] = useState("all")
    const [courseId, setCourseId] = useState("")
    const [range, setRange] = useState<DateRange | undefined>(undefined)
    const [page, setPage] = useState(1)
    const [rows, setRows] = useState<api.AdminReviewItem[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [replyingId, setReplyingId] = useState<number | null>(null)
    const [replyText, setReplyText] = useState("")
    const [sending, setSending] = useState(false)
    const fromValue = range?.from ? format(range.from, "yyyy-MM-dd") : ""
    const toValue = range?.to ? format(range.to, "yyyy-MM-dd") : ""

    useEffect(() => {
        let active = true
        const handle = setTimeout(() => {
            setLoading(true)
            setError(null)
            api.listAdminReviews({
                q: query || undefined,
                rating: rating === "all" ? undefined : Number(rating),
                courseId: courseId ? Number(courseId) : undefined,
                from: fromValue || undefined,
                to: toValue || undefined,
                page,
                limit: 20
            }).then((res) => {
                if (!active) return
                setRows(res.items)
                setTotal(res.pagination.total)
            }).catch((err) => {
                if (!active) return
                setError(err instanceof Error ? err.message : t("common.loadingError"))
            }).finally(() => {
                if (active) setLoading(false)
            })
        }, 300)
        return () => {
            active = false
            clearTimeout(handle)
        }
    }, [query, rating, courseId, fromValue, toValue, page, t])

    const totalPages = Math.max(1, Math.ceil(total / 20))

    const handleReply = async (reviewId: number) => {
        if (!replyText.trim() || sending) return
        setSending(true)
        try {
            const reply = await api.replyToReview(reviewId, replyText.trim())
            const normalized = reply
                ? {
                    text: reply.text,
                    author: reply.author,
                    isEdited: reply.isEdited ?? false,
                    createdAt: reply.createdAt ?? null,
                    updatedAt: reply.updatedAt ?? null
                }
                : null
            setRows((prev) => prev.map(row => row.id === reviewId ? { ...row, reply: normalized } : row))
            setReplyingId(null)
            setReplyText("")
        } finally {
            setSending(false)
        }
    }

    const handleDelete = async (reviewId: number) => {
        if (!confirm(t("review.confirmDelete"))) return
        await api.deleteReview(reviewId)
        setRows((prev) => prev.filter(row => row.id !== reviewId))
    }

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                    <input
                        value={query}
                        onChange={(e) => {
                            setPage(1)
                            setQuery(e.target.value)
                        }}
                        placeholder={t("dash.reviews.search")}
                        className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-accentpurple/60"
                    />
                    <Select
                        value={rating}
                        onValueChange={(value) => {
                            setPage(1)
                            setRating(value)
                        }}
                    >
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder={t("dash.reviews.ratingAll")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t("dash.reviews.ratingAll")}</SelectItem>
                            {[5, 4, 3, 2, 1].map(value => (
                                <SelectItem key={value} value={`${value}`}>
                                    {t("dash.reviews.ratingValue", { value })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <input
                        value={courseId}
                        onChange={(e) => {
                            setPage(1)
                            setCourseId(e.target.value)
                        }}
                        placeholder={t("dash.reviews.courseId")}
                        className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-accentpurple/60"
                    />
                    <RangeField
                        value={range}
                        onChange={(nextRange) => {
                            setPage(1)
                            setRange(nextRange)
                        }}
                        placeholder={t("dash.filters.range")}
                    />
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-accentpurple" />
                    </div>
                ) : error ? (
                    <div className="text-sm text-accentpink">{error}</div>
                ) : rows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t("dash.reviews.empty")}</div>
                ) : (
                    <div className="space-y-4">
                        {rows.map(row => (
                            <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="text-white">{row.courseTitle}</span>
                                    <span>•</span>
                                    <span>{row.firstName} {row.lastName || ""}</span>
                                    <span>•</span>
                                    <span>{t("dash.reviews.ratingValue", { value: row.rating })}</span>
                                    <span>•</span>
                                    <span>{new Date(row.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="mt-2 text-sm text-white">{row.comment || t("dash.reviews.noComment")}</p>

                                {row.reply ? (
                                    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                                        <p className="text-[11px] uppercase tracking-wider">{t("dash.reviews.reply")}</p>
                                        <p className="mt-1 text-sm text-white">{row.reply.text}</p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                            {row.reply.author}
                                        </p>
                                    </div>
                                ) : null}

                                <div className="mt-3 flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setReplyingId(row.id)
                                            setReplyText(row.reply?.text || "")
                                        }}
                                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                                    >
                                        {t("review.reply")}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(row.id)}
                                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-accentpink hover:bg-white/10"
                                    >
                                        {t("review.delete")}
                                    </button>
                                </div>

                                {replyingId === row.id && (
                                    <div className="mt-3 space-y-2">
                                        <textarea
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-accentpurple/60"
                                            rows={3}
                                        />
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleReply(row.id)}
                                                disabled={!replyText.trim() || sending}
                                                className="rounded-full bg-accentpurple px-4 py-1.5 text-xs text-white disabled:opacity-50"
                                            >
                                                {sending ? t("common.loading") : t("review.replySend")}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setReplyingId(null)
                                                    setReplyText("")
                                                }}
                                                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                                            >
                                                {t("common.cancel")}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            className="rounded-lg border border-white/10 px-3 py-1 text-white/80 disabled:opacity-40"
                        >
                            {t("dash.reviews.prev")}
                        </button>
                        <span>{t("dash.reviews.page", { page, total: totalPages })}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            className="rounded-lg border border-white/10 px-3 py-1 text-white/80 disabled:opacity-40"
                        >
                            {t("dash.reviews.next")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function RangeField({
    value,
    onChange,
    placeholder
}: {
    value?: DateRange
    onChange: (_value?: DateRange) => void
    placeholder: string
}) {
    const [open, setOpen] = useState(false)
    const label = value?.from
        ? value.to
            ? `${format(value.from, "dd.MM.yyyy")} – ${format(value.to, "dd.MM.yyyy")}`
            : format(value.from, "dd.MM.yyyy")
        : placeholder

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex h-10 w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accentpurple/60",
                        !value && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{label}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    selected={value}
                    onSelect={(nextRange) => {
                        onChange(nextRange)
                        if (nextRange?.from && nextRange?.to) {
                            setOpen(false)
                        }
                    }}
                    numberOfMonths={2}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
