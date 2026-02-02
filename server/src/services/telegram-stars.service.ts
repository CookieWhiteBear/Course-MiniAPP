export function buildStarsPayload(userId: number, courseId: number): string {
    const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    return `stars_user_${userId}_course_${courseId}_${nonce}`
}

export function parseStarsPayload(payload: string): { userId: number; courseId: number } | null {
    const match = payload.match(/^stars_user_(\d+)_course_(\d+)_/)
    if (!match) return null

    const userId = parseInt(match[1], 10)
    const courseId = parseInt(match[2], 10)

    if (!Number.isFinite(userId) || !Number.isFinite(courseId)) return null
    return { userId, courseId }
}
