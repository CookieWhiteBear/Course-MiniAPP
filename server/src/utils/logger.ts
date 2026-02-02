/**
 * Enhanced Technical Logging Utility
 * Features:
 * - Colored output by log level
 * - Timestamps
 * - Structured format with file/line info
 * - Performance timing helpers
 * - Request tracing
 */

// ANSI color codes for terminal
const colors = {
    // Log levels
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',

    // Foreground colors
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
}

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'SUCCESS' | 'HTTP' | 'DB' | 'PERF'

const levelColors: Record<LogLevel, string> = {
    INFO: colors.cyan,
    ERROR: colors.red + colors.bright,
    WARN: colors.yellow,
    DEBUG: colors.gray,
    SUCCESS: colors.green + colors.bright,
    HTTP: colors.magenta,
    DB: colors.blue,
    PERF: colors.yellow + colors.bright,
}

const levelIcons: Record<LogLevel, string> = {
    INFO: 'ℹ️ ',
    ERROR: '❌',
    WARN: '⚠️ ',
    DEBUG: '🔍',
    SUCCESS: '✅',
    HTTP: '🌐',
    DB: '💾',
    PERF: '⏱️ ',
}

// Check if running in production (disable colors if needed)
const isProduction = process.env.NODE_ENV === 'production'
const useColors = !isProduction && process.stdout.isTTY

function colorize(text: string, color: string): string {
    if (!useColors) return text
    return `${color}${text}${colors.reset}`
}

function getTimestamp(): string {
    const now = new Date()
    const time = now.toLocaleTimeString('en-GB', { hour12: false })
    const ms = now.getMilliseconds().toString().padStart(3, '0')
    return `${time}.${ms}`
}

function getCallerInfo() {
    const err = new Error()
    const stack = err.stack?.split('\n')[3] // Get the caller's stack frame
    if (!stack) return { file: 'unknown', line: '0' }

    // Extract file and line number from stack trace
    const match = stack.match(/at .+ \((.+):(\d+):\d+\)/) || stack.match(/at (.+):(\d+):\d+/)
    if (match) {
        const fullPath = match[1]
        const line = match[2]
        // Extract just the filename from the full path
        const file = fullPath.split('/').pop() || fullPath.split('\\').pop() || 'unknown'
        return { file: file.replace('.ts', '').replace('.js', ''), line }
    }
    return { file: 'unknown', line: '0' }
}

function formatLog(level: LogLevel, action: string, description: string): string {
    const { file, line } = getCallerInfo()
    const timestamp = getTimestamp()
    const icon = useColors ? levelIcons[level] : ''
    const color = levelColors[level]

    const levelStr = colorize(`[${level.padEnd(5)}]`, color)
    const timeStr = colorize(timestamp, colors.gray)
    const actionStr = colorize(`[${action}]`, colors.cyan + colors.bright)
    const locationStr = colorize(`${file}:${line}`, colors.gray)

    return `${icon} ${timeStr} ${levelStr} ${actionStr} ${locationStr} → ${description}`
}

// Performance timing store
const timers = new Map<string, number>()

export const logger = {
    info: (action: string, description: string) => {
        console.log(formatLog('INFO', action, description))
    },

    error: (action: string, description: string) => {
        console.error(formatLog('ERROR', action, description))
    },

    warn: (action: string, description: string) => {
        console.warn(formatLog('WARN', action, description))
    },

    debug: (action: string, description: string) => {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
            console.log(formatLog('DEBUG', action, description))
        }
    },

    success: (action: string, description: string) => {
        console.log(formatLog('SUCCESS', action, description))
    },

    http: (method: string, path: string, statusCode?: number, duration?: number) => {
        const statusColor = statusCode
            ? (statusCode >= 500 ? colors.red : statusCode >= 400 ? colors.yellow : colors.green)
            : colors.gray

        let desc = `${method} ${path}`
        if (statusCode) desc += ` ${colorize(statusCode.toString(), statusColor)}`
        if (duration) desc += ` ${colorize(`${duration}ms`, colors.gray)}`

        console.log(formatLog('HTTP', 'Request', desc))
    },

    db: (operation: string, description: string) => {
        console.log(formatLog('DB', operation, description))
    },

    // Performance timing helpers
    time: (label: string) => {
        timers.set(label, performance.now())
    },

    timeEnd: (label: string, action?: string) => {
        const start = timers.get(label)
        if (start) {
            const duration = (performance.now() - start).toFixed(2)
            timers.delete(label)
            console.log(formatLog('PERF', action || label, `completed in ${colorize(duration + 'ms', colors.yellow)}`))
        }
    },

    // Group logs (for complex operations)
    group: (label: string) => {
        console.group(colorize(`📂 ${label}`, colors.cyan + colors.bright))
    },

    groupEnd: () => {
        console.groupEnd()
    },

    // Table output for data
    table: (data: any[], columns?: string[]) => {
        if (columns) {
            console.table(data, columns)
        } else {
            console.table(data)
        }
    },

    // Divider for visual separation
    divider: (label?: string) => {
        const line = '─'.repeat(50)
        if (label) {
            console.log(colorize(`─────────── ${label} ${line.slice(label.length + 13)}`, colors.gray))
        } else {
            console.log(colorize(line, colors.gray))
        }
    },

    // Box for important messages
    box: (title: string, message: string) => {
        const width = Math.max(title.length, message.length) + 4
        const border = '═'.repeat(width)
        console.log('')
        console.log(colorize(`╔${border}╗`, colors.cyan))
        console.log(colorize(`║  ${title.padEnd(width - 2)}║`, colors.cyan + colors.bright))
        console.log(colorize(`╠${border}╣`, colors.cyan))
        console.log(colorize(`║  ${message.padEnd(width - 2)}║`, colors.white))
        console.log(colorize(`╚${border}╝`, colors.cyan))
        console.log('')
    }
}

// Request logger middleware
export function requestLogger() {
    return (req: any, res: any, next: any) => {
        const start = performance.now()

        res.on('finish', () => {
            const duration = Math.round(performance.now() - start)
            logger.http(req.method, req.path, res.statusCode, duration)
        })

        next()
    }
}

// Export colors for external use
export { colors }
