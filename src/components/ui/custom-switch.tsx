import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface CustomSwitchProps {
    checked: boolean
    onCheckedChange: (_checked: boolean) => void
    className?: string
}

export function CustomSwitch({ checked, onCheckedChange, className }: CustomSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "relative w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-primary" : "bg-white/20",
                className
            )}
        >
            <motion.div
                initial={false}
                animate={{ x: checked ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                    "grid place-items-center w-5 h-5 rounded-full bg-white shadow-lg",
                    "absolute top-0.5 left-0.5"
                )}
            />
        </button>
    )
}
