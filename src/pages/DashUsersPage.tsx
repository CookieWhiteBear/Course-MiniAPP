import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import * as api from "@/lib/api"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"

export function DashUsersPage() {
    const { t } = useI18n()
    const [query, setQuery] = useState("")
    const [page, setPage] = useState(1)
    const [rows, setRows] = useState<api.AdminUserListItem[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selected, setSelected] = useState<api.AdminUserListItem | null>(null)
    const [overview, setOverview] = useState<api.AdminUserOverview | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [username, setUsername] = useState("")
    const [blockReviews, setBlockReviews] = useState(false)
    const [grantCourseId, setGrantCourseId] = useState<number | null>(null)

    const totalPages = Math.max(1, Math.ceil(total / 20))

    useEffect(() => {
        let active = true
        const handle = setTimeout(() => {
            setLoading(true)
            setError(null)
            api.listAdminUsers({ q: query || undefined, page, limit: 20 })
                .then((res) => {
                    if (!active) return
                    setRows(res.items)
                    setTotal(res.pagination.total)
                })
                .catch((err) => {
                    if (!active) return
                    setError(err instanceof Error ? err.message : t("common.loadingError"))
                })
                .finally(() => {
                    if (active) setLoading(false)
                })
        }, 300)

        return () => {
            active = false
            clearTimeout(handle)
        }
    }, [query, page, t])

    useEffect(() => {
        if (!selected) {
            setOverview(null)
            return
        }
        let active = true
        const load = async () => {
            setDetailLoading(true)
            try {
                const data = await api.getAdminUserOverview(selected.id)
                if (!active) return
                setOverview(data)
                setFirstName(data.user.firstName || "")
                setLastName(data.user.lastName || "")
                setUsername(data.user.username || "")
                setBlockReviews(selected.isBlockedForReviews)
                const available = data.availableCourses.filter(course => !data.courses.some(c => c.id === course.id))
                setGrantCourseId(available[0]?.id ?? null)
            } finally {
                if (active) setDetailLoading(false)
            }
        }
        load()
        return () => {
            active = false
        }
    }, [selected])

    const handleSave = async () => {
        if (!selected) return
        setSaving(true)
        try {
            await api.updateAdminUser(selected.id, {
                firstName,
                lastName: lastName.trim() ? lastName : null,
                username: username.trim() ? username : null,
                blockReviews
            })
            setRows((prev) => prev.map(row => row.id === selected.id
                ? { ...row, firstName, lastName, username, isBlockedForReviews: blockReviews }
                : row
            ))
        } finally {
            setSaving(false)
        }
    }

    const handleGrantCourse = async () => {
        if (!selected || !grantCourseId) return
        await api.grantCourseToUser(selected.id, grantCourseId)
        const updated = await api.getAdminUserOverview(selected.id)
        setOverview(updated)
        const available = updated.availableCourses.filter(course => !updated.courses.some(c => c.id === course.id))
        setGrantCourseId(available[0]?.id ?? null)
    }

    const handleRevokeCourse = async (courseId: number) => {
        if (!selected) return
        if (!confirm(t("support.confirmRemoveCourse"))) return
        await api.revokeCourseFromUser(selected.id, courseId)
        const updated = await api.getAdminUserOverview(selected.id)
        setOverview(updated)
        const available = updated.availableCourses.filter(course => !updated.courses.some(c => c.id === course.id))
        setGrantCourseId(available[0]?.id ?? null)
    }

    const detailReady = selected && overview && !detailLoading
    const availableCourses = overview
        ? overview.availableCourses.filter(course => !overview.courses.some(c => c.id === course.id))
        : []
    const grantCourseValue = grantCourseId ? String(grantCourseId) : undefined

    return (
        <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                    <input
                        value={query}
                        onChange={(e) => {
                            setPage(1)
                            setQuery(e.target.value)
                        }}
                        placeholder={t("dash.users.search")}
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-accentpurple/60"
                    />

                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-accentpurple" />
                        </div>
                    ) : error ? (
                        <div className="text-sm text-accentpink">{error}</div>
                    ) : rows.length === 0 ? (
                        <div className="text-sm text-muted-foreground">{t("dash.users.empty")}</div>
                    ) : (
                        <div className="space-y-3">
                            {rows.map(row => (
                                <button
                                    key={row.id}
                                    onClick={() => setSelected(row)}
                                    className={`w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-colors ${
                                        selected?.id === row.id ? "bg-white/10" : "hover:bg-white/10"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={row.photoUrl || "https://i.imgur.com/zOlPMhT.png"}
                                            alt=""
                                            className="h-10 w-10 rounded-full border border-white/10 object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-white truncate">
                                                {row.firstName} {row.lastName || ""}
                                            </p>
                                            <p className="text-xs text-muted-foreground">@{row.username || t("dash.sections.userFallback")}</p>
                                        </div>
                                        <div className="text-right text-[11px] text-muted-foreground">
                                            <div>{t("dash.users.courses", { count: row.coursesCount })}</div>
                                            <div>{t("dash.users.orders", { count: row.ordersCount })}</div>
                                        </div>
                                    </div>
                                </button>
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
                                {t("dash.users.prev")}
                            </button>
                            <span>{t("dash.users.page", { page, total: totalPages })}</span>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                className="rounded-lg border border-white/10 px-3 py-1 text-white/80 disabled:opacity-40"
                            >
                                {t("dash.users.next")}
                            </button>
                        </div>
                    )}
                </div>

                <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                    {!selected ? (
                        <p className="text-sm text-muted-foreground">{t("dash.users.selectUser")}</p>
                    ) : detailLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-accentpurple" />
                        </div>
                    ) : detailReady ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-muted-foreground">{t("dash.users.details")}</p>
                                <p className="text-sm text-white">{overview.user.firstName} {overview.user.lastName || ""}</p>
                                <p className="text-[11px] text-muted-foreground">ID: {overview.user.telegramId}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">{t("dash.users.firstName")}</label>
                                <input
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:border-accentpurple/60"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">{t("dash.users.lastName")}</label>
                                <input
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:border-accentpurple/60"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">{t("dash.users.username")}</label>
                                <input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:border-accentpurple/60"
                                />
                            </div>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={blockReviews}
                                    onChange={(e) => setBlockReviews(e.target.checked)}
                                    className="h-4 w-4"
                                />
                                {t("dash.users.blockReviews")}
                            </label>
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full rounded-xl bg-accentpurple text-white hover:bg-accentpurple/90"
                            >
                                {saving ? t("common.loading") : t("common.save")}
                            </Button>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs uppercase text-muted-foreground tracking-wider">{t("support.coursesTitle")}</h3>
                                    <span className="text-xs text-muted-foreground">{overview.courses.length}</span>
                                </div>
                                {overview.courses.length === 0 ? (
                                    <div className="text-xs text-muted-foreground">{t("support.noCourses")}</div>
                                ) : (
                                    <div className="space-y-2">
                                        {overview.courses.map(course => (
                                            <div
                                                key={course.id}
                                                className="rounded-xl border border-white/10 px-3 py-2 flex items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm text-white truncate">{course.title}</p>
                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                        <span>{course.progress}%</span>
                                                        <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
                                                            <div
                                                                className="h-full bg-accentpurple"
                                                                style={{ width: `${course.progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRevokeCourse(course.id)}
                                                    className="text-xs text-accentpink hover:text-accentpink/80"
                                                >
                                                    {t("support.remove")}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xs uppercase text-muted-foreground tracking-wider">{t("support.grantCourse")}</h3>
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={grantCourseValue}
                                        onValueChange={(value) => setGrantCourseId(Number(value))}
                                        disabled={availableCourses.length === 0}
                                    >
                                        <SelectTrigger className="h-9 flex-1">
                                            <SelectValue placeholder={t("support.selectCourse")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableCourses.map(course => (
                                                <SelectItem key={course.id} value={`${course.id}`}>
                                                    {course.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={handleGrantCourse}
                                        disabled={!grantCourseId}
                                        className="h-9 px-4 rounded-xl bg-accentpurple text-white hover:bg-accentpurple/90"
                                    >
                                        {t("support.grant")}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs uppercase text-muted-foreground tracking-wider">{t("support.transactionsTitle")}</h3>
                                    <span className="text-xs text-muted-foreground">{overview.transactions.length}</span>
                                </div>
                                {overview.transactions.length === 0 ? (
                                    <div className="text-xs text-muted-foreground">{t("support.noTransactions")}</div>
                                ) : (
                                    <div className="space-y-2">
                                        {overview.transactions.slice(0, 5).map(tx => (
                                            <div key={tx.id} className="rounded-xl border border-white/10 px-3 py-2">
                                                <p className="text-sm text-white">{tx.title}</p>
                                                <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t("dash.users.selectUser")}</p>
                    )}
                </div>
            </div>
        </div>
    )
}
