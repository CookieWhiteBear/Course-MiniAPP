// API Client for backend
import { getTelegramInitData } from './telegram'
import { getDemoHeaders, getDemoProfile, getDemoRole, getDemoAvatarUrl, isDemoMode, setDemoRole } from './demo'

const API_BASE = '/api'
const GET_CACHE_TTL_MS = 2000
const inFlightRequests = new Map<string, Promise<unknown>>()
const responseCache = new Map<string, { expiresAt: number; data: unknown }>()

function buildRequestKey(
    endpoint: string,
    method: string,
    authKey: string,
    body?: RequestInit['body']
) {
    const bodyKey = typeof body === 'string' ? body : ''
    return `${method}:${endpoint}:${authKey}:${bodyKey}`
}

const DEMO_STORAGE_PREFIX = 'cg_demo_'
const DEMO_KEYS = {
    settings: `${DEMO_STORAGE_PREFIX}settings`,
    courseState: `${DEMO_STORAGE_PREFIX}course_state`,
    progress: `${DEMO_STORAGE_PREFIX}progress`,
    lessonTotals: `${DEMO_STORAGE_PREFIX}lesson_totals`,
    transactions: `${DEMO_STORAGE_PREFIX}transactions`,
    supportMessages: `${DEMO_STORAGE_PREFIX}support_messages`,
    quizAttempts: `${DEMO_STORAGE_PREFIX}quiz_attempts`,
    reviews: `${DEMO_STORAGE_PREFIX}reviews`
} as const

// Generic API response wrapper
export interface ApiResponse<T> {
    success: boolean
    data: T
    error?: string
}

// Types matching backend
export interface Course {
    id: number
    title: string
    author: string
    authorAvatar?: string
    price: string
    starsPrice?: number
    rating: number
    category: string
    image: string
    description?: string
    lessonsCount?: number
    duration?: string
    program?: string[]
}

export interface UiConfig {
    homeHero?: {
        imageUrl?: string
        wave?: {
            colors?: string[]
            fps?: number
            seed?: number
            speed?: number
        }
    } | null
}

export interface CourseWithReviews extends Course {
    reviews: Review[]
}

export interface ReviewReply {
    text: string
    author: string
    isEdited?: boolean
    createdAt?: string | null
    updatedAt?: string | null
}

export interface Review {
    id: number
    user: string
    date: string
    rating: number
    text: string
    isEdited?: boolean
    likes?: number
    dislikes?: number
    myReaction?: number
    reply?: ReviewReply
}

export interface LessonStep {
    id: number
    title: string
    content: string
    type: 'text' | 'image' | 'video' | 'quiz' | 'completion'
    image?: string | null
    video?: string | null
    quiz?: QuizData | null
}

export interface UserCourse extends Course {
    variant: 'my-course'
    progress: number
    isFavorite: boolean
}

export interface UserProfile {
    id: number
    telegramId: number
    username: string | null
    firstName: string
    lastName: string | null
    photoUrl: string | null
    notificationsEnabled: boolean
}

export interface Transaction {
    id: number
    title: string
    date: string
    amount: string
    status: 'success' | 'failed'
    type: 'purchase' | 'subscription' | 'refund' | 'error'
}

export interface BootstrapData {
    user: UserProfile
    courses: UserCourse[]
    transactions: Transaction[]
    unreadCount: number
    isAdmin: boolean
}

export interface QuizAnswer {
    id: number
    text: string
    isCorrect?: boolean
}

export interface QuizQuestion {
    id: number
    question: string
    type: 'single' | 'multiple' | 'text'
    answers: QuizAnswer[]
    explanation?: string | null
    hint?: string | null
    points: number
    timeLimit?: number | null
}

export interface QuizSettings {
    passingScore: number
    maxAttempts: number
    shuffleQuestions: boolean
    shuffleAnswers: boolean
    showExplanations: boolean
    requirePass: boolean
}

export interface QuizAttempt {
    id: number
    score: number
    maxScore: number
    percentage: number
    passed: boolean
    attemptNumber: number
    timeSpent: number | null
    createdAt: string
    answersData?: unknown
}

export interface QuizData {
    questions: QuizQuestion[]
    settings: QuizSettings
    userAttempts?: QuizAttempt[]
    canAttempt: boolean
    bestScore?: number
}

export interface RemedialContent {
    id: number
    title: string
    content: string
    contentType: 'text' | 'video' | 'article' | 'practice'
    mediaUrl?: string | null
}

type DemoCourseState = {
    purchasedIds: number[]
    favoriteIds: number[]
    purchasedAtByCourse: Record<string, string>
}

type DemoProgressState = Record<string, number[]>

type DemoLessonTotals = Record<string, number>

type DemoUserSettings = {
    notificationsEnabled: boolean
}

type DemoQuizAttempts = Record<string, QuizAttempt[]>

