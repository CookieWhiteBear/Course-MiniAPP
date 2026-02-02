import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowLeft,
    Search,
    Loader2,
    Send,
    MoreVertical,
    Edit2,
    Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useSupport } from "@/hooks/useSupport"
import * as api from "@/lib/api"
import type { SupportMessage, SupportUser } from "@/lib/api"
import { useI18n } from "@/lib/i18n"

export function SupportPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { t } = useI18n()
    const {
        isAdmin,
        users,
        usersLoading,
        messages,
        loading,
        loadMessages,
        loadUsers,
        sendMessage,
        editMessage,
        deleteMessage,
        markAsRead
    } = useSupport()

    const [selectedUser, setSelectedUser] = useState<SupportUser | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [adminReady, setAdminReady] = useState(false)
    const [searchResults, setSearchResults] = useState<SupportUser[] | null>(null)
    const [searching, setSearching] = useState(false)
    const backTarget = location.pathname.startsWith("/dash") ? "/dash" : "/profile"
    const isDash = location.pathname.startsWith("/dash")

    useEffect(() => {
        let isActive = true
        const init = async () => {
            const ok = await loadUsers()
            if (!ok) {
                await loadMessages()
            }
            if (isActive) {
                setAdminReady(true)
            }
        }
        init()
        return () => {
            isActive = false
        }
    }, [loadMessages, loadUsers])

    useEffect(() => {
        if (isAdmin && selectedUser) {
            loadMessages(selectedUser.id)
        }
    }, [isAdmin, selectedUser, loadMessages])

    useEffect(() => {
        if (!adminReady) return
        if (!isAdmin) {
            const interval = setInterval(() => {
                loadMessages(undefined, { silent: true })
            }, 6000)
            return () => clearInterval(interval)
        }

        if (!selectedUser) {
            const interval = setInterval(() => {
                loadUsers({ silent: true })
            }, 6000)
            return () => clearInterval(interval)
        }

        const interval = setInterval(() => {
            loadMessages(selectedUser.id, { silent: true })
        }, 5000)
        return () => clearInterval(interval)
    }, [adminReady, isAdmin, loadMessages, loadUsers, selectedUser])

    useEffect(() => {
        const unreadIds = messages
            .filter(msg => !msg.isRead && msg.senderType === (isAdmin ? "user" : "admin"))
            .map(msg => msg.id)

        if (unreadIds.length > 0) {
            markAsRead(unreadIds, isAdmin ? selectedUser?.id : undefined)
        }
    }, [messages, isAdmin, markAsRead, selectedUser])

    useEffect(() => {
        if (!isAdmin) return
        const query = searchQuery.trim()
        if (!query) {
            setSearchResults(null)
            setSearching(false)
            return
        }
        if (query.length < 2) {
            setSearchResults([])
            setSearching(false)
            return
        }
        setSearching(true)
        const handle = setTimeout(() => {
            api.searchSupportUsers(query)
                .then((results) => {
                    setSearchResults(results)
                })
                .catch(() => {
                    setSearchResults([])
                })
                .finally(() => {
                    setSearching(false)
                })
        }, 300)
        return () => clearTimeout(handle)
    }, [isAdmin, searchQuery])

    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const base = searchResults ?? users
        if (!query || searchResults) return base
        return base.filter(user => {
            const fullName = `${user.firstName} ${user.lastName || ""}`.toLowerCase()
            return (
                fullName.includes(query) ||
                (user.username || "").toLowerCase().includes(query)
            )
        })
    }, [users, searchQuery, searchResults])

    if (!adminReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-white">
                <Loader2 className="w-7 h-7 animate-spin text-accentpurple" />
            </div>
        )
    }

    if (isAdmin) {
        if (selectedUser) {
            return (
                <SupportChatView
                    title={`${selectedUser.firstName} ${selectedUser.lastName || ""}`.trim()}
                    subtitle={t("support.userIdLabel", { id: selectedUser.telegramId })}
                    avatarUrl={selectedUser.photoUrl}
                    onBack={() => setSelectedUser(null)}
                    messages={messages}
                    loading={loading}
                    onSend={(text) => sendMessage(text, selectedUser.id)}
                    onEdit={editMessage}
                    onDelete={deleteMessage}
                    adminUserId={selectedUser.id}
                    isAdminView
                    isDashView={isDash}
                />
            )
        }

        return (
            <div className="min-h-screen bg-background text-white">
                <header className="sticky top-0 z-10 px-4 pt-4">
                    <div className="glass-card rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-4">
                        {!isDash && (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate(backTarget)}
                                    className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <h1 className="text-lg font-semibold text-white">{t("support.title")}</h1>
                                    <p className="text-xs text-muted-foreground">{t("support.adminPanel")}</p>
                                </div>
                            </div>
                        )}

                        <div className={cn("relative", !isDash && "mt-4")}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t("support.searchUser")}
                                className="w-full h-11 pl-9 pr-4 glass-card rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground focus:outline-none focus:border-accentpurple/50"
                            />
                        </div>
                    </div>
                </header>

                <div className="px-4 py-4">
                    {usersLoading || searching ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-accentpurple" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            {t("support.noMessages")}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredUsers.map((user) => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    onClick={() => setSelectedUser(user)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <SupportChatView
            title={t("support.title")}
            subtitle={t("support.demoSubtitle")}
            messages={messages}
            loading={loading}
            onSend={(text) => sendMessage(text)}
            isAdminView={false}
            onBack={() => navigate(backTarget)}
            isDashView={isDash}
        />
    )
}

