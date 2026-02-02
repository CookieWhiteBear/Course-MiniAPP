import { Routes, Route, useLocation } from "react-router-dom"
import { MobileLayout } from "@/components/layout/MobileLayout"
import { HomePage } from "@/pages/HomePage"
import { MyCoursesPage } from "@/pages/MyCoursesPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { CoursePage } from "@/pages/CoursePage"
import { LessonPage } from "@/pages/LessonPage"
import { SupportPage } from "@/pages/SupportPage"
import { DashLayout } from "@/components/layout/DashLayout"
import { DashHomePage } from "@/pages/DashHomePage"
import { DashSupportPage } from "@/pages/DashSupportPage"
import { DashUsersPage } from "@/pages/DashUsersPage"
import { DashTransactionsPage } from "@/pages/DashTransactionsPage"
import { DashReviewsPage } from "@/pages/DashReviewsPage"
import { DashCoursesPage } from "@/pages/DashCoursesPage"

export function AppRoutes() {
    const location = useLocation()

    return (
        <Routes location={location} key={location.pathname}>
            <Route element={<MobileLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/course/:id" element={<CoursePage />} />
                <Route path="/my-courses" element={<MyCoursesPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="*" element={<HomePage />} />
            </Route>

            {/* Fullscreen Routes (No BottomNav) */}
            <Route path="/course/:id/learn" element={<LessonPage />} />

            {/* Dashboard Routes */}
            <Route path="/dash" element={<DashLayout />}>
                <Route index element={<DashHomePage />} />
                <Route path="support" element={<DashSupportPage />} />
                <Route path="users" element={<DashUsersPage />} />
                <Route path="transactions" element={<DashTransactionsPage />} />
                <Route path="reviews" element={<DashReviewsPage />} />
                <Route path="courses" element={<DashCoursesPage />} />
            </Route>
        </Routes>
    )
}