type DemoReview = {
    id: number
    courseId: number
    rating: number
    comment: string
    createdAt: string
    isEdited: boolean
    likes?: number
    dislikes?: number
    myReaction?: number
    reply?: ReviewReply
}

function canUseDemoStorage(): boolean {
    return isDemoMode() && typeof window !== 'undefined'
}

function readDemoStorage<T>(key: string, fallback: T): T {
    if (!canUseDemoStorage()) return fallback
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return fallback
        return JSON.parse(raw) as T
    } catch {
        return fallback
    }
}

function writeDemoStorage(key: string, value: unknown): void {
    if (!canUseDemoStorage()) return
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // ignore storage failures
    }
}

function getDemoSettings(): DemoUserSettings {
    return readDemoStorage<DemoUserSettings>(DEMO_KEYS.settings, { notificationsEnabled: true })
}

function setDemoSettings(next: Partial<DemoUserSettings>): DemoUserSettings {
    const merged = { ...getDemoSettings(), ...next }
    writeDemoStorage(DEMO_KEYS.settings, merged)
    return merged
}

function getDemoCourseState(): DemoCourseState {
    return readDemoStorage<DemoCourseState>(DEMO_KEYS.courseState, {
        purchasedIds: [],
        favoriteIds: [],
        purchasedAtByCourse: {}
    })
}

function setDemoCourseState(state: DemoCourseState): void {
    writeDemoStorage(DEMO_KEYS.courseState, state)
}

function getDemoProgressState(): DemoProgressState {
    return readDemoStorage<DemoProgressState>(DEMO_KEYS.progress, {})
}

function setDemoProgressState(state: DemoProgressState): void {
    writeDemoStorage(DEMO_KEYS.progress, state)
}

function getDemoLessonTotals(): DemoLessonTotals {
    return readDemoStorage<DemoLessonTotals>(DEMO_KEYS.lessonTotals, {})
}

function setDemoLessonTotal(courseId: number, total: number): void {
    if (!Number.isFinite(total)) return
    const totals = getDemoLessonTotals()
    totals[String(courseId)] = total
    writeDemoStorage(DEMO_KEYS.lessonTotals, totals)
}

function getDemoTransactions(): Transaction[] {
    return readDemoStorage<Transaction[]>(DEMO_KEYS.transactions, [])
}

function setDemoTransactions(items: Transaction[]): void {
    writeDemoStorage(DEMO_KEYS.transactions, items)
}

function getDemoQuizAttempts(): DemoQuizAttempts {
    return readDemoStorage<DemoQuizAttempts>(DEMO_KEYS.quizAttempts, {})
}

function setDemoQuizAttempts(data: DemoQuizAttempts): void {
    writeDemoStorage(DEMO_KEYS.quizAttempts, data)
}

function getDemoUserProfile(): UserProfile {
    const base = getDemoProfile()
    const settings = getDemoSettings()
    return {
        ...base,
        notificationsEnabled: settings.notificationsEnabled
    }
}

function getDemoSupportUserId(): number {
    const telegramId = getDemoProfile().telegramId
    return Math.abs(telegramId) || 1
}

function getDemoSupportUser(): SupportUser {
    const profile = getDemoProfile()
    const demoId = getDemoSupportUserId()
    return {
        id: demoId,
        telegramId: profile.telegramId,
        firstName: profile.firstName,
        lastName: profile.lastName || undefined,
        username: profile.username || undefined,
        photoUrl: profile.photoUrl || undefined,
        unreadCount: 0,
        lastMessageAt: new Date().toISOString()
    }
}

function getDemoSupportMessages(): SupportMessage[] {
    const stored = readDemoStorage<SupportMessage[]>(DEMO_KEYS.supportMessages, [])
    if (stored.length > 0) return stored

    const demoUser = getDemoSupportUser()
    const now = new Date().toISOString()
    const seeded: SupportMessage[] = [
        {
            id: 1,
            senderId: demoUser.id,
            senderType: 'user',
            senderName: `${demoUser.firstName} ${demoUser.lastName || ''}`.trim() || demoUser.username || 'Demo User',
            chatUserId: demoUser.id,
            message: 'Demo text',
            isRead: true,
            isEdited: false,
            createdAt: now,
            updatedAt: now
        },
        {
            id: 2,
            senderId: -1,
            senderType: 'admin',
            senderName: 'Support',
            chatUserId: demoUser.id,
            message: 'Demo reply',
            isRead: false,
            isEdited: false,
            createdAt: now,
            updatedAt: now
        }
    ]

    writeDemoStorage(DEMO_KEYS.supportMessages, seeded)
    return seeded
}

function setDemoSupportMessages(messages: SupportMessage[]): void {
    writeDemoStorage(DEMO_KEYS.supportMessages, messages)
}

