import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import { fileURLToPath } from 'url'
import { config } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(__dirname, '../locales')

type Dictionary = Record<string, unknown>

const supportedLanguages = ['en', 'ru', 'uk']
const loadedLocales: Record<string, Dictionary> = {}

function loadLocale(lang: string): Dictionary {
    if (loadedLocales[lang]) {
        return loadedLocales[lang]
    }

    const filePath = path.join(localesDir, `bot.${lang}.yml`)

    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8')
            const parsed = YAML.parse(content) as Dictionary
            loadedLocales[lang] = parsed
            return parsed
        }
    } catch (error) {
        console.warn(`[bot-i18n] Failed to load locale ${lang}:`, error)
    }

    return {}
}

function getDefaultLanguage(): string {
    const configLang = config.defaultLanguage
    if (configLang && supportedLanguages.includes(configLang)) {
        return configLang
    }
    return 'en'
}

function normalizeLanguage(code?: string | null): string {
    if (!code) return getDefaultLanguage()
    const normalized = code.trim().toLowerCase()
    if (supportedLanguages.includes(normalized)) return normalized
    const base = normalized.split('-')[0]
    if (supportedLanguages.includes(base)) return base
    return getDefaultLanguage()
}

function getNestedValue(dictionary: Dictionary, key: string): unknown {
    return key.split('.').reduce((acc, part) => {
        if (acc && typeof acc === 'object' && part in acc) {
            return (acc as Record<string, unknown>)[part]
        }
        return undefined
    }, dictionary as unknown)
}

function interpolate(value: string, vars?: Record<string, string | number>): string {
    if (!vars) return value
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const replacement = vars[key]
        return replacement === undefined ? `{{${key}}}` : String(replacement)
    })
}

export function botT(
    languageCode: string | undefined | null,
    key: string,
    vars?: Record<string, string | number>
): string {
    const lang = normalizeLanguage(languageCode)
    const dictionary = loadLocale(lang)
    const value = getNestedValue(dictionary, key)

    if (typeof value === 'string') {
        return interpolate(value.trim(), vars)
    }

    // Fallback to default language
    const fallbackLang = getDefaultLanguage()
    if (lang !== fallbackLang) {
        const fallbackDict = loadLocale(fallbackLang)
        const fallbackValue = getNestedValue(fallbackDict, key)
        if (typeof fallbackValue === 'string') {
            return interpolate(fallbackValue.trim(), vars)
        }
    }

    // Last resort: return key
    return key
}

// Preload all locales on startup
for (const lang of supportedLanguages) {
    loadLocale(lang)
}
