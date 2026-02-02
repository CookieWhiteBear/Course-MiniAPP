import { Button } from "@/components/ui/button"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHandle,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { useState } from "react"
import { motion } from "framer-motion"
import { Loader2, ExternalLink } from "lucide-react"
import { BrandingButton } from "@/components/ui/branding-button"
import { createPortal } from "react-dom"
import * as api from "@/lib/api"
import { getTelegram } from "@/lib/telegram"
import telegramStarsIcon from "@/assets/Telegram_Premium.png"
import { useI18n } from "@/lib/i18n"

interface PurchaseDrawerProps {
    price: string
    courseId: number
    starsPrice?: number
}

export function PurchaseDrawer({ price, courseId, starsPrice }: PurchaseDrawerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isStarsProcessing, setIsStarsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const normalizedStarsPrice = typeof starsPrice === 'number' ? starsPrice : NaN
    const hasStarsPrice = Number.isFinite(normalizedStarsPrice) && normalizedStarsPrice > 0
    const starsLabel = hasStarsPrice ? `${normalizedStarsPrice}` : "-"
    const { t } = useI18n()

    const handleStarsPurchase = async () => {
        if (!hasStarsPrice) {
            setError(t("purchase.starsUnavailable"))
            return
        }
        setIsStarsProcessing(true)
        setError(null)

        try {
            const { invoiceLink } = await api.createStarsInvoiceLink(courseId)
            if (api.isDemoMode() || !invoiceLink) {
                setIsStarsProcessing(false)
                setIsOpen(false)
                return
            }
            const tg = getTelegram()

            if (tg?.openInvoice) {
                tg.openInvoice(invoiceLink, (status) => {
                    if (status === 'failed') {
                        setError(t("purchase.starsPaymentFailed"))
                    } else if (status === 'cancelled') {
                        setError(t("purchase.starsPaymentCanceled"))
                    }
                    setIsStarsProcessing(false)
                })
            } else if (tg?.openLink) {
                tg.openLink(invoiceLink)
                setIsStarsProcessing(false)
            } else {
                window.location.href = invoiceLink
                setIsStarsProcessing(false)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t("purchase.starsInvoiceFailed"))
            setIsStarsProcessing(false)
        }
    }

    const handlePurchase = async () => {
        setIsProcessing(true)
        setError(null)

        try {
            const { approveUrl } = await api.createPurchaseLink(courseId)

            if (api.isDemoMode() || !approveUrl) {
                setIsProcessing(false)
                setIsOpen(false)
                return
            }

            // Direct redirect to PayPal (bypassing intermediate page)
            // PayPal will use device's color scheme preference
            window.location.href = approveUrl

        } catch (err) {
            setError(err instanceof Error ? err.message : t("purchase.paymentFailed"))
            setIsProcessing(false)
        }
    }

    return createPortal(
        <Drawer open={isOpen} onOpenChange={setIsOpen} shouldScaleBackground={false} handleOnly>
            <DrawerTrigger asChild>
                <motion.div
                    initial={{ y: 200, opacity: 0 }}
                    animate={{
                        y: isOpen ? 200 : 0,
                        opacity: isOpen ? 0 : 1
                    }}
                    transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 120,
                        mass: 1
                    }}
                    style={{ pointerEvents: isOpen ? "none" : "auto" }}
                    className="fixed bottom-24 left-4 right-4 md:left-0 md:right-0 md:mx-auto md:w-full md:max-w-md p-2 bg-[#1c1c1e]/40 backdrop-blur-3xl border border-white/20 z-[9999] shadow-2xl rounded-full overflow-hidden"
                >
                    <div className="flex items-center justify-between gap-4 pl-4 pr-1">
                        <div className="flex flex-col relative z-20">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{t("purchase.priceLabel")}</span>
                            <span className="text-xl font-bold text-white leading-none">{price}</span>
                        </div>

                        <BrandingButton text={t("purchase.buyCourse")} />

                    </div>
                </motion.div>
            </DrawerTrigger>
            <DrawerContent className="max-w-md mx-auto glass-card border-t-0">
                <DrawerHandle className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle className="text-2xl">{t("purchase.title")}</DrawerTitle>
                        <DrawerDescription>{t("purchase.subtitle")}</DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 pb-0 space-y-4">
                        <div className="space-y-1 py-4 border-y border-dashed border-white/10">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{t("purchase.coursePrice")}</span>
                                <span>{price}</span>
                            </div>
                            <div className="flex justify-between text-sm text-xs text-white/50">
                                <span>{t("purchase.payWithPayPal")}</span>
                                <span>{t("purchase.paypalMethods")}</span>
                            </div>
                            <div className="flex justify-between font-bold pt-2 mt-2 border-t border-white/10">
                                <span className="text-muted-foreground mr-2">{t("purchase.total")}</span>
                                <span className="text-white">{price}</span>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                    </div>
                    <DrawerFooter
                        data-vaul-no-drag
                        className="pb-[calc(1rem+env(safe-area-inset-bottom))]"
                    >
                        <Button onClick={handlePurchase} disabled={isProcessing} className="w-full h-12 text-lg">
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isProcessing ? t("purchase.creatingPayment") : (
                                <>
                                    {t("purchase.pay", { price })}
                                    <ExternalLink className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={handleStarsPurchase}
                            disabled={isProcessing || isStarsProcessing || !hasStarsPrice}
                            variant="outline"
                            className="w-full h-12 text-lg justify-center"
                        >
                            {isStarsProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isStarsProcessing ? t("purchase.creatingPayment") : (
                                <span className="inline-flex items-center justify-center gap-1">
                                    {t("purchase.payWithStars")}
                                    <img
                                        src={telegramStarsIcon}
                                        alt={t("purchase.telegramStarsAlt")}
                                        className="h-4 w-4"
                                    />
                                    <span>{starsLabel}</span>
                                </span>
                            )}
                        </Button>
                        <DrawerClose asChild>
                            <Button variant="outline" disabled={isProcessing}>{t("purchase.cancel")}</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>,
        document.body
    )
}