function getDemoReviews(): DemoReview[] {
    return readDemoStorage<DemoReview[]>(DEMO_KEYS.reviews, [])
}

function setDemoReviews(reviews: DemoReview[]): void {
    writeDemoStorage(DEMO_KEYS.reviews, reviews)
}

function getDemoReviewForCourse(courseId: number): DemoReview | null {
    const reviews = getDemoReviews()
    return reviews.find(review => review.courseId === courseId) ?? null
}

function toDemoReviewResponse(review: DemoReview): Review {
    const profile = getDemoProfile()
    const userLabel = profile.username || profile.firstName || 'Demo User'
    const reply = review.reply
        ? {
            text: review.reply.text,
            author: review.reply.author || 'Admin',
            isEdited: review.reply.isEdited,
            createdAt: review.reply.createdAt ?? null,
            updatedAt: review.reply.updatedAt ?? null
        }
        : undefined
    return {
        id: review.id,
        user: userLabel,
        date: formatDateLabel(new Date(review.createdAt)),
        rating: review.rating,
        text: review.comment,
        isEdited: review.isEdited,
        likes: review.likes ?? 0,
        dislikes: review.dislikes ?? 0,
        myReaction: review.myReaction ?? 0,
        reply
    }
}

function nextDemoMessageId(messages: SupportMessage[]): number {
    return messages.reduce((maxId, msg) => Math.max(maxId, msg.id), 0) + 1
}

function buildDemoSupportUsers(messages: SupportMessage[]): SupportUser[] {
    const demoUser = getDemoSupportUser()
    const userMessages = messages.filter(msg => msg.chatUserId === demoUser.id)
    const lastMessageAt = userMessages.length > 0
        ? userMessages[userMessages.length - 1]?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    const unreadCount = userMessages.filter(msg => msg.senderType === 'user' && !msg.isRead).length

    return [{
        ...demoUser,
        unreadCount,
        lastMessageAt
    }]
}

function parsePrice(value: string | number | undefined): number {
    if (typeof value === 'number') return value
    if (!value) return 0
    const cleaned = value.replace(/[^\d.]/g, '')
    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
}

function formatDateLabel(date = new Date()): string {
    return date.toLocaleDateString('en-US')
}

async function addDemoPurchase(courseId: number): Promise<{ price: number; amountLabel: string }> {
    const state = getDemoCourseState()
    if (!state.purchasedIds.includes(courseId)) {
        state.purchasedIds.push(courseId)
    }
    if (!state.purchasedAtByCourse[String(courseId)]) {
        state.purchasedAtByCourse[String(courseId)] = new Date().toISOString()
    }
    setDemoCourseState(state)

    const course = await getCourse(courseId)
    const amountLabel = course.price
    const price = parsePrice(course.price)

    const transactions = getDemoTransactions()
    transactions.unshift({
        id: Date.now(),
        title: course.title,
        date: formatDateLabel(),
        amount: amountLabel,
        status: 'success',
        type: 'purchase'
    })
    setDemoTransactions(transactions)

    return { price, amountLabel }
}

async function buildDemoAdminOverview(): Promise<AdminUserOverview> {
    const demoProfile = getDemoProfile()
    const demoUserId = getDemoSupportUserId()
    const state = getDemoCourseState()
    const totals = getDemoLessonTotals()
    const progressState = getDemoProgressState()
    const courses = await getFeaturedCourses()

    const purchasedSet = new Set(state.purchasedIds)
    const favoriteSet = new Set(state.favoriteIds)

    const purchasedCourses = courses
        .filter(course => purchasedSet.has(course.id))
        .map((course) => {
            const completedLessonIds = progressState[String(course.id)] || []
            const total = totals[String(course.id)] ?? course.lessonsCount ?? completedLessonIds.length
            const completed = completedLessonIds.length
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0
            return {
                id: course.id,
                title: course.title,
                author: course.author,
                price: course.price,
                category: course.category,
                image: course.image,
                lessonsCount: course.lessonsCount ?? total,
                progress,
                isFavorite: favoriteSet.has(course.id),
                purchasedAt: state.purchasedAtByCourse[String(course.id)] || new Date().toISOString()
            }
        })

    const availableCourses = courses
        .filter(course => !purchasedSet.has(course.id))
        .map(course => ({ id: course.id, title: course.title }))

    return {
        user: {
            id: demoUserId,
            telegramId: demoProfile.telegramId,
            username: demoProfile.username,
            firstName: demoProfile.firstName,
            lastName: demoProfile.lastName || undefined,
            photoUrl: demoProfile.photoUrl || undefined
        },
        courses: purchasedCourses,
        transactions: getDemoTransactions(),
        availableCourses
    }
}

