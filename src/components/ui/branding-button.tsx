import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

interface BrandingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    text?: string
    showGlow?: boolean
    buttonClassName?: string
}

export function BrandingButton({ text, showGlow = true, className, buttonClassName, ...props }: BrandingButtonProps) {
    const [isPressed, setIsPressed] = useState(false)
    const { t } = useI18n()
    const label = text ?? t("common.enrollNow")

    return (
        <div
            className={cn("relative group", className)}
            onPointerDown={() => setIsPressed(true)}
            onPointerUp={() => setIsPressed(false)}
            onPointerLeave={() => setIsPressed(false)}
            onTouchStart={() => setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
        >
            {/* Dynamic Outer Glow */}
            {showGlow && (
                <div className="absolute inset-0 rounded-full blur-xl opacity-60 z-0 scale-75 pointer-events-none">
                    <div className="absolute inset-0 opacity-100 mix-blend-screen transition-opacity duration-300" style={{ opacity: isPressed ? 0.4 : 1 }}>
                        <motion.div
                            animate={isPressed ? { x: -80, y: -80, scale: 0.5 } : { x: [0, 40, -30, 0], y: [0, -30, 40, 0], scale: [1, 1.2, 1] }}
                            transition={isPressed ? { duration: 0.3 } : { duration: 8, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-[-20%] left-[-20%] w-[80%] h-[200%] rounded-full bg-[#47256e] opacity-80"
                        />
                        <motion.div
                            animate={isPressed ? { x: 80, y: -80, scale: 0.5 } : { x: [0, -35, 25, 0], y: [0, 30, -25, 0], scale: [1, 1.1, 0.9, 1] }}
                            transition={isPressed ? { duration: 0.3 } : { duration: 10, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-[10%] right-[-20%] w-[70%] h-[180%] rounded-full bg-[#8f280b] opacity-80"
                        />
                        <motion.div
                            animate={isPressed ? { x: -60, y: 80, scale: 0.5 } : { x: [0, 30, -30, 0], y: [0, -30, 30, 0], scale: [1, 1.3, 1] }}
                            transition={isPressed ? { duration: 0.3 } : { duration: 12, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute bottom-[-20%] left-[10%] w-[75%] h-[190%] rounded-full bg-[#7e36b3] opacity-80"
                        />
                        <motion.div
                            animate={isPressed ? { x: -80, y: 0, scale: 0.5 } : { x: [0, -25, 25, 0], y: [0, 25, -25, 0], scale: [1, 1.1, 1] }}
                            transition={isPressed ? { duration: 0.3 } : { duration: 7, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-[30%] left-[30%] w-[60%] h-[150%] rounded-full bg-[#c4441d] opacity-80"
                        />
                        <motion.div
                            animate={isPressed ? { x: 80, y: 50, scale: 0.5 } : { x: [0, 20, -20, 0], y: [0, -20, 20, 0], scale: [1, 1.2, 1] }}
                            transition={isPressed ? { duration: 0.3 } : { duration: 9, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute bottom-[20%] right-[10%] w-[65%] h-[160%] rounded-full bg-[#b64ad4] opacity-80"
                        />
                        <motion.div
                            animate={isPressed ? { x: 0, y: -100, scale: 0.5 } : { x: [0, -30, 30, 0], y: [0, 35, -35, 0], scale: [1, 1.2, 1] }}
                            transition={isPressed ? { duration: 0.3 } : { duration: 11, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-[10%] left-[40%] w-[50%] h-[140%] rounded-full bg-[#FCAF45] opacity-80"
                        />
                    </div>
                </div>
            )}

            <Button
                size="lg"
                className={cn(
                    "relative z-10 overflow-hidden rounded-full font-semibold h-12 px-8 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-300 group border-[2.5px] border-white/20 bg-black/40 backdrop-blur-sm active:bg-black/50 hover:bg-black/50",
                    buttonClassName
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                {...props}
            >
                {/* Miniature Hero Animation Background */}
                <div className="absolute inset-0 bg-[#0c0c0e]/50">
                    <div className="absolute inset-0 opacity-100 mix-blend-screen transition-opacity duration-300" style={{ opacity: isPressed ? 0.7 : 1 }}>
                        {/* 1. Dark Purple - Scatters Top Left */}
                        <motion.div
                            animate={isPressed ? { x: -60, y: -60, scale: 0.8, opacity: 0.3 } : { x: [0, 40, -30, 0], y: [0, -30, 40, 0], scale: [1, 1.2, 1] }}
                            transition={isPressed ? { duration: 0.4, ease: "backOut" } : { duration: 8, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-[-20%] left-[-20%] w-[80%] h-[200%] rounded-full bg-[#47256e] blur-[15px] opacity-80"
                        />
                        {/* 2. Dark Pink - Scatters Top Right */}
                        <motion.div
                            animate={isPressed ? { x: 60, y: -60, scale: 0.8, opacity: 0.3 } : { x: [0, -35, 25, 0], y: [0, 30, -25, 0], scale: [1, 1.1, 0.9, 1] }}
                            transition={isPressed ? { duration: 0.4, ease: "backOut" } : { duration: 10, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-[10%] right-[-20%] w-[70%] h-[180%] rounded-full bg-[#8f280b] blur-[15px] opacity-80"
                        />
                        {/* 3. Medium Purple - Scatters Bottom Left */}
                        <motion.div
                            animate={isPressed ? { x: -60, y: 60, scale: 0.8, opacity: 0.3 } : { x: [0, 30, -30, 0], y: [0, -30, 30, 0], scale: [1, 1.3, 1] }}
                            transition={isPressed ? { duration: 0.4, ease: "backOut" } : { duration: 12, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute bottom-[-20%] left-[10%] w-[75%] h-[190%] rounded-full bg-[#7e36b3] blur-[15px] opacity-80"
                        />
                        {/* 4. Orange - Scatters Left */}
                        <motion.div
                            animate={isPressed ? { x: -70, y: 0, scale: 0.8, opacity: 0.3 } : { x: [0, -25, 25, 0], y: [0, 25, -25, 0], scale: [1, 1.1, 1] }}
                            transition={isPressed ? { duration: 0.4, ease: "backOut" } : { duration: 7, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-[30%] left-[30%] w-[60%] h-[150%] rounded-full bg-[#c4441d] blur-[15px] opacity-80"
                        />
                        {/* 5. Lightest Purple - Scatters Right */}
                        <motion.div
                            animate={isPressed ? { x: 70, y: 20, scale: 0.8, opacity: 0.3 } : { x: [0, 20, -20, 0], y: [0, -20, 20, 0], scale: [1, 1.2, 1] }}
                            transition={isPressed ? { duration: 0.4, ease: "backOut" } : { duration: 9, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute bottom-[20%] right-[10%] w-[65%] h-[160%] rounded-full bg-[#b64ad4] blur-[15px] opacity-80"
                        />
                        {/* 6. Gold - Scatters Top Center */}
                        <motion.div
                            animate={isPressed ? { x: 0, y: -70, scale: 0.8, opacity: 0.3 } : { x: [0, -30, 30, 0], y: [0, 35, -35, 0], scale: [1, 1.2, 1] }}
                            transition={isPressed ? { duration: 0.4, ease: "backOut" } : { duration: 11, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-[10%] left-[40%] w-[50%] h-[140%] rounded-full bg-[#FCAF45] blur-[15px] opacity-80"
                        />
                    </div>
                </div>
                <span className="relative z-10 text-white group-active:scale-95 transition-transform duration-300">{label}</span>
            </Button>
        </div>
    )
}
