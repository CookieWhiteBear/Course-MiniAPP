import { Home, BookOpen, User } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useSupport } from "@/hooks/useSupport"
import { useI18n } from "@/lib/i18n"

export function BottomNav() {
    const location = useLocation()
    const path = location.pathname
    const { unreadCount } = useSupport()
    const { t } = useI18n()

    const navItems = [
        { icon: Home, label: t("nav.home"), href: "/" },
        { icon: BookOpen, label: t("nav.myCourses"), href: "/my-courses" },
        { icon: User, label: t("nav.profile"), href: "/profile" },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 glass-nav">
            <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
                {navItems.map((item) => {
                    const isActive = path === item.href
                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-90",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-primary/80"
                            )}
                        >
                            {item.href === "/profile" ? (
                                <div className="relative">
                                    <item.icon className={cn("w-6 h-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accentpink" />
                                    )}
                                </div>
                            ) : (
                                <item.icon className={cn("w-6 h-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                            )}
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