// API request helper
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const initData = getTelegramInitData()
    const method = (options.method || 'GET').toUpperCase()
    const authKey = isDemoMode()
        ? `demo:${getDemoHeaders()['X-Demo-User'] || ''}`
        : `tg:${initData || ''}`
    const requestKey = buildRequestKey(endpoint, method, authKey, options.body)

    if (method === 'GET') {
        const cached = responseCache.get(requestKey)
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data as T
        }
    }

    const existing = inFlightRequests.get(requestKey)
    if (existing) {
        return existing as Promise<T>
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(isDemoMode() ? getDemoHeaders() : (initData && { 'X-Telegram-Init-Data': initData })),
        ...options.headers
    }

    const requestPromise = (async () => {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }))
            const errorMessage = typeof error.error === 'string'
                ? error.error
                : error.error?.message || error.message || `HTTP ${response.status}`
            throw new Error(errorMessage)
        }

        const result = await response.json()
        if (method === 'GET') {
            responseCache.set(requestKey, {
                expiresAt: Date.now() + GET_CACHE_TTL_MS,
                data: result.data
            })
        }
        return result.data as T
    })()

    inFlightRequests.set(requestKey, requestPromise)
    try {
        return await requestPromise
    } finally {
        inFlightRequests.delete(requestKey)
    }
}

// ==================
// Courses API
// ==================

export async function getFeaturedCourses(): Promise<Course[]> {
    return apiRequest<Course[]>('/courses/featured')
}

export async function getBootstrap(): Promise<BootstrapData> {
    return apiRequest<BootstrapData>('/bootstrap')
}

export async function getUiConfig(): Promise<UiConfig> {
    return apiRequest<UiConfig>('/config/ui')
}

export async function getCourse(id: number): Promise<CourseWithReviews> {
    const course = await apiRequest<CourseWithReviews>(`/courses/${id}`)
    if (isDemoMode()) {
        const demoReview = getDemoReviewForCourse(id)
        if (demoReview) {
            const review = toDemoReviewResponse(demoReview)
            const filtered = course.reviews.filter(r => r.id !== review.id && r.user !== review.user)
            return { ...course, reviews: [review, ...filtered] }
        }
    }
    return course
}

export async function getCourseLessons(id: number): Promise<LessonStep[]> {
    const lessons = await apiRequest<LessonStep[]>(`/courses/${id}/lessons`)
    if (isDemoMode()) {
        setDemoLessonTotal(id, lessons.length)
    }
    return lessons
}

// ==================
// User API
// ==================

export async function getUserProfile(): Promise<UserProfile> {
    if (isDemoMode()) {
        return getDemoUserProfile()
    }
    return apiRequest<UserProfile>('/user/profile')
}

export async function updateUserSettings(settings: { notificationsEnabled?: boolean }): Promise<void> {
    if (isDemoMode()) {
        setDemoSettings(settings)
        return
    }
    await apiRequest('/user/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
    })
}

export async function getUserCourses(): Promise<UserCourse[]> {
    if (isDemoMode()) {
        const courseState = getDemoCourseState()
        const purchasedSet = new Set(courseState.purchasedIds)
        if (purchasedSet.size === 0) return []

        const favorites = new Set(courseState.favoriteIds)
        const totals = getDemoLessonTotals()
        const progressState = getDemoProgressState()
        const courses = await getFeaturedCourses()

        return courses
            .filter(course => purchasedSet.has(course.id))
            .map((course) => {
                const completedLessonIds = progressState[String(course.id)] || []
                const total = totals[String(course.id)] ?? course.lessonsCount ?? completedLessonIds.length
                const completed = completedLessonIds.length
                const progress = total > 0 ? Math.round((completed / total) * 100) : 0
                return {
                    ...course,
                    variant: 'my-course',
                    progress,
                    isFavorite: favorites.has(course.id)
                }
            })
    }
    return apiRequest<UserCourse[]>('/user/courses')
}

export async function toggleCourseFavorite(courseId: number): Promise<{ isFavorite: boolean }> {
    if (isDemoMode()) {
        const state = getDemoCourseState()
        const favorites = new Set(state.favoriteIds)
        if (favorites.has(courseId)) {
            favorites.delete(courseId)
        } else {
            favorites.add(courseId)
        }
        state.favoriteIds = Array.from(favorites)
        setDemoCourseState(state)
        return { isFavorite: favorites.has(courseId) }
    }
    return apiRequest<{ isFavorite: boolean }>(`/user/courses/${courseId}/favorite`, {
        method: 'PUT'
    })
}

export async function getUserTransactions(page = 1): Promise<Transaction[]> {
    if (isDemoMode()) {
        return getDemoTransactions()
    }
    return apiRequest<Transaction[]>(`/user/transactions?page=${page}`)
}

// ==================
// Progress API
// ==================

