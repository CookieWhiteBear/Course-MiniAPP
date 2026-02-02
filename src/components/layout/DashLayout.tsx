import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react"
import { useBootstrap } from "@/hooks/useApi"
import * as api from "@/lib/api"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

function AccessCard({ title, description }: { title: string; description: string }) {
    const navigate = useNavigate()
    const { t } = useI18n()
    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-white px-4">
            <div className="glass-card w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="flex items-center justify-center mb-4 text-accentpink">
                    <ShieldAlert className="h-7 w-7" />
                </div>
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                <button
                    onClick={() => navigate("/")}
                    className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                >
                    {t("dash.access.backToApp")}
                </button>
            </div>
        </div>
    )
}

function DashTopNav() {
    const { t } = useI18n()
    const location = useLocation()
    const navItems = [
        { label: t("common.back"), to: "/profile", icon: ArrowLeft },
        { label: t("dash.nav.dashboard"), to: "/dash" },
        { label: t("dash.nav.support"), to: "/dash/support" },
        { label: t("dash.nav.users"), to: "/dash/users" },
        { label: t("dash.nav.transactions"), to: "/dash/transactions" },
        { label: t("dash.nav.reviews"), to: "/dash/reviews" },
        { label: t("dash.nav.courses"), to: "/dash/courses" }
    ]
    const { title, subtitle } = (() => {
        const path = location.pathname
        if (path.startsWith("/dash/support")) {
            return { title: t("dash.header.support.title"), subtitle: t("dash.header.support.subtitle") }
        }
        if (path.startsWith("/dash/users")) {
            return { title: t("dash.header.users.title"), subtitle: t("dash.header.users.subtitle") }
        }
        if (path.startsWith("/dash/transactions")) {
            return { title: t("dash.header.transactions.title"), subtitle: t("dash.header.transactions.subtitle") }
        }
        if (path.startsWith("/dash/reviews")) {
            return { title: t("dash.header.reviews.title"), subtitle: t("dash.header.reviews.subtitle") }
        }
        if (path.startsWith("/dash/courses")) {
            return { title: t("dash.header.courses.title"), subtitle: t("dash.header.courses.subtitle") }
        }
        return { title: t("dash.header.dashboard.title"), subtitle: t("dash.header.dashboard.subtitle") }
    })()

    return (
        <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0b0b0f]/70 backdrop-blur-2xl">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
                        <h1 className="text-lg font-semibold text-white">{subtitle}</h1>
                    </div>
                </div>
                <nav className="hidden gap-2 md:flex">
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/dash"}
                            className={({ isActive }) => cn(
                                "rounded-full border border-transparent px-3 py-1.5 text-xs text-muted-foreground transition-colors flex items-center gap-2",
                                isActive
                                    ? "border-white/10 bg-white/10 text-white"
                                    : "hover:border-white/10 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            {item.icon && <item.icon className="h-3.5 w-3.5" />}
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </div>
            <div className="md:hidden px-4 pb-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/dash"}
                            className={({ isActive }) => cn(
                                "whitespace-nowrap rounded-full border border-transparent px-3 py-1.5 text-xs text-muted-foreground transition-colors flex items-center gap-2",
                                isActive
                                    ? "border-white/10 bg-white/10 text-white"
                                    : "hover:border-white/10 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            {item.icon && <item.icon className="h-3.5 w-3.5" />}
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            </div>
        </header>
    )
}

export function DashLayout() {
    const { data, loading } = useBootstrap()
    const { t } = useI18n()

    if (api.isDemoMode()) {
        return (
            <AccessCard
                title={t("dash.access.disabledTitle")}
                description={t("dash.access.disabledDescription")}
            />
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-white">
                <Loader2 className="h-7 w-7 animate-spin text-accentpurple" />
            </div>
        )
    }

    if (!data?.isAdmin) {
        return (
            <AccessCard
                title={t("dash.access.deniedTitle")}
                description={t("dash.access.deniedDescription")}
            />
        )
    }

    return (
        <div className="min-h-screen bg-background text-white">
            <DashTopNav />
            <main className="mx-auto w-full max-w-6xl px-4 py-6">
                <Outlet />
            </main>
        </div>
    )
}
