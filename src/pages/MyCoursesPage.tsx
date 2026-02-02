import { motion, useScroll, useMotionValueEvent } from "framer-motion"
import { Search, Loader2, RefreshCw } from "lucide-react"
import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { FeaturedCarousel } from "@/components/feature/FeaturedCarousel"
import { BrandingHeader } from "@/components/layout/BrandingHeader"
import { Button } from "@/components/ui/button"
import { useUserCourses } from "@/hooks/useApi"
import * as api from "@/lib/api"
import { useI18n } from "@/lib/i18n"

export function MyCoursesPage() {
    const { scrollY } = useScroll()
    const [showBrand, setShowBrand] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const navigate = useNavigate()
    const { t } = useI18n()

    // Fetch user's purchased courses from API
    const { data: myCourses, loading, error, refetch } = useUserCourses()

    useMotionValueEvent(scrollY, "change", (latest) => {
        setShowBrand(latest > 50)
    })

    const handleToggleFavorite = async (courseId: number) => {
        try {
            await api.toggleCourseFavorite(courseId)
            refetch() // Refresh the list
        } catch (err) {
            console.error('Failed to toggle favorite:', err)
        }
    }

    // Filter and Sort: Favorites first
    const processedCourses = useMemo(() => {
        const courses = myCourses || []
        const filtered = courses.filter(course =>
            course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.category.toLowerCase().includes(searchQuery.toLowerCase())
        )

        // Sort favorites to the top
        return filtered.sort((a, b) => {
            if (a.isFavorite === b.isFavorite) return 0
            return a.isFavorite ? -1 : 1
        })
    }, [myCourses, searchQuery])

    const handleCourseClick = (course: { id: number }) => {
        navigate(`/course/${course.id}/learn`)
    }

    return (
        <motion.div
            className="min-h-screen text-white pb-20 pt-6 px-4 space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <BrandingHeader isVisible={showBrand} />

            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">{t("myCourses.title")}</h1>
                <p className="text-muted-foreground">{t("myCourses.subtitle")}</p>
            </div>

            {/* Search Bar */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    placeholder={t("myCourses.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/10 focus:bg-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60 text-white"
                />
            </div>

            <section className="relative z-0">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : error ? (
                    <div className="text-center py-20 text-red-400">
                        {error}
                    </div>
                ) : processedCourses.length > 0 ? (
                    <FeaturedCarousel
                        courses={processedCourses}
                        onCourseClick={handleCourseClick}
                        onToggleFavorite={handleToggleFavorite}
                    />
                ) : (
                    <div className="text-center py-20 text-muted-foreground space-y-4">
                        <p>{t("myCourses.emptyTitle")}</p>
                        <p className="text-sm">{t("myCourses.emptySubtitle")}</p>
                        <Button
                            onClick={refetch}
                            variant="outline"
                            size="sm"
                            className="mt-4"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {t("myCourses.refresh")}
                        </Button>
                    </div>
                )}
            </section>
        </motion.div>
    )
}
