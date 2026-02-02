import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import * as api from "@/lib/api"

export function DashCoursesPage() {
    const { t } = useI18n()
    const [courses, setCourses] = useState<api.AdminCourseInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const data = await api.listAdminCourses()
                if (!active) return
                setCourses(data)
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

    return (
        <div className="space-y-6">
            {loading ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-accentpurple" />
                </div>
            ) : error ? (
                <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-accentpink">
                    {error}
                </div>
            ) : courses.length === 0 ? (
                <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-muted-foreground">
                    {t("dash.courses.empty")}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {courses.map(course => (
                        <div key={course.id} className="glass-card rounded-2xl border border-white/10 bg-white/5 p-5">
                            <div className="flex items-start gap-3">
                                <img
                                    src={course.imageUrl || "https://i.imgur.com/zOlPMhT.png"}
                                    alt=""
                                    className="h-16 w-16 rounded-xl object-cover border border-white/10"
                                />
                                <div className="min-w-0">
                                    <p className="text-sm text-muted-foreground">{course.category || t("common.course")}</p>
                                    <h3 className="text-lg font-semibold text-white truncate">{course.title}</h3>
                                </div>
                                <div className="ml-auto text-right">
                                    <p className="text-xs text-muted-foreground">{t("common.price")}</p>
                                    <p className="text-sm text-white">
                                        {course.price ? currencyFormatter.format(course.price) : t("common.na")}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                                <div>
                                    <p>{t("dash.courses.students")}</p>
                                    <p className="text-sm text-white">{course.studentsCount}</p>
                                </div>
                                <div>
                                    <p>{t("dash.courses.revenue")}</p>
                                    <p className="text-sm text-white">{currencyFormatter.format(course.revenue)}</p>
                                </div>
                                <div>
                                    <p>{t("dash.courses.rating")}</p>
                                    <p className="text-sm text-white">{course.avgRating.toFixed(1)}</p>
                                </div>
                                <div>
                                    <p>{t("dash.courses.reviews")}</p>
                                    <p className="text-sm text-white">{course.reviewsCount}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
