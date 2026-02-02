// Telegram WebApp API integration

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp
        }
    }
}

interface TelegramWebApp {
    initData: string
    initDataUnsafe: {
        user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            photo_url?: string
            language_code?: string
        }
        auth_date: number
        hash: string
    }
    ready: () => void
    expand: () => void
    close: () => void
    MainButton: {
        text: string
        color: string
        textColor: string
        isVisible: boolean
        isActive: boolean
        show: () => void
        hide: () => void
        enable: () => void
        disable: () => void
        onClick: (_callback: () => void) => void
        offClick: (_callback: () => void) => void
    }
    BackButton: {
        isVisible: boolean
        show: () => void
        hide: () => void
        onClick: (_callback: () => void) => void
        offClick: (_callback: () => void) => void
    }
    HapticFeedback: {
        impactOccurred: (_style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
        notificationOccurred: (_type: 'error' | 'success' | 'warning') => void
        selectionChanged: () => void
    }
    openLink: (_url: string) => void
    openTelegramLink: (_url: string) => void
    showPopup: (_params: { title?: string; message: string; buttons?: Array<{ type: 'ok' | 'close' | 'cancel' | 'default' | 'destructive'; text?: string; id?: string }> }, _callback?: (_buttonId: string) => void) => void
    showAlert: (_message: string, _callback?: () => void) => void
    showConfirm: (_message: string, _callback?: (_confirmed: boolean) => void) => void
    openInvoice?: (_url: string, _callback?: (_status: 'paid' | 'failed' | 'cancelled') => void) => void
    themeParams: {
        bg_color?: string
        text_color?: string
        hint_color?: string
        link_color?: string
        button_color?: string
        button_text_color?: string
    }
}

export function getTelegram(): TelegramWebApp | null {
    return window.Telegram?.WebApp ?? null
}

export function getTelegramUser() {
    const tg = getTelegram()
    return tg?.initDataUnsafe?.user ?? null
}

export function getTelegramInitData(): string {
    const tg = getTelegram()
    return tg?.initData ?? ''
}

export function isTelegramWebApp(): boolean {
    return !!getTelegram()?.initData
}

// Initialize Telegram WebApp
export function initTelegramWebApp() {
    const tg = getTelegram()
    if (tg) {
        tg.ready()
        tg.expand()
    }
}
