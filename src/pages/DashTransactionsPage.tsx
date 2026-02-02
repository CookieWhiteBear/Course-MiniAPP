import { useEffect, useMemo, useState } from "react"
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

export function DashTransactionsPage() {
    const { t } = useI18n()
    const [query, setQuery] = useState("")
    const [status, setStatus] = useState("all")
    const [range, setRange] = useState<DateRange | undefined>(undefined)
    const [page, setPage] = useState(1)
    const [rows, setRows] = useState<api.AdminTransactionItem[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const currencyFormatter = useMemo(() => new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }), [])
    const fromValue = range?.from ? format(range.from, "yyyy-MM-dd") : ""
    const toValue = range?.to ? format(range.to, "yyyy-MM-dd") : ""

    useEffect(() => {
        let active = true
        const handle = setTimeout(() => {
            setLoading(true)
            setError(null)
            api.listAdminTransactions({
                q: query || undefined,
                status: status === "all" ? undefined : status,
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
    }, [query, status, fromValue, toValue, page, t])

    const totalPages = Math.max(1, Math.ceil(total / 20))
    return (
        <div className="space-y-6">
            <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                    <input
                        value={query}
                        onChange={(e) => {
                            setPage(1)
                            setQuery(e.target.value)
                        }}
                        placeholder={t("dash.transactions.search")}
                        className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-accentpurple/60"
                    />
                    <Select
                        value={status}
                        onValueChange={(value) => {
                            setPage(1)
                            setStatus(value)
                        }}
                    >
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder={t("dash.transactions.statusAll")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t("dash.transactions.statusAll")}</SelectItem>
                            <SelectItem value="pending">{t("dash.transactions.statusPending")}</SelectItem>
                            <SelectItem value="success">{t("dash.transactions.statusSuccess")}</SelectItem>
                            <SelectItem value="failed">{t("dash.transactions.statusFailed")}</SelectItem>
                            <SelectItem value="refunded">{t("dash.transactions.statusRefunded")}</SelectItem>
                        </SelectContent>
                    </Select>
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
                    <div className="text-sm text-muted-foreground">{t("dash.transactions.empty")}</div>
                ) : (
                    <div className="space-y-3">
                        <div className="hidden md:grid grid-cols-6 gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                            <span>{t("dash.transactions.colDate")}</span>
                            <span>{t("dash.transactions.colUser")}</span>
                            <span>{t("dash.transactions.colCourse")}</span>
                            <span>{t("dash.transactions.colAmount")}</span>
                            <span>{t("dash.transactions.colStatus")}</span>
                            <span>{t("dash.transactions.colId")}</span>
                        </div>
                        {rows.map(tx => (
                            <div key={tx.id} className="grid gap-2 md:grid-cols-6 md:gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white">
                                <div className="text-xs text-muted-foreground md:text-sm">
                                    {new Date(tx.createdAt).toLocaleDateString()}
                                </div>
                                <div className="text-sm">
                                    {tx.firstName} {tx.lastName || ""}
                                    <div className="text-[11px] text-muted-foreground">@{tx.username || t("dash.sections.userFallback")}</div>
                                </div>
                                <div className="text-xs text-muted-foreground md:text-sm">
                                    {tx.courseTitle || t("dash.sections.generalPurchase")}
                                </div>
                                <div className="text-sm">{currencyFormatter.format(tx.amount)}</div>
                                <div className="text-xs text-muted-foreground md:text-sm">{tx.status}</div>
                                <div className="text-xs text-muted-foreground md:text-sm">#{tx.id}</div>
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
                            {t("dash.transactions.prev")}
                        </button>
                        <span>{t("dash.transactions.page", { page, total: totalPages })}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            className="rounded-lg border border-white/10 px-3 py-1 text-white/80 disabled:opacity-40"
                        >
                            {t("dash.transactions.next")}
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
