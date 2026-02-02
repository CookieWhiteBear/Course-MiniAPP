import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import * as api from "@/lib/api"

type MetricsState = api.AdminMetricsResponse["ranges"]

export function DashHomePage() {
    const { t } = useI18n()
    const [metrics, setMetrics] = useState<MetricsState | null>(null)
    const [transactions, setTransactions] = useState<api.AdminTransactionItem[]>([])
    const [supportUsers, setSupportUsers] = useState<api.SupportUser[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const [metricsRes, txRes, usersRes] = await Promise.all([
                    api.getAdminMetrics(),
                    api.listAdminTransactions({ limit: 5 }),
                    api.getSupportUsers()
                ])
                if (!active) return
                setMetrics(metricsRes.ranges)
                setTransactions(txRes.items)
                setSupportUsers(usersRes.slice(0, 5))
            } catch (err) {
                if (!active) return
                setError(err instanceof Error ? err.message : t("common.loadingError"))
            } finally {
                if (active) setLoading(false)
            }
        }
        load()
        return () => {
            active = false
        }
    }, [t])

    const currencyFormatter = useMemo(() => new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }), [])

    const cardRows = metrics ? [
        {
            label: t("dash.metrics.newUsers24h"),
            value: metrics["24h"].users,
            week: metrics["7d"].users,
            total: metrics["all"].users
        },
        {
            label: t("dash.metrics.orders24h"),
            value: metrics["24h"].orders,
            week: metrics["7d"].orders,
            total: metrics["all"].orders
        },
        {
            label: t("dash.metrics.revenue24h"),
            value: currencyFormatter.format(metrics["24h"].revenue),
            week: currencyFormatter.format(metrics["7d"].revenue),
            total: currencyFormatter.format(metrics["all"].revenue)
        },
        {
            label: t("dash.metrics.activeUsers24h"),
            value: metrics["24h"].activeUsers,
            week: metrics["7d"].activeUsers,
            total: metrics["all"].activeUsers
        }
    ] : []

    return (
        <div className="space-y-6">
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-accentpurple" />
                </div>
            ) : error ? (
                <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-accentpink">
                    {error}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {cardRows.map(card => (
                        <div
                            key={card.label}
                            className="glass-card rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                            <p className="text-xs text-muted-foreground">{card.label}</p>
                            <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                            <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                                <div>{t("dash.metrics.range7d", { value: card.week })}</div>
                                <div>{t("dash.metrics.rangeAll", { value: card.total })}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-sm font-semibold text-white">{t("dash.sections.latestTransactions")}</h3>
                    {loading ? (
                        <div className="mt-4 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-accentpurple" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">{t("dash.sections.empty")}</p>
                    ) : (
                        <div className="mt-3 space-y-3">
                            {transactions.map(item => (
                                <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="min-w-0">
                                        <p className="text-sm text-white truncate">
                                            {item.courseTitle || t("dash.sections.generalPurchase")}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {item.firstName} {item.lastName || ""} • {item.status}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-white">{currencyFormatter.format(item.amount)}</p>
                                        <p className="text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-sm font-semibold text-white">{t("dash.sections.recentSupport")}</h3>
                    {loading ? (
                        <div className="mt-4 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-accentpurple" />
                        </div>
                    ) : supportUsers.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">{t("dash.sections.empty")}</p>
                    ) : (
                        <div className="mt-3 space-y-3">
                            {supportUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="min-w-0">
                                        <p className="text-sm text-white truncate">
                                            {user.firstName} {user.lastName || ""}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground truncate">@{user.username || t("dash.sections.userFallback")}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] text-muted-foreground">{new Date(user.lastMessageAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
