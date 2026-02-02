import { motion } from "framer-motion"
import { useState, useRef, useEffect } from "react"
import { WaveGradient } from "wave-gradient"
import { useI18n } from "@/lib/i18n"
import * as api from "@/lib/api"

const DEFAULT_WAVE_COLORS = ["#e8320e", "#e88d0e", "#e8320e", "#120012", "#07004f", "#1200d9", "#120012", "#120012"]

export function HomeHero() {
    const { t } = useI18n()
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const gradientRef = useRef<InstanceType<typeof WaveGradient> | null>(null)
    const ringText = t("home.hero.ringText")
    const [uiConfig, setUiConfig] = useState<api.UiConfig | null>(null)

    const heroImageUrl = uiConfig?.homeHero?.imageUrl || "https://i.imgur.com/zOlPMhT.png"
    const waveColors = uiConfig?.homeHero?.wave?.colors || DEFAULT_WAVE_COLORS
    const waveFps = uiConfig?.homeHero?.wave?.fps ?? 30
    const waveSeed = uiConfig?.homeHero?.wave?.seed ?? 0
    const waveSpeed = uiConfig?.homeHero?.wave?.speed ?? 1.1

    useEffect(() => {
        let active = true
        api.getUiConfig()
            .then((data) => {
                if (active) {
                    setUiConfig(data)
                }
            })
            .catch(() => {
                if (active) {
                    setUiConfig(null)
                }
            })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        try {
            gradientRef.current?.destroy()
            gradientRef.current = new WaveGradient(canvas, {
                colors: waveColors,
                fps: waveFps,
                seed: waveSeed,
                speed: waveSpeed
            })
        } catch (e) {
            console.error(e)
            return
        }

        const handleResize = () => {
            gradientRef.current?.resize()
        }

        window.addEventListener("resize", handleResize)

        return () => {
            window.removeEventListener("resize", handleResize)
            gradientRef.current?.destroy()
            gradientRef.current = null
        }
    }, [waveColors, waveFps, waveSeed, waveSpeed])

    const [rotation, setRotation] = useState(0)

    const handleClick = () => {
        setRotation(prev => prev + 360 + Math.random() * 180)
    }

    return (
        <div className="relative h-[55vh] w-full overflow-hidden rounded-[40px] bg-[#0c0c0e] mt-2 mx-auto max-w-[98%]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f0a1f] via-[#0a0f1a] to-[#0a1c1c]" />
            <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full pointer-events-none"
                aria-hidden="true"
            />

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center pointer-events-none">
                {/* Container for Logo and Ring */}
                <div
                    className="relative flex items-center justify-center pointer-events-auto cursor-pointer"
                    onClick={handleClick}
                >
                    {/* Rotating Text Ring */}
                    <motion.div
                        animate={{ rotate: rotation }}
                        transition={{ type: "spring", stiffness: 50, damping: 15 }}
                        className="absolute w-[240px] h-[240px] flex items-center justify-center"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="w-full h-full"
                        >
                            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                <path
                                    id="curve"
                                    d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
                                    fill="transparent"
                                />
                                <text
                                    className="text-[8.5px] font-bold fill-white uppercase"
                                    dy="0"
                                    textLength="232"
                                    lengthAdjust="spacing"
                                >
                                    <textPath xlinkHref="#curve" startOffset="0%">
                                        {ringText}{'\u00A0'}
                                    </textPath>
                                </text>
                            </svg>
                        </motion.div>
                    </motion.div>

                    {/* Logo Icon - Centered */}
                    <motion.div
                        animate={{ rotate: rotation }}
                        transition={{ type: "spring", stiffness: 50, damping: 15 }}
                        className="w-28 h-28 rounded-full border-4 border-white/20 shadow-2xl overflow-hidden relative z-20"
                    >
                        <img src={heroImageUrl} alt={t("home.hero.demoAlt")} className="w-full h-full object-cover" />
                    </motion.div>
                </div>
            </div>

            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none mix-blend-overlay" />
        </div>
    )
}
