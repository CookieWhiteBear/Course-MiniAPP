import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

const BAN_WINDOW_MS = 10 * 60 * 1000
const bannedIps = new Map<string, number>()

const blockedSubstrings = [
    '/.git',
    '/.env',
    '/.ht',
    '/wp-admin',
    '/wp-login',
    '/phpmyadmin',
    '/cgi-bin',
    '/server-status',
    '/.well-known',
    '/vendor/phpunit',
    '/.svn',
    '/.hg',
    '/.bzr',
    '/composer.',
    '/package.json',
    '/package-lock.json',
    '/yarn.lock',
    '/pnpm-lock.yaml',
]

const blockedExtensions = [
    '.php',
    '.asp',
    '.aspx',
    '.jsp',
    '.cgi',
    '.bak',
    '.old',
    '.sql',
    '.zip',
    '.tar',
    '.tar.gz',
    '.tgz',
    '.rar',
    '.7z',
    '.ini',
    '.conf',
    '.log',
]

function isBanned(ip: string): boolean {
    const until = bannedIps.get(ip)
    if (!until) return false
    if (until <= Date.now()) {
        bannedIps.delete(ip)
        return false
    }
    return true
}

function ban(ip: string) {
    if (!ip) return
    bannedIps.set(ip, Date.now() + BAN_WINDOW_MS)
}

function shouldBlock(path: string): boolean {
    const lower = path.toLowerCase()
    if (lower === '/robots.txt') return false
    if (blockedSubstrings.some((part) => lower.includes(part))) return true
    return blockedExtensions.some((ext) => lower.endsWith(ext))
}

export function botShield() {
    return (req: Request, res: Response, next: NextFunction) => {
        const path = req.path || ''
        const ip = req.ip || ''

        if (isBanned(ip)) {
            return res.status(404).end()
        }

        if (path.toLowerCase() === '/robots.txt') {
            res.type('text/plain').send('User-agent: *\nDisallow: /\n')
            return
        }

        if (shouldBlock(path)) {
            ban(ip)
            logger.debug('BotBlocked', `Blocked ${req.method} ${path} from ${ip || 'unknown'}`)
            return res.status(404).end()
        }

        next()
    }
}
