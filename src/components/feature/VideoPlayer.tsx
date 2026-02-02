import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { Loader2, Play, Pause, Volume2, VolumeX, Maximize, Settings } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useI18n } from '@/lib/i18n'

interface VideoPlayerProps {
    videoUrl: string
    nextVideoUrl?: string
    lessonId: number
    userId?: number
    onTimeUpdate?: (_currentTime: number) => void
    onEnded?: () => void
    className?: string
    fill?: boolean
    controlsInsetBottom?: number
}

export function VideoPlayer({
    videoUrl,
    nextVideoUrl,
    userId,
    onTimeUpdate,
    onEnded,
    className,
    fill = false,
    controlsInsetBottom
}: VideoPlayerProps) {
    const { t } = useI18n()
    const videoRef = useRef<HTMLVideoElement>(null)
    const nextVideoRef = useRef<HTMLVideoElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const nextHlsRef = useRef<Hls | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [muted, setMuted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [quality, setQuality] = useState<number>(-1) // -1 = auto
    const [showControls, setShowControls] = useState(true)
    const [buffered, setBuffered] = useState(0)
    const [qualityLevels, setQualityLevels] = useState<Array<{ height: number }>>([])

    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    // Steganographic encoding function
    const encodeUserId = (id: number): string => {
        return id.toString(2).padStart(32, '0')
    }

    // Initialize main video player
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const isHLS = videoUrl.includes('.m3u8')

        if (isHLS && Hls.isSupported()) {
            // HLS streaming
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                startLevel: quality,
                autoStartLoad: true,
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 10
            })

            hls.loadSource(videoUrl)
            hls.attachMedia(video)

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setLoading(false)
                setError(null)
                setQualityLevels(hls.levels.map((level) => ({ height: level.height })))
            })

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    setError(t('video.loadingError'))
                    setLoading(false)

                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            // Try to recover
                            hls.startLoad()
                            break
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError()
                            break
                        default:
                            hls.destroy()
                            break
                    }
                }
            })

            hlsRef.current = hls

            return () => {
                hls.destroy()
                setQualityLevels([])
            }
        } else if (isHLS && video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = videoUrl
            video.addEventListener('loadedmetadata', () => {
                setLoading(false)
                setError(null)
            })
            setQualityLevels([])
        } else {
            // Regular video
            video.src = videoUrl
            video.addEventListener('loadedmetadata', () => {
                setLoading(false)
                setError(null)
            })
            setQualityLevels([])
        }
    }, [videoUrl, quality, t])

    // Prefetch next video (Netflix-style)
    useEffect(() => {
        if (!nextVideoUrl || !nextVideoRef.current) return

        const nextVideo = nextVideoRef.current
        const isHLS = nextVideoUrl.includes('.m3u8')

        if (isHLS && Hls.isSupported()) {
            const nextHls = new Hls({
                maxBufferLength: 10, // Smaller buffer for prefetch
                autoStartLoad: false, // Don't start loading immediately
                startLevel: quality
            })

            nextHls.loadSource(nextVideoUrl)
            nextHls.attachMedia(nextVideo)
            nextHlsRef.current = nextHls

            // Start prefetching when current video is at 70%
            const handleTimeUpdate = () => {
                const video = videoRef.current
                if (!video) return

                if (video.currentTime / video.duration > 0.7) {
                    nextHls.startLoad()
                }
            }

            videoRef.current?.addEventListener('timeupdate', handleTimeUpdate)

            return () => {
                nextHls.destroy()
                videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate)
            }
        }
    }, [nextVideoUrl, quality])

    // Watermarking for security
    useEffect(() => {
        if (!userId || !canvasRef.current || !videoRef.current) return

        const canvas = canvasRef.current
        const video = videoRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let animationId: number

        const drawFrame = () => {
            if (video.paused || video.ended) return

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Add forensic watermark (almost invisible)
            const timestamp = new Date().toISOString()
            ctx.font = '10px Arial'
            ctx.fillStyle = 'rgba(255, 255, 255, 0.015)' // Almost invisible
            ctx.fillText(`UID: ${userId} | ${timestamp}`, 10, 20)

            // Add steganographic watermark (encoded pixels)
            const encoded = encodeUserId(userId)
            for (let i = 0; i < encoded.length && i < 100; i++) {
                const x = (i * 37) % canvas.width
                const y = (i * 53) % canvas.height
                ctx.fillStyle = encoded[i] === '1' ? '#000001' : '#000000'
                ctx.fillRect(x, y, 1, 1)
            }

            animationId = requestAnimationFrame(drawFrame)
        }

        video.addEventListener('play', drawFrame)

        return () => {
            video.removeEventListener('play', drawFrame)
            cancelAnimationFrame(animationId)
        }
    }, [userId])

    // Video event handlers
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime)
            onTimeUpdate?.(video.currentTime)

            // Update buffered
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1)
                setBuffered((bufferedEnd / video.duration) * 100)
            }
        }

        const handleDurationChange = () => {
            setDuration(video.duration)
        }

        const handlePlay = () => {
            setPlaying(true)
            setLoading(false)
        }

        const handlePause = () => {
            setPlaying(false)
        }

        const handleEnded = () => {
            setPlaying(false)
            onEnded?.()
        }

        const handleWaiting = () => {
            setLoading(true)
        }

        const handleCanPlay = () => {
            setLoading(false)
        }

        video.addEventListener('timeupdate', handleTimeUpdate)
        video.addEventListener('durationchange', handleDurationChange)
        video.addEventListener('play', handlePlay)
        video.addEventListener('pause', handlePause)
        video.addEventListener('ended', handleEnded)
        video.addEventListener('waiting', handleWaiting)
        video.addEventListener('canplay', handleCanPlay)

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate)
            video.removeEventListener('durationchange', handleDurationChange)
            video.removeEventListener('play', handlePlay)
            video.removeEventListener('pause', handlePause)
            video.removeEventListener('ended', handleEnded)
            video.removeEventListener('waiting', handleWaiting)
            video.removeEventListener('canplay', handleCanPlay)
        }
    }, [onTimeUpdate, onEnded])

    // Controls auto-hide
    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current)
        }
        setShowControls(true)
        controlsTimeoutRef.current = setTimeout(() => {
            if (playing) setShowControls(false)
        }, 3000)
    }, [playing])

    useEffect(() => {
        resetControlsTimeout()
    }, [playing, resetControlsTimeout])

    // Playback controls
    const togglePlay = () => {
        const video = videoRef.current
        if (!video) return

        if (playing) {
            video.pause()
        } else {
            video.play()
        }
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return

        const time = parseFloat(e.target.value)
        video.currentTime = time
        setCurrentTime(time)
    }

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return

        const vol = parseFloat(e.target.value)
        video.volume = vol
        setVolume(vol)
        setMuted(vol === 0)
    }

    const toggleMute = () => {
        const video = videoRef.current
        if (!video) return

        video.muted = !muted
        setMuted(!muted)
    }

    const toggleFullscreen = () => {
        const container = canvasRef.current?.parentElement
        if (!container) return

        if (!document.fullscreenElement) {
            container.requestFullscreen()
        } else {
            document.exitFullscreen()
        }
    }

    const changeQuality = (level: number) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = level
            setQuality(level)
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (error) {
        return (
            <div
                className={cn(
                    'w-full bg-black flex items-center justify-center',
                    fill ? 'h-full' : 'aspect-video rounded-lg'
                )}
            >
                <p className="text-red-400">{error}</p>
            </div>
        )
    }

    return (
        <div
            className={cn('relative group', fill && 'w-full h-full', className)}
            onMouseMove={resetControlsTimeout}
            onTouchStart={resetControlsTimeout}
        >
            {/* Hidden native video (for HLS processing) */}
            <video
                ref={videoRef}
                className="hidden"
                playsInline
                preload="metadata"
            />

            {/* Prefetch video (hidden) */}
            <video
                ref={nextVideoRef}
                className="hidden"
                playsInline
                preload="none"
            />

            {/* Canvas for watermarked display */}
            <canvas
                ref={canvasRef}
                width={1920}
                height={1080}
                className={cn(
                    'w-full bg-black',
                    fill ? 'h-full object-cover rounded-none' : 'aspect-video rounded-lg'
                )}
                onClick={togglePlay}
            />

            {/* Loading spinner */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="w-12 h-12 animate-spin text-white" />
                </div>
            )}

            {/* Play/Pause overlay */}
            {!playing && !loading && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                    onClick={togglePlay}
                >
                    <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center">
                        <Play className="w-10 h-10 text-black ml-1" />
                    </div>
                </div>
            )}

            {/* Controls */}
            <div
                className={cn(
                    'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300',
                    showControls || !playing ? 'opacity-100' : 'opacity-0'
                )}
                style={controlsInsetBottom
                    ? { bottom: `calc(${controlsInsetBottom}px + env(safe-area-inset-bottom))` }
                    : undefined
                }
            >
                {/* Progress bar */}
                <div className="relative w-full h-1 bg-white/20 rounded-full mb-3 group/progress">
                    {/* Buffered */}
                    <div
                        className="absolute h-full bg-white/30 rounded-full"
                        style={{ width: `${buffered}%` }}
                    />
                    {/* Progress */}
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer group-hover/progress:opacity-100"
                    />
                    <div
                        className="absolute h-full bg-purple-500 rounded-full pointer-events-none"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                </div>

                <div className="flex items-center justify-between gap-4">
                    {/* Left controls */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={togglePlay}
                            className="text-white hover:text-purple-400 transition-colors"
                        >
                            {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                        </button>

                        <div className="flex items-center gap-2 group/volume">
                            <button
                                onClick={toggleMute}
                                className="text-white hover:text-purple-400 transition-colors"
                            >
                                {muted || volume === 0 ? (
                                    <VolumeX className="w-5 h-5" />
                                ) : (
                                    <Volume2 className="w-5 h-5" />
                                )}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={muted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-0 group-hover/volume:w-20 transition-all"
                            />
                        </div>

                        <span className="text-white text-sm">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-3">
                        {qualityLevels.length > 1 && (
                            <div className="relative group/quality">
                                <button className="text-white hover:text-purple-400 transition-colors">
                                    <Settings className="w-5 h-5" />
                                </button>
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg p-2 opacity-0 group-hover/quality:opacity-100 transition-opacity pointer-events-none group-hover/quality:pointer-events-auto">
                                    <div className="text-white text-xs mb-2">{t('video.quality')}</div>
                                    {qualityLevels.map((level, index) => (
                                        <button
                                            key={index}
                                            onClick={() => changeQuality(index)}
                                            className={cn(
                                                'block w-full text-left px-3 py-1 text-sm rounded hover:bg-white/10',
                                                quality === index ? 'text-purple-400' : 'text-white'
                                            )}
                                        >
                                            {level.height}p
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => changeQuality(-1)}
                                        className={cn(
                                            'block w-full text-left px-3 py-1 text-sm rounded hover:bg-white/10',
                                            quality === -1 ? 'text-purple-400' : 'text-white'
                                        )}
                                    >
                                        {t('video.auto')}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={toggleFullscreen}
                            className="text-white hover:text-purple-400 transition-colors"
                        >
                            <Maximize className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
