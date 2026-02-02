import { useState, useEffect, useCallback } from 'react'
import { getTelegramUser, isTelegramWebApp, initTelegramWebApp } from '@/lib/telegram'
import * as api from '@/lib/api'
import type { UserProfile } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

// Initialize Telegram WebApp on load
if (typeof window !== 'undefined') {
    initTelegramWebApp()
}

// Generic fetch hook
function useApiData<T>(
    fetcher: () => Promise<T>,
    deps: unknown[] = [],
    options?: { enabled?: boolean }
) {
    const { t } = useI18n()
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const enabled = options?.enabled ?? true

    const refetch = useCallback(async () => {
        if (!enabled) return
        try {
            setLoading(true)
            setError(null)
            const result = await fetcher()
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.loadingError'))
        } finally {
            setLoading(false)
        }
    }, [t, enabled, ...deps])

    useEffect(() => {
        if (!enabled) {
            setLoading(false)
            return
        }
        refetch()
    }, [refetch, enabled])

    return { data, loading, error, refetch }
}

// ==================
// User Hooks
// ==================

export function useUser() {
    const telegramUser = getTelegramUser()
    const isInTelegram = isTelegramWebApp()
    const demoProfile = api.isDemoMode() ? api.getDemoProfile() : null

    const {
        data: bootstrap,
        loading: bootstrapLoading,
        error: bootstrapError,
        refetch: refetchBootstrap
    } = useBootstrap()

    const shouldFetchProfile = !bootstrapLoading && !bootstrap?.user
    const { data: profile, loading, error, refetch } = useApiData(
        () => api.getUserProfile(),
        [],
        { enabled: shouldFetchProfile }
    )

    // Fallback to Telegram user if API fails
    const user = profile
        || bootstrap?.user
        || demoProfile
        || (telegramUser ? {
            id: 0,
            telegramId: telegramUser.id,
            username: telegramUser.username || null,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name || null,
            photoUrl: telegramUser.photo_url || null,
            notificationsEnabled: true
        } as UserProfile : null)

    const effectiveLoading = bootstrapLoading ? true : loading
    const hasUser = Boolean(profile || bootstrap?.user || demoProfile || telegramUser)
    const effectiveError = hasUser ? null : (bootstrapError || error)

    return {
        user,
        loading: effectiveLoading,
        error: effectiveError,
        refetch: bootstrap?.user ? refetchBootstrap : refetch,
        isInTelegram
    }
}

export function useUserCourses() {
    const { data: bootstrap, loading: bootstrapLoading, error: bootstrapError, refetch: refetchBootstrap } = useBootstrap()
    const shouldFetchCourses = !bootstrapLoading && !bootstrap?.courses
    const { data, loading, error, refetch } = useApiData(
        () => api.getUserCourses(),
        [],
        { enabled: shouldFetchCourses }
    )

    return {
        data: bootstrap?.courses || data,
        loading: bootstrapLoading ? true : loading,
        error: (bootstrap?.courses || data) ? null : (bootstrapError || error),
        refetch: bootstrap?.courses ? refetchBootstrap : refetch
    }
}

export function useUserTransactions() {
    const { data: bootstrap, loading: bootstrapLoading, error: bootstrapError, refetch: refetchBootstrap } = useBootstrap()
    const shouldFetchTransactions = !bootstrapLoading && !bootstrap?.transactions
    const { data, loading, error, refetch } = useApiData(
        () => api.getUserTransactions(),
        [],
        { enabled: shouldFetchTransactions }
    )

    return {
        data: bootstrap?.transactions || data,
        loading: bootstrapLoading ? true : loading,
        error: (bootstrap?.transactions || data) ? null : (bootstrapError || error),
        refetch: bootstrap?.transactions ? refetchBootstrap : refetch
    }
}

// ==================
// Course Hooks
// ==================

export function useFeaturedCourses() {
    return useApiData(() => api.getFeaturedCourses(), [])
}

export function useBootstrap() {
    return useApiData(() => api.getBootstrap(), [])
}

export function useCourse(id: number) {
    return useApiData(() => api.getCourse(id), [id])
}

export function useCourseLessons(id: number) {
    return useApiData(() => api.getCourseLessons(id), [id])
}

export function useCourseProgress(courseId: number) {
    return useApiData(() => api.getCourseProgress(courseId), [courseId])
}
