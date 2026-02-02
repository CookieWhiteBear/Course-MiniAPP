// ... imports
import { BrandingHeader } from "@/components/layout/BrandingHeader"
import { HomeHero } from "@/components/feature/HomeHero"
import { FeaturedCarousel } from "@/components/feature/FeaturedCarousel"
import { motion, useScroll, useMotionValueEvent } from "framer-motion"
import { Search, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useFeaturedCourses } from "@/hooks/useApi"
import type { Course } from "@/lib/api"
import { getTelegram } from "@/lib/telegram"
import { useI18n } from "@/lib/i18n"

export function HomePage() {
    const { scrollY } = useScroll()
    const [showBrand, setShowBrand] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { t } = useI18n()

    // Fetch courses from API
    const { data: courses, loading, error } = useFeaturedCourses()

    // Check for payment return
    useEffect(() => {
        const token = searchParams.get('token')
        const paymentId = searchParams.get('PayerID')

        if (token || paymentId) {
            // User returned from PayPal
            const tg = getTelegram()
            if (tg) {
                // Show notification
                tg.showPopup({
                    title: t("home.payment.successTitle"),
                    message: t("home.payment.successMessage"),
                    buttons: [{ type: 'ok' }]
                })
            }
            // Clean URL
            setSearchParams({})
        }
    }, [searchParams, setSearchParams, t])

    useMotionValueEvent(scrollY, "change", (latest) => {
        setShowBrand(latest > 100)
    })

    // Filter courses based on search
    const filteredCourses = (courses || []).filter(course =>
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.category.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleCourseClick = (course: Course) => {
        navigate(`/course/${course.id}`)
    }

    return (
        <motion.div
            className="space-y-6 pb-20 relative transform-gpu"
        >
            {/* Sticky Branding Pill */}
            <BrandingHeader isVisible={showBrand} />

            <HomeHero />

            <section className="space-y-4 pt-4 px-4">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">{t("home.title")}</h1>
                    <p className="text-muted-foreground">{t("home.subtitle")}</p>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        placeholder={t("home.searchPlaceholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/10 focus:bg-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60 text-white"
                    />
                </div>
            </section>

            <section className="space-y-4 px-1 relative z-0">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : error ? (
                    <div className="text-center py-20 text-red-400">
                        {error}
                    </div>
                ) : filteredCourses.length > 0 ? (
                    <FeaturedCarousel
                        courses={filteredCourses}
                        onCourseClick={handleCourseClick}
                    />
                ) : (
                    <div className="text-center py-20 text-muted-foreground">
                        {t("home.noCourses")}
                    </div>
                )}
            </section>
        </motion.div>
    )
}
