import type { Request, Response, NextFunction } from 'express'
import { loadAppConfig } from '../config/app-config.js'

/**
 * GET /api/config/ui
 * Public UI configuration (safe subset)
 */
export async function getUiConfig(req: Request, res: Response, next: NextFunction) {
    try {
        const config = await loadAppConfig()
        res.json({
            success: true,
            data: {
                homeHero: config.ui?.homeHero || null
            }
        })
    } catch (error) {
        next(error)
    }
}
