import { CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, PlayCircle, Heart } from "lucide-react"
import { motion } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

interface CourseCardProps {
    id: number
    title: string
    author: string
    authorAvatar?: string
    price: string
    rating: number
    image: string
    category: string
    variant?: 'catalog' | 'my-course'
    progress?: number
    isFavorite?: boolean
    onToggleFavorite?: (_event: React.MouseEvent) => void
    showFavorite?: boolean
    reviewsCount?: number
}

export function CourseCard({
    title,
    author,
    authorAvatar,
    price,
    rating,
    image,
    category,
    variant = 'catalog',
    progress = 0,
    isFavorite = false,
    onToggleFavorite,
    showFavorite = true,
    reviewsCount = 0
}: CourseCardProps) {
    const isMyCourse = variant === 'my-course'
    const { t } = useI18n()

    return (
        // Link removed to allow parent to control navigation timing (for flatten effect)
        <motion.div
            // layoutId removed - handled manually by HomePage overlay
            className={cn(
                "relative rounded-xl overflow-hidden h-full z-10 cursor-pointer transition-colors",
                "glass-card border-0 bg-[#1c1c1e] text-white"
            )}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
        >
            <div className="relative">
                <div className="aspect-video relative overflow-hidden rounded-xl">
                    <img
                        src={image}
                        alt={title}
                        className="object-cover w-full h-full hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1e] via-transparent to-transparent opacity-90" />
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-white font-medium border border-white/10">
                        {category}
                    </div>

                    {/* Favorite Button */}
                    {showFavorite && onToggleFavorite && (
                        <button
                            onClick={onToggleFavorite}
                            className="absolute top-2 right-2 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-colors z-30 group"
                        >
                            <Heart
                                className={cn(
                                    "w-4 h-4 transition-all duration-300",
                                    isFavorite ? "fill-red-500 text-red-500 scale-110" : "text-white group-hover:scale-110"
                                )}
                            />
                        </button>
                    )}
                </div>

                {/* Overlapping Avatar - Placed outside overflow-hidden div */}
                <div className="absolute -bottom-5 right-4 z-20">
                    <div className="w-10 h-10 rounded-full border-2 border-[#1c1c1e] overflow-hidden shadow-lg bg-[#1c1c1e]">
                        {/* Using a deterministic avatar based on ID or just a placeholder */}
                        <img src={authorAvatar || "https://i.imgur.com/zOlPMhT.png"} alt={author} className="w-full h-full object-cover" />
                    </div>
                </div>
            </div>

            <CardHeader className="p-4 pb-2 relative z-10 pt-6">
                <h3 className={cn("font-semibold text-lg leading-tight line-clamp-2", isMyCourse && "text-white")}>{title}</h3>
                <p className="text-sm text-muted-foreground">{author}</p>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-3">
                {variant === 'catalog' ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1 text-orange-400">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="text-sm font-medium text-foreground">{rating}</span>
                            {reviewsCount > 0 && (
                                <span className="text-xs text-muted-foreground">({reviewsCount})</span>
                            )}
                        </div>
                        <span className="font-bold text-lg">{price}</span>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{t("courseCard.progress")}</span>
                            <span>{progress >= 100 ? t("courseCard.completed") : `${Math.min(progress, 99)}%`}</span>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-1.5" />
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-4 pt-0 pb-4">
                {variant === 'catalog' ? (
                    <Button size="lg" className="w-full rounded-xl font-semibold shadow-lg shadow-primary/20 pointer-events-none">{t("courseCard.buy")}</Button>
                ) : (
                    <Button size="lg" className="w-full rounded-xl font-semibold bg-white text-black hover:bg-white/90 shadow-lg pointer-events-none">
                        <PlayCircle className="w-4 h-4 mr-2" />
                        {t("courseCard.continue")}
                    </Button>
                )}
            </CardFooter>
        </motion.div>
    )
}