function UserRow({ user, onClick }: { user: SupportUser; onClick: () => void }) {
    return (
        <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="w-full glass-card rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center gap-3 hover:bg-white/10 transition-colors"
        >
            <div className="relative">
                <img
                    src={user.photoUrl || "https://i.imgur.com/zOlPMhT.png"}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border border-white/10"
                />
                {user.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-accentpink rounded-full flex items-center justify-center text-[10px] font-semibold text-white">
                        {user.unreadCount > 9 ? "9+" : user.unreadCount}
                    </div>
                )}
            </div>
            <div className="flex-1 text-left">
                <p className="font-medium text-white">
                    {user.firstName} {user.lastName || ""}
                </p>
                {user.username && (
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                )}
            </div>
            <span className="text-xs text-muted-foreground">
                {new Date(user.lastMessageAt).toLocaleDateString("en-US")}
            </span>
        </motion.button>
    )
}

function SupportChatView({
    title,
    subtitle,
    avatarUrl,
    messages,
    loading,
    onSend,
    onEdit,
    onDelete,
    onBack,
    isAdminView,
    adminUserId,
    isDashView
}: {
    title: string
    subtitle?: string
    avatarUrl?: string
    messages: SupportMessage[]
    loading: boolean
    onSend: (_text: string) => Promise<void>
    onEdit?: (_id: number, _text: string) => Promise<void>
    onDelete?: (_id: number) => Promise<void>
    onBack?: () => void
    isAdminView: boolean
    adminUserId?: number
    isDashView?: boolean
}) {
    const { t } = useI18n()
    const [input, setInput] = useState("")
    const [sending, setSending] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editText, setEditText] = useState("")
    const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [overview, setOverview] = useState<api.AdminUserOverview | null>(null)
    const [overviewLoading, setOverviewLoading] = useState(false)
    const [grantCourseId, setGrantCourseId] = useState<number | null>(null)

    const loadOverview = useCallback(async () => {
        if (!adminUserId) return
        setOverviewLoading(true)
        try {
            const data = await api.getAdminUserOverview(adminUserId)
            setOverview(data)
            const available = data.availableCourses.filter(course => !data.courses.some(c => c.id === course.id))
            setGrantCourseId(available[0]?.id ?? null)
        } finally {
            setOverviewLoading(false)
        }
    }, [adminUserId])

    useEffect(() => {
        if (detailsOpen && adminUserId) {
            loadOverview()
        }
    }, [detailsOpen, adminUserId, loadOverview])

    useEffect(() => {
        setOverview(null)
        setGrantCourseId(null)
        setDetailsOpen(false)
    }, [adminUserId])

    const handleGrantCourse = async () => {
        if (!adminUserId || !grantCourseId) return
        await api.grantCourseToUser(adminUserId, grantCourseId)
        await loadOverview()
    }

    const handleRevokeCourse = async (courseId: number) => {
        if (!adminUserId) return
        if (!confirm(t("support.confirmRemoveCourse"))) return
        await api.revokeCourseFromUser(adminUserId, courseId)
        await loadOverview()
    }

    const availableCourses = overview
        ? overview.availableCourses.filter(course => !overview.courses.some(c => c.id === course.id))
        : []
    const grantCourseValue = grantCourseId ? String(grantCourseId) : undefined

    const handleSend = async () => {
        if (!input.trim() || sending) return
        setSending(true)
        try {
            await onSend(input.trim())
            setInput("")
        } finally {
            setSending(false)
        }
    }

    const handleEdit = async (id: number) => {
        if (!editText.trim() || !onEdit) return
        await onEdit(id, editText.trim())
        setEditingId(null)
        setEditText("")
    }

    const handleDelete = async (id: number) => {
        if (!onDelete) return
        if (confirm(t("support.confirmDeleteMessage"))) {
            await onDelete(id)
        }
        setMenuOpenId(null)
    }

    return (
        <div className="min-h-screen flex flex-col bg-background text-white">
            <header className="sticky top-0 z-10 px-4 pt-4">
                <div className="glass-card rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-4">
                    <div className="flex items-center gap-3 w-full">
                        {onBack && !isDashView && (
                            <button
                                onClick={onBack}
                                className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        {avatarUrl && (
                            <img
                                src={avatarUrl || "https://i.imgur.com/zOlPMhT.png"}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover border border-white/10"
                            />
                        )}
                        <div>
                            <h1 className="text-lg font-semibold text-white">{title}</h1>
                            {subtitle && (
                                <p className="text-xs text-muted-foreground">{subtitle}</p>
                            )}
                        </div>
                        {isDashView && onBack && (
                            <div className="ml-auto">
                                <button
                                    onClick={onBack}
                                    className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-muted-foreground hover:text-white transition-colors"
                                >
                                    {t("support.backToList")}
                                </button>
                            </div>
                        )}
                        {isAdminView && adminUserId && !isDashView && (
                            <div className="ml-auto">
                                <button
                                    onClick={() => setDetailsOpen((prev) => !prev)}
                                    className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-muted-foreground hover:text-white transition-colors"
                                >
                                    {detailsOpen ? t("support.close") : t("support.view")}
                                </button>
                            </div>
                        )}
                        {isAdminView && adminUserId && isDashView && (
                            <div className="ml-2">
                                <button
                                    onClick={() => setDetailsOpen((prev) => !prev)}
                                    className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-muted-foreground hover:text-white transition-colors"
                                >
                                    {detailsOpen ? t("support.close") : t("support.view")}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {isAdminView && adminUserId && detailsOpen && (
                <div className="px-4 pt-3">
                    <div className="rounded-2xl border border-white/10 p-4 backdrop-blur-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-white">{t("support.userData")}</h2>
                            <button
                                onClick={loadOverview}
                                disabled={overviewLoading}
                                className="text-xs text-muted-foreground hover:text-white transition-colors"
                            >
                                {overviewLoading ? t("support.loading") : t("support.refresh")}
                            </button>
                        </div>

                        {overviewLoading && !overview ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-accentpurple" />
                            </div>
                        ) : overview ? (
                            <>
                                <div className="text-xs text-muted-foreground">
                                    {overview.user.username
                                        ? `${t("support.userIdLabel", { id: overview.user.telegramId })} • @${overview.user.username}`
                                        : t("support.userIdLabel", { id: overview.user.telegramId })}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs uppercase text-muted-foreground tracking-wider">{t("support.coursesTitle")}</h3>
                                        <span className="text-xs text-muted-foreground">
                                            {overview.courses.length}
                                        </span>
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
                                        <span className="text-xs text-muted-foreground">
                                            {overview.transactions.length}
                                        </span>
                                    </div>
                                    {overview.transactions.length === 0 ? (
                                        <div className="text-xs text-muted-foreground">{t("support.noTransactions")}</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {overview.transactions.map(tx => (
                                                <div
                                                    key={tx.id}
                                                    className="rounded-xl border border-white/10 px-3 py-2 flex items-center justify-between"
                                                >
                                                    <div>
                                                        <p className="text-sm text-white">{tx.title}</p>
                                                        <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                                                    </div>
                                                    <span className={`text-sm ${tx.status === "success" ? "text-white" : "text-accentpink"}`}>
                                                        {tx.amount}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-xs text-muted-foreground">{t("support.dataUnavailable")}</div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-3">
                {loading && messages.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-accentpurple" />
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((msg) => {
                            const isOwn = msg.senderType === (isAdminView ? "admin" : "user")
                            const timeLabel = new Date(msg.createdAt).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit"
                            })

                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="flex w-full items-end gap-3"
                                >
                                    {isOwn ? (
                                        <>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {timeLabel}
                                                {msg.isEdited && ` • ${t("support.edited")}`}
                                            </span>
                                            {editingId === msg.id ? (
                                                <div className="ml-auto max-w-[75%] space-y-2">
                                                    <input
                                                        type="text"
                                                        value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        className="w-full px-3 py-2 rounded-xl bg-white/10 border border-accentpurple/40 text-white focus:outline-none focus:border-accentpurple/70"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            className="bg-accentpurple text-white hover:bg-accentpurple/90"
                                                            onClick={() => handleEdit(msg.id)}
                                                        >
                                                            {t("support.save")}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-muted-foreground hover:text-white"
                                                            onClick={() => setEditingId(null)}
                                                        >
                                                            {t("support.cancel")}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="ml-auto relative group max-w-[75%]">
                                                    <div className={cn(
                                                        "px-4 py-3 rounded-2xl border text-sm whitespace-pre-wrap",
                                                        "bg-accentpurple/20 border-accentpurple/30 text-white rounded-br-lg"
                                                    )}>
                                                        <p>{msg.message}</p>
                                                    </div>

                                                    {isAdminView && msg.senderType === "admin" && (
                                                        <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => setMenuOpenId(menuOpenId === msg.id ? null : msg.id)}
                                                                className="p-1 rounded-full hover:bg-white/10"
                                                            >
                                                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                            </button>

                                                            {menuOpenId === msg.id && (
                                                                <div className="absolute right-0 top-full mt-1 glass-card rounded-xl border border-white/10 py-1 min-w-[140px] z-10">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingId(msg.id)
                                                                            setEditText(msg.message)
                                                                            setMenuOpenId(null)
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-sm"
                                                                    >
                                                                        <Edit2 className="w-4 h-4" />
                                                                        {t("support.edit")}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(msg.id)}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-sm text-accentpink"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                        {t("support.delete")}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="relative group max-w-[75%]">
                                                <div className={cn(
                                                    "px-4 py-3 rounded-2xl border text-sm whitespace-pre-wrap",
                                                    "bg-white/10 border-white/10 text-white rounded-bl-lg"
                                                )}>
                                                    <p>{msg.message}</p>
                                                </div>
                                            </div>
                                            <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">
                                                {timeLabel}
                                                {msg.isEdited && ` • ${t("support.edited")}`}
                                            </span>
                                        </>
                                    )}
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}
            </div>

            <div className="fixed bottom-16 left-0 right-0 z-40">
                <div className="max-w-md mx-auto px-4 pb-4">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-2 backdrop-blur-md">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder={t("support.typeMessage")}
                            className="flex-1 bg-transparent text-white placeholder:text-muted-foreground focus:outline-none"
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!input.trim() || sending}
                            size="icon"
                            className="h-9 w-9 rounded-full bg-accentpurple text-white hover:bg-accentpurple/90"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
