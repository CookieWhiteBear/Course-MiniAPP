import { useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CloudflareStreamPlayer } from '@/components/feature/CloudflareStreamPlayer'

/**
 * Hook to process Cloudflare Stream custom tags in HTML content
 * Replaces <cloudflare-stream data-video-id="xxx"></cloudflare-stream> tags
 * with React CloudflareStreamPlayer components
 *
 * Usage:
 * const contentRef = useCloudflareStream(htmlContent)
 * <div ref={contentRef} dangerouslySetInnerHTML={{ __html: htmlContent }} />
 */
export function useCloudflareStream(htmlContent: string) {
    const containerRef = useRef<HTMLDivElement>(null)
    const rootsRef = useRef<Map<HTMLElement, Root>>(new Map())

    useEffect(() => {
        if (!containerRef.current) return

        // Small delay to ensure DOM is ready
        const timeoutId = setTimeout(() => {
            if (!containerRef.current) return

            // Find all Cloudflare Stream placeholder tags
            const streamElements = containerRef.current.querySelectorAll('cloudflare-stream')
            const isVideoOnly = containerRef.current.dataset.videoOnly === 'true'

            streamElements.forEach((element) => {
                const videoId = element.getAttribute('data-video-id')
                if (!videoId) return

                // Create wrapper div
                const wrapper = document.createElement('div')
                wrapper.className = isVideoOnly
                    ? 'cloudflare-stream-wrapper w-full h-full'
                    : 'cloudflare-stream-wrapper my-4'

                // Replace the custom tag with wrapper
                element.parentNode?.replaceChild(wrapper, element)

                // Create React root and render player
                const root = createRoot(wrapper)
                root.render(
                    <CloudflareStreamPlayer
                        videoId={videoId}
                        controls={true}
                        autoplay={false}
                        fill={isVideoOnly}
                    />
                )

                // Store root for cleanup
                rootsRef.current.set(wrapper, root)
            })
        }, 10) // Small delay to ensure DOM is fully rendered

        // Cleanup function
        return () => {
            clearTimeout(timeoutId)
            rootsRef.current.forEach((root) => {
                try {
                    root.unmount()
                } catch {
                    // Ignore unmount errors
                }
            })
            rootsRef.current.clear()
        }
    }, [htmlContent])

    return containerRef
}
