import { config } from '../config/env.js'

function normalizeBaseUrl(value: string): string {
    return value.replace(/\/+$/, '')
}

function normalizePath(value?: string): string | null {
    if (!value) return null
    if (value.includes('://')) return null
    if (value.startsWith('//')) return null
    return value.startsWith('/') ? value : `/${value}`
}

export function buildWebAppUrl(path?: string): string {
    const base = normalizeBaseUrl(config.frontendUrl || '')
    if (!base) return ''
    const safePath = normalizePath(path)
    if (!config.hidePublic) {
        return safePath ? `${base}${safePath}` : base
    }
    const entry = `${base}/tg`
    if (!safePath) return entry
    return `${entry}?to=${encodeURIComponent(safePath)}`
}
