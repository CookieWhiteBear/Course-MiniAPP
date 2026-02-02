import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import * as api from '@/lib/api'
import { useI18n } from '@/lib/i18n'

/**
 * Cloudflare Stream Player Component
 *
 * Enterprise-grade video player for Cloudflare Stream integration
 * Features:
 * - Signed URL authentication
 * - Adaptive bitrate streaming
 * - Analytics tracking
 * - Picture-in-Picture support
 * - Responsive design
 * - Error handling with retry
 *
 * @see https://developers.cloudflare.com/stream/
 */

interface CloudflareStreamPlayerProps {
    videoId: string
    className?: string
    autoplay?: boolean
    muted?: boolean
    loop?: boolean
    controls?: boolean
    poster?: string
    fill?: boolean
    bottomInset?: number
    onPlay?: () => void
    onPause?: () => void
    onEnded?: () => void
    onError?: (_error: Error) => void
    onTimeUpdate?: (_currentTime: number, _duration: number) => void
}

export function CloudflareStreamPlayer({
    videoId,
    className = '',
    autoplay = false,
    muted = false,
    loop = false,
    controls = true,
    poster,
    fill = false,
    bottomInset,
    onPlay,
    onPause,
    onEnded,
    onError,
    onTimeUpdate
}: CloudflareStreamPlayerProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const [streamUrl, setStreamUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [retryCount, setRetryCount] = useState(0)
    const { t } = useI18n()

    // Maximum retry attempts for fetching signed URL
    const MAX_RETRIES = 3
    const insetStyle = bottomInset
        ? { paddingBottom: `calc(${bottomInset}px + env(safe-area-inset-bottom))` }
        : undefined
    const containerClass = `${fill
        ? `relative bg-black overflow-hidden w-full h-full rounded-none${bottomInset ? ' box-border' : ''}`
        : 'relative bg-black rounded-xl overflow-hidden aspect-video'
    } ${className}`.trim()
    const iframeClass = fill && bottomInset
        ? 'w-full h-full'
        : 'absolute inset-0 w-full h-full'

    /**
     * Fetch signed URL from backend
     */
    const fetchSignedUrl = async () => {
        try {
            setLoading(true)
            setError(null)

            const response = await api.getStreamSignedUrl(videoId)

            // Use embed URL for iframe integration
            setStreamUrl(response.embedUrl)
            setLoading(false)

            // Schedule refresh before URL expires (5 minutes before expiration)
            const refreshTime = (response.expiresIn - 300) * 1000
            const refreshTimer = setTimeout(() => {
                fetchSignedUrl()
            }, refreshTime)

            return () => clearTimeout(refreshTimer)
        } catch (err) {
            console.error('[CloudflareStreamPlayer] Error fetching signed URL:', err)

            if (retryCount < MAX_RETRIES) {
                // Exponential backoff: 1s, 2s, 4s
                const backoffTime = Math.pow(2, retryCount) * 1000
                setTimeout(() => {
                    setRetryCount(prev => prev + 1)
                }, backoffTime)
            } else {
                setError(t('cloudflare.errorLoad'))
                setLoading(false)
                onError?.(err instanceof Error ? err : new Error('Unknown error'))
            }
        }
    }

    /**
     * Initialize player on mount
     */
    useEffect(() => {
        fetchSignedUrl()
    }, [videoId, retryCount, t])

    /**
     * Setup Cloudflare Stream Player API messaging
     * Allows tracking of player events through postMessage
     */
    useEffect(() => {
        if (!streamUrl || !iframeRef.current) return

        const handleMessage = (event: MessageEvent) => {
            // Verify origin is from Cloudflare Stream
            if (!event.origin.includes('cloudflarestream.com') && !event.origin.includes('videodelivery.net')) return

            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data

                switch (data.event) {
                    case 'play':
                        onPlay?.()
                        break
                    case 'pause':
                        onPause?.()
                        break
                    case 'ended':
                        onEnded?.()
                        break
                    case 'timeupdate':
                        if (data.currentTime && data.duration) {
                            onTimeUpdate?.(data.currentTime, data.duration)
                        }
                        break
                    case 'error':
                        console.error('[CloudflareStreamPlayer] Player error:', data)
                        setError(t('cloudflare.errorPlayback'))
                        onError?.(new Error(data.message || t('cloudflare.errorPlayback')))
                        break
                }
            } catch (err) {
                console.error('[CloudflareStreamPlayer] Error parsing message:', err)
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [streamUrl, onPlay, onPause, onEnded, onTimeUpdate, onError, t])

    /**
     * Retry loading video
     */
    const handleRetry = () => {
        setRetryCount(0)
        fetchSignedUrl()
    }

    /**
     * Build iframe URL with parameters
     */
    const getIframeUrl = () => {
        if (!streamUrl) return ''

        const url = new URL(streamUrl)

        if (autoplay) url.searchParams.set('autoplay', 'true')
        if (muted) url.searchParams.set('muted', 'true')
        if (loop) url.searchParams.set('loop', 'true')
        if (!controls) url.searchParams.set('controls', 'false')
        if (poster) url.searchParams.set('poster', poster)

        return url.toString()
    }

    // Loading state
    if (loading) {
        return (
            <div className={`${containerClass} flex items-center justify-center`} style={insetStyle}>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                    <p className="text-sm text-white/50">{t('cloudflare.loading')}</p>
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className={`${containerClass} flex items-center justify-center`} style={insetStyle}>
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <p className="text-sm text-white/70">{error}</p>
                    <button
                        onClick={handleRetry}
                        className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                    >
                        {t('cloudflare.retry')}
                    </button>
                </div>
            </div>
        )
    }

    // Player state
    return (
        <div className={containerClass} style={insetStyle}>
            <iframe
                ref={iframeRef}
                src={getIframeUrl()}
                className={iframeClass}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 'none' }}
                title={t('cloudflare.title', { id: videoId })}
            />
        </div>
    )
}
