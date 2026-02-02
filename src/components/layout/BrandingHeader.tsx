import { motion, AnimatePresence } from "framer-motion"
import { createPortal } from "react-dom"
import { useI18n } from "@/lib/i18n"

interface BrandingHeaderProps {
    isVisible: boolean
}

export function BrandingHeader({ isVisible }: BrandingHeaderProps) {
    const { t } = useI18n()

    return createPortal(
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed top-[50px] left-0 right-0 mx-auto w-fit z-[100] pointer-events-none"
                >
                    <div className="px-4 py-1.5 rounded-full bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center justify-center">
                        <span className="text-xs font-medium tracking-wide text-white/90">{t("common.courses")}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    )
}
