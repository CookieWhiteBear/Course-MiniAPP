import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import YAML from "yaml"
import { getTelegramUser } from "@/lib/telegram"

type Dictionary = Record<string, unknown>

type LanguageMeta = {
    code: string
    name: string
    flag: string
}

type I18nContextValue = {
    language: string
    languages: LanguageMeta[]
    setLanguage: (_code: string) => void
    t: (_key: string, _vars?: Record<string, string | number>) => string
    isReady: boolean
}

const localeModules = import.meta.glob("../locales/*.{yml,yaml}", { as: "raw" })

const fallbackLanguage = "en"
const storageKey = "language"

const localeLoaders = Object.fromEntries(
    Object.entries(localeModules)
        .map(([path, loader]) => {
            const match = path.match(/\/([^/]+)\.ya?ml$/i)
            if (!match) return null
            return [match[1].toLowerCase(), loader as () => Promise<string>]
        })
        .filter(Boolean) as Array<[string, () => Promise<string>]>
)

const availableLanguages = Object.keys(localeLoaders)

function normalizeLanguage(code: string) {
    return code.trim().toLowerCase()
}

function matchLanguage(code?: string | null) {
    if (!code) return null
    const normalized = normalizeLanguage(code)
    if (availableLanguages.includes(normalized)) return normalized
    const base = normalized.split("-")[0]
    if (availableLanguages.includes(base)) return base
    return null
}

function resolveInitialLanguage() {
    if (typeof window === "undefined") return fallbackLanguage

    const stored = window.localStorage.getItem(storageKey)
    const storedMatch = matchLanguage(stored)
    if (storedMatch) return storedMatch

    const tgLang = getTelegramUser()?.language_code
    const tgMatch = matchLanguage(tgLang)
    if (tgMatch) return tgMatch

    const browserMatch = matchLanguage(window.navigator.language)
    if (browserMatch) return browserMatch

    return fallbackLanguage
}

function getNestedValue(dictionary: Dictionary, key: string): unknown {
    return key.split(".").reduce((acc, part) => {
        if (acc && typeof acc === "object" && part in acc) {
            return (acc as Record<string, unknown>)[part]
        }
        return undefined
    }, dictionary as unknown)
}

function interpolate(value: string, vars?: Record<string, string | number>) {
    if (!vars) return value
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const replacement = vars[key]
        return replacement === undefined ? `{{${key}}}` : String(replacement)
    })
}

async function loadLocale(code: string): Promise<{ dictionary: Dictionary; meta: LanguageMeta }> {
    const loader = localeLoaders[code] || localeLoaders[fallbackLanguage]
    if (!loader) {
        return {
            dictionary: {},
            meta: {
                code,
                name: code.toUpperCase(),
                flag: "???"
            }
        }
    }

    const raw = await loader()
    const parsed = (YAML.parse(raw) || {}) as Dictionary
    const metaRaw = parsed.meta as Partial<LanguageMeta> | undefined

    const dictionary = { ...parsed }
    delete dictionary.meta

    return {
        dictionary,
        meta: {
            code,
            name: metaRaw?.name || code.toUpperCase(),
            flag: metaRaw?.flag || "???"
        }
    }
}

async function loadAllLanguageMeta(): Promise<LanguageMeta[]> {
    const entries = await Promise.all(
        Object.keys(localeLoaders).map(async (code) => {
            const { meta } = await loadLocale(code)
            return meta
        })
    )

    return entries.sort((a, b) => a.code.localeCompare(b.code))
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState(() => resolveInitialLanguage())
    const [dictionary, setDictionary] = useState<Dictionary>({})
    const [languages, setLanguages] = useState<LanguageMeta[]>([])
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        const initial = resolveInitialLanguage()
        setLanguageState(initial)
    }, [])

    useEffect(() => {
        let active = true
        loadAllLanguageMeta()
            .then((data) => {
                if (active) setLanguages(data)
            })
            .catch(() => {
                if (active) setLanguages([])
            })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        let active = true
        setIsReady(false)
        loadLocale(language)
            .then(({ dictionary: nextDictionary }) => {
                if (active) {
                    setDictionary(nextDictionary)
                    setIsReady(true)
                }
            })
            .catch(() => {
                if (active) {
                    setDictionary({})
                    setIsReady(true)
                }
            })

        if (typeof document !== "undefined") {
            document.documentElement.lang = language
        }

        return () => {
            active = false
        }
    }, [language])

    const setLanguage = useCallback((code: string) => {
        const matched = matchLanguage(code) || fallbackLanguage
        setLanguageState(matched)
        if (typeof window !== "undefined") {
            window.localStorage.setItem(storageKey, matched)
        }
    }, [])

    const t = useCallback(
        (key: string, vars?: Record<string, string | number>) => {
            const value = getNestedValue(dictionary, key)
            if (typeof value !== "string") return key
            return interpolate(value, vars)
        },
        [dictionary]
    )

    const value = useMemo(() => ({
        language,
        languages,
        setLanguage,
        t,
        isReady
    }), [language, languages, setLanguage, t, isReady])

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
    const context = useContext(I18nContext)
    if (!context) {
        throw new Error("useI18n must be used within LanguageProvider")
    }
    return context
}
