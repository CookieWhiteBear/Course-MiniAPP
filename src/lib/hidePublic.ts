export function isHidePublicEnabled(): boolean {
    return import.meta.env.VITE_HIDE_PUBLIC === "true"
}