export async function markLessonComplete(courseId: number, lessonId: number): Promise<{
    completed: number
    total: number
    progress: number
}> {
    if (isDemoMode()) {
        const progressState = getDemoProgressState()
        const key = String(courseId)
        const completedLessonIds = new Set(progressState[key] || [])
        completedLessonIds.add(lessonId)
        progressState[key] = Array.from(completedLessonIds)
        setDemoProgressState(progressState)

        const totals = getDemoLessonTotals()
        const total = totals[key] ?? completedLessonIds.size
        const completed = completedLessonIds.size
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0
        return { completed, total, progress }
    }
    return apiRequest(`/progress/${courseId}/lesson/${lessonId}`, {
        method: 'POST'
    })
}

export async function getCourseProgress(courseId: number): Promise<{
    completedLessonIds: number[]
    completed: number
    total: number
    progress: number
}> {
    if (isDemoMode()) {
        const progressState = getDemoProgressState()
        const key = String(courseId)
        const completedLessonIds = progressState[key] || []
        const totals = getDemoLessonTotals()
        const total = totals[key] ?? completedLessonIds.length
        const completed = completedLessonIds.length
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0
        return { completedLessonIds, completed, total, progress }
    }
    return apiRequest(`/progress/${courseId}`)
}

// ==================
// Reviews API
// ==================

export async function submitReview(courseId: number, rating: number, comment?: string): Promise<void> {
    if (isDemoMode()) {
        const existing = getDemoReviewForCourse(courseId)
        const now = new Date().toISOString()
        if (existing) {
            const updated: DemoReview = {
                ...existing,
                rating,
                comment: comment || '',
                isEdited: true
            }
            const reviews = getDemoReviews().map(review => review.courseId === courseId ? updated : review)
            setDemoReviews(reviews)
        } else {
            const reviews = getDemoReviews()
            reviews.unshift({
                id: Date.now(),
                courseId,
                rating,
                comment: comment || '',
                createdAt: now,
                isEdited: false,
                likes: 0,
                dislikes: 0,
                myReaction: 0,
                reply: undefined
            })
            setDemoReviews(reviews)
        }
        return
    }
    await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({ courseId, rating, comment })
    })
}

export async function reactReview(
    reviewId: number,
    value: -1 | 0 | 1
): Promise<{ likes: number; dislikes: number; myReaction: number }> {
    if (isDemoMode()) {
        const reviews = getDemoReviews()
        const index = reviews.findIndex(review => review.id === reviewId)
        if (index < 0) {
            throw new Error('Review not found')
        }
        const review = reviews[index]
        const current = review.myReaction ?? 0
        let likes = review.likes ?? 0
        let dislikes = review.dislikes ?? 0

        if (current === 1) likes = Math.max(0, likes - 1)
        if (current === -1) dislikes = Math.max(0, dislikes - 1)

        if (value === 1) likes += 1
        if (value === -1) dislikes += 1

        const updated: DemoReview = {
            ...review,
            likes,
            dislikes,
            myReaction: value
        }
        reviews[index] = updated
        setDemoReviews(reviews)
        return { likes, dislikes, myReaction: value }
    }

    return apiRequest<{ likes: number; dislikes: number; myReaction: number }>(`/reviews/${reviewId}/reaction`, {
        method: 'POST',
        body: JSON.stringify({ value })
    })
}

export async function replyToReview(reviewId: number, message: string): Promise<ReviewReply | null> {
    const trimmed = message.trim()
    if (!trimmed) {
        throw new Error('Reply cannot be empty')
    }

    if (isDemoMode()) {
        const reviews = getDemoReviews()
        const index = reviews.findIndex(review => review.id === reviewId)
        if (index < 0) {
            throw new Error('Review not found')
        }
        const review = reviews[index]
        const now = new Date().toISOString()
        const hadReply = Boolean(review.reply?.text)
        const reply: ReviewReply = {
            text: trimmed,
            author: review.reply?.author || 'Admin',
            isEdited: hadReply,
            createdAt: review.reply?.createdAt ?? now,
            updatedAt: now
        }
        reviews[index] = {
            ...review,
            reply
        }
        setDemoReviews(reviews)
        return reply
    }

    return apiRequest<ReviewReply | null>(`/reviews/${reviewId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: trimmed })
    })
}

// ==================
// Purchase API
// ==================

export async function createPurchaseLink(courseId: number): Promise<{ approveUrl: string; price: number }> {
    if (isDemoMode()) {
        const { price } = await addDemoPurchase(courseId)
        return { approveUrl: '', price }
    }
    return apiRequest('/purchase/create', {
        method: 'POST',
        body: JSON.stringify({ courseId })
    })
}

export async function createStarsInvoiceLink(courseId: number): Promise<{ invoiceLink: string }> {
    if (isDemoMode()) {
        await addDemoPurchase(courseId)
        return { invoiceLink: '' }
    }
    return apiRequest('/purchase/telegram-stars', {
        method: 'POST',
        body: JSON.stringify({ courseId })
    })
}

// ==================
// Quiz API
// ==================

export async function submitQuizAttempt(
    courseId: number,
    lessonId: number,
    answers: Record<number, number | number[] | string>,
    timeSpent?: number
): Promise<QuizAttempt> {
    if (isDemoMode()) {
        const attempts = getDemoQuizAttempts()
        const key = `${courseId}_${lessonId}`
        const existing = attempts[key] || []
        const questionCount = Object.keys(answers).length
        const maxScore = questionCount || 1
        const score = maxScore
        const attemptNumber = existing.length + 1
        const attempt: QuizAttempt = {
            id: Date.now(),
            score,
            maxScore,
            percentage: 100,
            passed: true,
            attemptNumber,
            timeSpent: timeSpent ?? null,
            createdAt: new Date().toISOString(),
            answersData: null
        }
        existing.push(attempt)
        attempts[key] = existing
        setDemoQuizAttempts(attempts)
        return attempt
    }
    // Use dynamic endpoint for filesystem-based courses
    return apiRequest<QuizAttempt>(`/dynamic/quiz/${courseId}/${lessonId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers, timeSpent })
    })
}

