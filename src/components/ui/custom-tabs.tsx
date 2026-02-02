import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface TabOption {
    id: string
    label: string
}

interface CustomTabsProps {
    tabs: TabOption[]
    activeTab: string
    onChange: (_id: string) => void
    className?: string
}

export function CustomTabs({ tabs, activeTab, onChange, className }: CustomTabsProps) {
    return (
        <div className={cn("flex space-x-1 bg-white/5 p-1 rounded-xl", className)}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            "relative flex-1 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none",
                            isActive ? "text-white" : "text-white/50 hover:text-white/70"
                        )}
                        style={{
                            WebkitTapHighlightColor: "transparent",
                        }}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="activeTabIndicator"
                                className="absolute inset-0 bg-white/10 rounded-lg shadow-sm"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
