import { Outlet, useLocation } from "react-router-dom"
import { BottomNav } from "./BottomNav"

export function MobileLayout() {
    const location = useLocation()
    const isLessonPage = /^\/course\/[^/]+\/learn$/.test(location.pathname)

    return (
        <div className="min-h-screen bg-background pb-20">
            <main className={`max-w-md mx-auto px-4 ${isLessonPage ? "pt-0" : "pt-[90px]"}`}>
                <Outlet />
            </main>
            <BottomNav />
        </div>
    )
}