export async function getRemedialContent(courseId: number, lessonId: number): Promise<RemedialContent[]> {
    // Use dynamic endpoint for filesystem-based courses
    return apiRequest<RemedialContent[]>(`/dynamic/quiz/${courseId}/${lessonId}/remedial`)
}

// ==================
// Cloudflare Stream API
// ==================

export interface CloudflareStreamSignedUrl {
    videoId: string
    signedUrl: string
    embedUrl: string
    expiresIn: number
}

/**
 * Generate signed URL for Cloudflare Stream video
 * Required for secure video playback
 */
export async function getStreamSignedUrl(videoId: string, userId?: string): Promise<CloudflareStreamSignedUrl> {
    return apiRequest<CloudflareStreamSignedUrl>('/stream/sign-url', {
        method: 'POST',
        body: JSON.stringify({ videoId, userId })
    })
}

// ==================
// Support / Tickets API
// ==================

export interface SupportMessage {
    id: number
    senderId: number
    senderType: 'user' | 'admin'
    senderName: string
    chatUserId: number
    message: string
    isRead: boolean
    isEdited: boolean
    createdAt: string
    updatedAt: string
}

export interface SupportUser {
    id: number
    telegramId: number
    firstName: string
    lastName?: string
    username?: string
    photoUrl?: string
    unreadCount: number
    lastMessageAt: string
    hasStarted?: boolean
}

export interface AdminCourseSummary {
    id: number
    title: string
    author: string
    price: string
    category: string
    image: string
    lessonsCount: number
    progress: number
    isFavorite: boolean
    purchasedAt: string
}

export interface AdminAvailableCourse {
    id: number
    title: string
}

export interface AdminUser {
    id: number
    telegramId: number
    username: string | null
    firstName: string
    lastName?: string | null
    photoUrl?: string | null
}

export interface AdminUserOverview {
    user: AdminUser
    courses: AdminCourseSummary[]
    transactions: Transaction[]
    availableCourses: AdminAvailableCourse[]
}

export interface AdminMetricsRange {
    users: number
    orders: number
    revenue: number
    activeUsers: number
}

export interface AdminMetricsResponse {
    ranges: {
        '24h': AdminMetricsRange
        '7d': AdminMetricsRange
        'all': AdminMetricsRange
    }
}

export interface AdminPagination {
    page: number
    limit: number
    total: number
}

export interface AdminUserListItem {
    id: number
    telegramId: number
    username: string | null
    firstName: string
    lastName?: string | null
    photoUrl?: string | null
    createdAt: string
    updatedAt: string
    hasStarted: boolean
    isBlockedForReviews: boolean
    coursesCount: number
    ordersCount: number
}

export interface AdminUserListResponse {
    items: AdminUserListItem[]
    pagination: AdminPagination
}

export interface AdminTransactionItem {
    id: number
    userId: number
    telegramId: number
    username: string | null
    firstName: string
    lastName: string | null
    courseId: number | null
    courseTitle: string | null
    paymentId: string | null
    amount: number
    currency: string
    status: string
    type: string
    createdAt: string
}

export interface AdminTransactionResponse {
    items: AdminTransactionItem[]
    pagination: AdminPagination
}

export interface AdminReviewItem {
    id: number
    courseId: number
    courseTitle: string
    userId: number
    telegramId: number
    username: string | null
    firstName: string
    lastName: string | null
    rating: number
    comment: string
    isEdited: boolean
    createdAt: string
    updatedAt: string
    reply: {
        text: string
        author: string
        isEdited: boolean
        createdAt: string | null
        updatedAt: string | null
    } | null
}

export interface AdminReviewResponse {
    items: AdminReviewItem[]
    pagination: AdminPagination
}

