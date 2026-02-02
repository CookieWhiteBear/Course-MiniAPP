import { motion } from "framer-motion"
import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { CustomTabs } from "@/components/ui/custom-tabs"
import {
    CheckCircle2,
    XCircle,
    ChevronRight,
    Loader2,
    MessageCircle,
    LayoutDashboard,
    ChevronDown,
    Check,
    Paintbrush
} from "lucide-react"
import { useBootstrap, useUser, useUserTransactions } from "@/hooks/useApi"
import { useSupport } from "@/hooks/useSupport"
import * as api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Emoji } from "@/components/ui/emoji"
import { WaveGradient } from "wave-gradient"

const DEFAULT_PROFILE_GRADIENT = ["#e8320e", "#e88d0e", "#e8320e", "#120012", "#07004f", "#1200d9", "#120012", "#120012"]

export function ProfilePage() {
    const [activeTab, setActiveTab] = useState("general")
    const { user, loading: userLoading } = useUser()
    const { data: bootstrap } = useBootstrap()
    const { data: transactions, loading: transLoading } = useUserTransactions()
    const { unreadCount } = useSupport()
    const navigate = useNavigate()
    const demoMode = api.isDemoMode()
    const [demoRole, setDemoRoleState] = useState(() => api.getDemoRole())
    const { t } = useI18n()
    const isAdmin = bootstrap?.isAdmin ?? api.isAdmin(user?.telegramId)

    useEffect(() => {
        if (!demoMode || typeof window === 'undefined') return
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<string>).detail
            setDemoRoleState(detail === 'admin' ? 'admin' : 'user')
        }
        window.addEventListener('demo-role-change', handler as EventListener)
        return () => window.removeEventListener('demo-role-change', handler as EventListener)
    }, [demoMode])

    const toggleDemoRole = () => {
        const nextRole = demoRole === 'admin' ? 'user' : 'admin'
        api.setDemoRole(nextRole)
        setDemoRoleState(nextRole)
    }

    if (userLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-24 pt-6 px-4 space-y-8 text-white">
            <ProfileHero
                avatarUrl={user?.photoUrl || "https://i.imgur.com/zOlPMhT.png"}
                name={`${user?.firstName || t("common.guest")} ${user?.lastName || ''}`.trim()}
                avatarAlt={t("profile.avatarAlt")}
            />

            <div className="text-center text-xs text-muted-foreground">
                {user?.username ? (
                    <p className="font-medium text-white/70">
                        @{user.username}{"  |  "}{t("profile.telegramIdLabel")}: {user?.telegramId ?? t("common.na")}
                    </p>
                ) : (
                    <p className="font-medium text-white/70">
                        {t("profile.telegramIdLabel")}: {user?.telegramId ?? t("common.na")}
                    </p>
                )}
            </div>

            {/* Support Button */}
            <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/support")}
                className="w-full glass-card rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex items-center justify-between hover:bg-white/10 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-accentpurple/15 text-accentpurple flex items-center justify-center">
                        <MessageCircle className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <p className="font-semibold text-white">{t("profile.supportTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("profile.supportSubtitle")}</p>
                    </div>
                </div>
                {unreadCount > 0 ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-accentpink">{unreadCount > 9 ? "9+" : unreadCount}</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-accentpink" />
                    </div>
                ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
            </motion.button>

            {isAdmin && (
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate("/dash")}
                    className="w-full glass-card rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-accentpurple/15 text-accentpurple flex items-center justify-center">
                            <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="font-semibold text-white">{t("profile.dashboardTitle")}</p>
                            <p className="text-xs text-muted-foreground">{t("profile.dashboardSubtitle")}</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </motion.button>
            )}

            {demoMode && (
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={toggleDemoRole}
                    className="w-full glass-card rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-xs uppercase tracking-wider">
                            {demoRole === 'admin' ? t("profile.demoRoleAdminShort") : t("profile.demoRoleUserShort")}
                        </div>
                        <div>
                            <p className="font-semibold text-white">{t("profile.demoRoleTitle")}</p>
                            <p className="text-xs text-muted-foreground">{t("profile.demoRoleSubtitle")}</p>
                        </div>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase">
                        {demoRole === 'admin' ? t("profile.demoRoleAdmin") : t("profile.demoRoleUser")}
                    </span>
                </motion.button>
            )}

            {/* Tabs */}
            <CustomTabs
                tabs={[
                    { id: "general", label: t("profile.tabGeneral") },
                    { id: "billing", label: t("profile.tabBilling") },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            {/* Content Area */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
            >
                {activeTab === "general" ? (
                    <GeneralSettings />
                ) : (
                    <BillingHistory transactions={transactions || []} loading={transLoading} />
                )}
            </motion.div>
        </div>
    )
}

type GradientOptions = {
    amplitude?: number
    colors?: string[]
    density?: [number, number]
    fps?: number
    seed?: number
    speed?: number
    time?: number
    wireframe?: boolean
}

function randomBetween(min: number, max: number) {
    return Math.round(min + Math.random() * (max - min))
}

function randomFloat(min: number, max: number, precision = 2) {
    const factor = Math.pow(10, precision)
    return Math.round((min + Math.random() * (max - min)) * factor) / factor
}

function hslToHex(h: number, s: number, l: number) {
    const sat = s / 100
    const light = l / 100
    const k = (n: number) => (n + h / 30) % 12
    const a = sat * Math.min(light, 1 - light)
    const f = (n: number) =>
        light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    const toHex = (value: number) =>
        Math.round(255 * value).toString(16).padStart(2, "0")
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

function randomColors(count: number) {
    return Array.from({ length: count }, () => {
        const hue = Math.floor(Math.random() * 360)
        const saturation = randomBetween(60, 85)
        const lightness = randomBetween(45, 65)
        return hslToHex(hue, saturation, lightness)
    })
}

function createRandomGradientOptions(): GradientOptions {
    const colorCount = randomBetween(4, 8)
    return {
        amplitude: randomBetween(200, 420),
        colors: randomColors(colorCount),
        density: [randomFloat(0.04, 0.09), randomFloat(0.12, 0.2)],
        fps: randomBetween(24, 36),
        seed: randomBetween(0, 999),
        speed: randomFloat(0.8, 1.5),
        time: 0,
        wireframe: false
    }
}

function ProfileHero({
    avatarUrl,
    name,
    avatarAlt
}: {
    avatarUrl: string
    name: string
    avatarAlt: string
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const gradientRef = useRef<InstanceType<typeof WaveGradient> | null>(null)
    const [rotation, setRotation] = useState(0)
    const [brushRotation, setBrushRotation] = useState(0)
    const [gradientOptions, setGradientOptions] = useState<GradientOptions>(() => ({
        colors: DEFAULT_PROFILE_GRADIENT,
        fps: 30,
        seed: 0,
        speed: 1.1
    }))

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        gradientRef.current?.destroy()
        gradientRef.current = null

        try {
            gradientRef.current = new WaveGradient(canvas, gradientOptions)
        } catch (e) {
            console.error(e)
            return
        }

        const handleResize = () => {
            gradientRef.current?.resize()
        }

        window.addEventListener("resize", handleResize)

        return () => {
            window.removeEventListener("resize", handleResize)
            gradientRef.current?.destroy()
            gradientRef.current = null
        }
    }, [gradientOptions])

    const handleRotate = () => {
        setRotation(prev => prev + 360 + Math.random() * 180)
    }

    const handleRandomize = () => {
        setGradientOptions(createRandomGradientOptions())
        setBrushRotation(prev => prev + 360)
        handleRotate()
    }

    return (
        <div className="relative h-[48vh] w-full overflow-hidden rounded-[40px] bg-[#0c0c0e] mt-2 mx-auto max-w-[98%]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f0a1f] via-[#0a0f1a] to-[#0a1c1c]" />
            <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full pointer-events-none"
                aria-hidden="true"
            />

            <div className="relative z-10 h-full flex flex-col items-center justify-center pointer-events-none">
                <div
                    className="relative flex items-center justify-center pointer-events-auto cursor-pointer"
                    onClick={handleRotate}
                >
                    <motion.div
                        animate={{ rotate: rotation }}
                        transition={{ type: "spring", stiffness: 50, damping: 15 }}
                        className="w-28 h-28 rounded-full border-4 border-white/20 shadow-2xl overflow-hidden relative z-20"
                    >
                        <img src={avatarUrl} alt={avatarAlt} className="w-full h-full object-cover" />
                    </motion.div>
                </div>

                <h1 className="mt-6 text-2xl font-bold tracking-tight text-white/90">{name}</h1>
            </div>

            <motion.button
                type="button"
                onClick={handleRandomize}
                className="absolute bottom-4 right-4 h-11 w-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors flex items-center justify-center"
                aria-label="Randomize gradient"
                animate={{ rotate: brushRotation }}
                transition={{ type: "spring", stiffness: 120, damping: 15 }}
            >
                <Paintbrush className="w-5 h-5" />
            </motion.button>

            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none mix-blend-overlay" />
        </div>
    )
}

function GeneralSettings() {
    return (
        <div className="space-y-6">
            <LanguageSelect />
        </div>
    )
}

function LanguageSelect() {
    const { language, languages, setLanguage, t } = useI18n()
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)

    const options = useMemo(() => {
        if (languages.length > 0) return languages
        return [{ code: language, name: language.toUpperCase(), flag: "???" }]
    }, [languages, language])

    const activeOption = options.find((option) => option.code === language) || options[0]

    useEffect(() => {
        const handlePointer = (event: MouseEvent | TouchEvent) => {
            if (!containerRef.current || !event.target) return
            if (!containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false)
            }
        }

        document.addEventListener("mousedown", handlePointer)
        document.addEventListener("touchstart", handlePointer)
        document.addEventListener("keydown", handleKey)

        return () => {
            document.removeEventListener("mousedown", handlePointer)
            document.removeEventListener("touchstart", handlePointer)
            document.removeEventListener("keydown", handleKey)
        }
    }, [])

    return (
        <div ref={containerRef} className="space-y-3">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                    "w-full glass-card rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex items-center justify-between transition-colors",
                    open ? "bg-white/10" : "hover:bg-white/10"
                )}
                aria-expanded={open}
            >
                <div className="text-left">
                    <p className="font-semibold text-white">{t("profile.languageTitle")}</p>
                    <p className="text-xs text-muted-foreground">{t("profile.languageSubtitle")}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                    <Emoji emoji={activeOption.flag} label={activeOption.name} size={16} className="h-4 w-4" />
                    <span className="font-medium text-white">{activeOption.name}</span>
                    <ChevronDown className={cn("w-4 h-4 text-white/60 transition-transform", open && "rotate-180")} />
                </div>
            </button>

            <AnimatePresenceWrapper show={open}>
                <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-2 space-y-1">
                    {options.map((option) => (
                        <button
                            key={option.code}
                            type="button"
                            onClick={() => {
                                setLanguage(option.code)
                                setOpen(false)
                            }}
                            className={cn(
                                "w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-colors",
                                option.code === language ? "bg-white/10" : "hover:bg-white/5"
                            )}
                        >
                            <div className="flex items-center gap-3 text-left">
                                <Emoji emoji={option.flag} label={option.name} size={20} className="h-5 w-5" />
                                <div>
                                    <p className="text-sm font-medium text-white">{option.name}</p>
                                    <p className="text-xs text-muted-foreground">{option.code.toUpperCase()}</p>
                                </div>
                            </div>
                            {option.code === language && (
                                <Check className="w-4 h-4 text-accentpink" />
                            )}
                        </button>
                    ))}
                </div>
            </AnimatePresenceWrapper>
        </div>
    )
}

function AnimatePresenceWrapper({ show, children }: { show: boolean; children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: show ? 1 : 0, y: show ? 0 : -6 }}
            transition={{ duration: 0.2 }}
            style={{ display: show ? "block" : "none" }}
        >
            {children}
        </motion.div>
    )
}

function BillingHistory({ transactions, loading }: { transactions: api.Transaction[], loading: boolean }) {
    const { t } = useI18n()

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        )
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                {t("profile.billingEmpty")}
            </div>
        )
    }

    return (
        <section className="space-y-4">
            <div className="glass-card rounded-2xl divide-y divide-white/5">
                {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between px-4 py-4">
                        <div className="flex items-center space-x-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${tx.status === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                {tx.status === 'success' ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                )}
                            </div>
                            <div>
                                <p className="font-medium text-sm">{tx.title}</p>
                                <p className="text-xs text-muted-foreground">{tx.date}</p>
                            </div>
                        </div>
                        <span className={`font-semibold ${tx.status === 'success' ? 'text-white' : 'text-red-500/70'}`}>
                            {tx.amount}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    )
}
