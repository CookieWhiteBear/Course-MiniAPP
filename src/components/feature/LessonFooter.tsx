import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useI18n } from "@/lib/i18n"

interface LessonFooterProps {
    progress: number
    currentPage: number
    totalPages: number
    onPrev: () => void
    onNext: () => void
    onSearch?: (_query: string) => void
    className?: string
}

export function LessonFooter({
    progress,
    currentPage,
    totalPages,
    onPrev,
    onNext,
    onSearch,
    className
}: LessonFooterProps) {
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const { t } = useI18n()

    useEffect(() => {
        if (isSearchOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isSearchOpen])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchQuery(value)
        onSearch?.(value)
    }

    const handleCloseSearch = () => {
        setIsSearchOpen(false)
        setSearchQuery("")
        onSearch?.("")
    }

    return (
        <div className={cn("fixed bottom-0 left-0 right-0 z-50", className)}>
            {/* Progress Bar */}
            <div className="w-full h-1 bg-black/20">
                <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Glass Container */}
            <div className="bg-[#1c1c1e]/80 backdrop-blur-xl border-t border-white/10 px-6 py-4 pb-8 h-[88px] flex items-center justify-between relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {!isSearchOpen ? (
                        <motion.div
                            key="nav-controls"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="w-full flex items-center justify-between"
                        >
                            {/* Back Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onPrev}
                                disabled={currentPage === 0}
                                className="text-white hover:bg-white/10 hover:text-white rounded-full w-12 h-12"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </Button>

                            {/* Search Trigger */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsSearchOpen(true)}
                                className="text-white/70 hover:bg-white/10 hover:text-white rounded-full w-10 h-10"
                            >
                                <Search className="w-5 h-5" />
                            </Button>

                            {/* Next Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onNext}
                                disabled={currentPage === totalPages - 1}
                                className="text-white hover:bg-white/10 hover:text-white rounded-full w-12 h-12"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </Button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="search-input"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="w-full flex items-center gap-3"
                        >
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder={t("lessonFooter.searchPlaceholder")}
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    className="w-full h-10 pl-9 pr-4 rounded-full bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-white/20 transition-all text-sm"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCloseSearch}
                                className="text-white hover:bg-white/10 rounded-full w-10 h-10 shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