export interface AdminCourseInfo {
    id: number
    title: string
    authorId?: string
    category?: string
    price?: number
    starsPrice?: number
    currency?: string
    visibility?: string
    imageUrl?: string
    studentsCount: number
    avgRating: number
    reviewsCount: number
    revenue: number
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        search.set(key, String(value))
    })
    const query = search.toString()
    return query ? `?${query}` : ''
}

export async function getSupportMessages(userId?: number): Promise<SupportMessage[]> {
    if (isDemoMode()) {
        const isAdmin = getDemoRole() === 'admin'
        const messages = getDemoSupportMessages()
        const targetId = isAdmin ? (userId ?? getDemoSupportUserId()) : getDemoSupportUserId()
        return messages.filter(msg => msg.chatUserId === targetId)
    }
    const url = userId ? `/support/messages/${userId}` : '/support/messages'
    return apiRequest<SupportMessage[]>(url)
}

export async function sendSupportMessage(message: string, toUserId?: number): Promise<SupportMessage> {
    if (isDemoMode()) {
        const isAdmin = getDemoRole() === 'admin'
        const demoUser = getDemoSupportUser()
        const messages = getDemoSupportMessages()
        const now = new Date().toISOString()
        const chatUserId = isAdmin ? (toUserId ?? demoUser.id) : demoUser.id
        const senderType: SupportMessage['senderType'] = isAdmin ? 'admin' : 'user'
        const senderId = isAdmin ? -1 : demoUser.id
        const senderName = isAdmin
            ? 'Support'
            : `${demoUser.firstName} ${demoUser.lastName || ''}`.trim() || demoUser.username || 'Demo User'

        const newMessage: SupportMessage = {
            id: nextDemoMessageId(messages),
            senderId,
            senderType,
            senderName,
            chatUserId,
            message: message.trim(),
            isRead: true,
            isEdited: false,
            createdAt: now,
            updatedAt: now
        }
        messages.push(newMessage)

        if (!isAdmin) {
            messages.push({
                id: nextDemoMessageId(messages),
                senderId: -1,
                senderType: 'admin',
                senderName: 'Support',
                chatUserId,
                message: 'Demo reply',
                isRead: false,
                isEdited: false,
                createdAt: now,
                updatedAt: now
            })
        }

        setDemoSupportMessages(messages)
        return newMessage
    }
    return apiRequest<SupportMessage>('/support/messages', {
        method: 'POST',
        body: JSON.stringify({ message, toUserId })
    })
}

