import { Request, Response } from 'express'
import { cloudflareStreamService, CloudflareStreamService } from '../services/cloudflare-stream.service.js'

/**
 * Cloudflare Stream Controller
 * Handles video streaming URLs and analytics
 */

/**
 * Generate signed URL for Cloudflare Stream video
 *
 * POST /api/stream/sign-url
 * Body: { videoId: string, userId?: string }
 *
 * Security: Requires authentication (validated via Telegram initData)
 */
export const generateSignedUrl = async (req: Request, res: Response) => {
    try {
        const { videoId, userId } = req.body

        if (!videoId) {
            return res.status(400).json({
                success: false,
                error: 'Video ID is required'
            })
        }

        // Validate video ID format
        const extractedId = CloudflareStreamService.extractVideoId(videoId)
        if (!extractedId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Cloudflare Stream video ID'
            })
        }

        // Check if service is configured
        if (!cloudflareStreamService.isConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Cloudflare Stream is not configured'
            })
        }

        // Get user ID from authenticated request (set by auth middleware)
        const authenticatedUserId = (req as any).userId || userId

        // Generate signed URL (1 hour expiration)
        const signedUrl = await cloudflareStreamService.generateSignedUrl(extractedId, {
            expiresIn: 3600, // 1 hour
            downloadable: false, // Prevent downloads for content protection
            userId: authenticatedUserId
        })

        // Also get embed URL for iframe usage (include token if video is protected)
        let token: string | null = null
        try {
            const signedUrlObject = new URL(signedUrl)
            token = signedUrlObject.searchParams.get('token')
        } catch {
            token = null
        }

        const embedUrl = cloudflareStreamService.getEmbedUrl(extractedId, {
            controls: true,
            preload: 'metadata',
            autoplay: false,
            ...(token ? { token } : {})
        })

        return res.json({
            success: true,
            data: {
                videoId: extractedId,
                signedUrl,
                embedUrl,
                expiresIn: 3600
            }
        })
    } catch (error) {
        console.error('[CloudflareStream] Error generating signed URL:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to generate signed URL'
        })
    }
}

/**
 * Get video metadata from Cloudflare Stream
 *
 * GET /api/stream/metadata/:videoId
 */
export const getVideoMetadata = async (req: Request, res: Response) => {
    try {
        const videoId = req.params.videoId as string

        if (!videoId) {
            return res.status(400).json({
                success: false,
                error: 'Video ID is required'
            })
        }

        const metadata = await cloudflareStreamService.getVideoMetadata(videoId)

        if (!metadata) {
            return res.status(404).json({
                success: false,
                error: 'Video not found or failed to fetch metadata'
            })
        }

        return res.json({
            success: true,
            data: metadata
        })
    } catch (error) {
        console.error('[CloudflareStream] Error fetching metadata:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch video metadata'
        })
    }
}

/**
 * Get video analytics from Cloudflare Stream
 *
 * GET /api/stream/analytics/:videoId
 * Query params: since, until (ISO date strings)
 */
export const getVideoAnalytics = async (req: Request, res: Response) => {
    try {
        const videoId = req.params.videoId as string
        const { since, until } = req.query

        if (!videoId) {
            return res.status(400).json({
                success: false,
                error: 'Video ID is required'
            })
        }

        const options: any = {
            metrics: ['views', 'timeViewed', 'completionRate']
        }

        if (since) {
            options.since = new Date(since as string)
        }

        if (until) {
            options.until = new Date(until as string)
        }

        const analytics = await cloudflareStreamService.getVideoAnalytics(videoId, options)

        if (!analytics) {
            return res.status(404).json({
                success: false,
                error: 'Analytics not found or failed to fetch'
            })
        }

        return res.json({
            success: true,
            data: analytics
        })
    } catch (error) {
        console.error('[CloudflareStream] Error fetching analytics:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch video analytics'
        })
    }
}

/**
 * Validate video ID format
 *
 * GET /api/stream/validate/:videoId
 * Utility endpoint for debugging
 */
export const validateVideoId = (req: Request, res: Response) => {
    try {
        const videoId = req.params.videoId as string

        const extractedId = CloudflareStreamService.extractVideoId(videoId)
        const isValid = Boolean(extractedId)

        return res.json({
            success: true,
            data: {
                input: videoId,
                isValid,
                extractedId: extractedId || null
            }
        })
    } catch (error) {
        console.error('[CloudflareStream] Error validating video ID:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to validate video ID'
        })
    }
}
