import { isTelegramWebApp } from "./telegram"
import { isHidePublicEnabled } from "./hidePublic"

const DEMO_USER_KEY = "demo_user_id"
const DEMO_ROLE_KEY = "demo_role"
const DEMO_AVATAR_URL = "https://i.imgur.com/zOlPMhT.png"

type DemoRole = "admin" | "user"

export function isDemoMode(): boolean {
    if (isHidePublicEnabled()) return false
    if (import.meta.env.VITE_DEMO_MODE === "true") return true
    if (typeof window === "undefined") return false
    return !isTelegramWebApp()
}

function hashDemoId(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i)
        hash |= 0
    }
    return hash
}

function getDemoUserId(): string {
    if (typeof window === "undefined") {
        return "demo"
    }

    const existing = window.localStorage.getItem(DEMO_USER_KEY)
    if (existing) return existing

    const generated = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `demo-${Math.random().toString(36).slice(2, 10)}`

    window.localStorage.setItem(DEMO_USER_KEY, generated)
    return generated
}

export function getDemoRole(): DemoRole {
    if (!isDemoMode() || typeof window === "undefined") {
        return "user"
    }

    // If VITE_DEMO_ADMIN_FOR_ALL is set, everyone is admin by default
    if (import.meta.env.VITE_DEMO_ADMIN_FOR_ALL === "true") {
        return "admin"
    }

    const stored = window.localStorage.getItem(DEMO_ROLE_KEY)
    return stored === "admin" ? "admin" : "user"
}

export function setDemoRole(role: DemoRole): void {
    if (!isDemoMode() || typeof window === "undefined") return
    window.localStorage.setItem(DEMO_ROLE_KEY, role)
    window.dispatchEvent(new CustomEvent("demo-role-change", { detail: role }))
}

export function getDemoHeaders(): Record<string, string> {
    if (!isDemoMode()) return {}

    return {
        "X-Demo-User": getDemoUserId(),
        "X-Demo-Role": getDemoRole()
    }
}

function getDemoIndex(): number {
    const base = Math.abs(hashDemoId(getDemoUserId()))
    return (base % 9) + 1
}

export function getDemoAvatarUrl(): string {
    return DEMO_AVATAR_URL
}

export function getDemoProfile() {
    const index = getDemoIndex()
    return {
        id: 0,
        telegramId: -index,
        username: `demo_${index}`,
        firstName: "Demo",
        lastName: String(index),
        photoUrl: DEMO_AVATAR_URL,
        notificationsEnabled: true
    }
}