export async function editSupportMessage(id: number, message: string): Promise<SupportMessage> {
    if (isDemoMode()) {
        const messages = getDemoSupportMessages()
        const now = new Date().toISOString()
        const updated = messages.map(msg => msg.id === id ? {
            ...msg,
            message,
            isEdited: true,
            updatedAt: now
        } : msg)
        setDemoSupportMessages(updated)
        const found = updated.find(msg => msg.id === id)
        if (!found) {
            throw new Error('Message not found')
        }
        return found
    }
    return apiRequest<SupportMessage>(`/support/messages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ message })
    })
}

export async function deleteSupportMessage(id: number): Promise<void> {
    if (isDemoMode()) {
        const messages = getDemoSupportMessages()
        setDemoSupportMessages(messages.filter(msg => msg.id !== id))
        return
    }
    await apiRequest(`/support/messages/${id}`, { method: 'DELETE' })
}

export async function markMessagesAsRead(messageIds: number[], userId?: number): Promise<void> {
    if (isDemoMode()) {
        const idSet = new Set(messageIds)
        const messages = getDemoSupportMessages().map(msg => idSet.has(msg.id) ? { ...msg, isRead: true } : msg)
        setDemoSupportMessages(messages)
        return
    }
    await apiRequest('/support/messages/read', {
        method: 'POST',
        body: JSON.stringify({ messageIds, userId })
    })
}

export async function getSupportUnreadCount(): Promise<{ count: number }> {
    if (isDemoMode()) {
        const isAdmin = getDemoRole() === 'admin'
        const messages = getDemoSupportMessages()
        if (isAdmin) {
            return { count: messages.filter(msg => msg.senderType === 'user' && !msg.isRead).length }
        }
        const demoUserId = getDemoSupportUserId()
        return {
            count: messages.filter(msg => msg.senderType === 'admin' && msg.chatUserId === demoUserId && !msg.isRead).length
        }
    }
    return apiRequest<{ count: number }>('/support/unread-count')
}

export async function getSupportUsers(): Promise<SupportUser[]> {
    if (isDemoMode()) {
        const isAdmin = getDemoRole() === 'admin'
        if (!isAdmin) return []
        const messages = getDemoSupportMessages()
        return buildDemoSupportUsers(messages)
    }
    return apiRequest<SupportUser[]>('/support/users')
}

export async function searchSupportUsers(query: string): Promise<SupportUser[]> {
    if (isDemoMode()) {
        const isAdmin = getDemoRole() === 'admin'
        if (!isAdmin) return []
        const messages = getDemoSupportMessages()
        const users = buildDemoSupportUsers(messages)
        const normalized = query.trim().toLowerCase().replace(/^@/, '')
        if (!normalized) return users
        return users.filter(user => {
            const fullName = `${user.firstName} ${user.lastName || ''}`.toLowerCase()
            const username = (user.username || '').toLowerCase()
            const telegramId = String(user.telegramId)
            return fullName.includes(normalized)
                || username.includes(normalized)
                || telegramId.includes(normalized)
        })
    }
    return apiRequest<SupportUser[]>(`/support/users/search?q=${encodeURIComponent(query)}`)
}

export async function getMyReview(courseId: number): Promise<Review | null> {
    if (isDemoMode()) {
        const demoReview = getDemoReviewForCourse(courseId)
        return demoReview ? toDemoReviewResponse(demoReview) : null
    }
    return apiRequest<Review | null>(`/reviews/${courseId}/me`)
}

export async function deleteReview(reviewId: number): Promise<void> {
    if (isDemoMode()) {
        const reviews = getDemoReviews().filter(review => review.id !== reviewId)
        setDemoReviews(reviews)
        return
    }
    await apiRequest(`/reviews/${reviewId}`, { method: 'DELETE' })
}

export function isAdmin(telegramId?: number | null): boolean {
    if (isDemoMode()) {
        return getDemoRole() === 'admin'
    }

    const envIds = (import.meta.env.VITE_ADMIN_TELEGRAM_IDS || '')
        .split(',')
        .map((id: string) => parseInt(id.trim(), 10))
        .filter((id: number) => Number.isFinite(id))

    if (envIds.length > 0) {
        return telegramId ? envIds.includes(telegramId) : false
    }

    return false
}

export { isDemoMode, getDemoRole, setDemoRole, getDemoProfile, getDemoAvatarUrl }

// ==================
// Admin tools
// ==================

export async function getAdminUserOverview(userId: number): Promise<AdminUserOverview> {
    if (isDemoMode()) {
        return buildDemoAdminOverview()
    }
    return apiRequest<AdminUserOverview>(`/admin/users/${userId}/overview`)
}

export async function grantCourseToUser(userId: number, courseId: number): Promise<void> {
    if (isDemoMode()) {
        const state = getDemoCourseState()
        if (!state.purchasedIds.includes(courseId)) {
            state.purchasedIds.push(courseId)
            state.purchasedAtByCourse[String(courseId)] = new Date().toISOString()
            setDemoCourseState(state)
        }
        return
    }
    await apiRequest(`/admin/users/${userId}/courses/${courseId}`, { method: 'POST' })
}

export async function revokeCourseFromUser(userId: number, courseId: number): Promise<void> {
    if (isDemoMode()) {
        const state = getDemoCourseState()
        state.purchasedIds = state.purchasedIds.filter(id => id !== courseId)
        delete state.purchasedAtByCourse[String(courseId)]
        setDemoCourseState(state)
        return
    }
    await apiRequest(`/admin/users/${userId}/courses/${courseId}`, { method: 'DELETE' })
}

export async function getAdminMetrics(range?: '24h' | '7d' | 'all'): Promise<AdminMetricsResponse> {
    return apiRequest<AdminMetricsResponse>(`/admin/metrics${buildQuery({ range })}`)
}

export async function listAdminUsers(params: {
    q?: string
    page?: number
    limit?: number
    blocked?: boolean
    includeDemo?: boolean
} = {}): Promise<AdminUserListResponse> {
    return apiRequest<AdminUserListResponse>(`/admin/users${buildQuery(params)}`)
}

export async function updateAdminUser(
    userId: number,
    payload: { firstName?: string; lastName?: string | null; username?: string | null; blockReviews?: boolean }
): Promise<void> {
    await apiRequest(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    })
}

export async function listAdminTransactions(params: {
    q?: string
    status?: string
    from?: string
    to?: string
    page?: number
    limit?: number
    userId?: number
    courseId?: number
} = {}): Promise<AdminTransactionResponse> {
    return apiRequest<AdminTransactionResponse>(`/admin/transactions${buildQuery(params)}`)
}

export async function listAdminReviews(params: {
    q?: string
    rating?: number
    courseId?: number
    from?: string
    to?: string
    page?: number
    limit?: number
    includeDemo?: boolean
} = {}): Promise<AdminReviewResponse> {
    return apiRequest<AdminReviewResponse>(`/admin/reviews${buildQuery(params)}`)
}

export async function listAdminCourses(): Promise<AdminCourseInfo[]> {
    return apiRequest<AdminCourseInfo[]>(`/admin/courses`)
}
