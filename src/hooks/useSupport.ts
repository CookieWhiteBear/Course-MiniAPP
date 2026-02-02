import { useState, useEffect, useCallback } from 'react'
import { useBootstrap, useUser } from './useApi'
import * as api from '@/lib/api'

export function useSupport() {
    const { user } = useUser()
    const { data: bootstrap } = useBootstrap()
    const [messages, setMessages] = useState<api.SupportMessage[]>([])
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<api.SupportUser[]>([])
    const [usersLoading, setUsersLoading] = useState(true)
    const [unreadCount, setUnreadCount] = useState(0)
    const demoMode = api.isDemoMode()
    const [demoRoleVersion, setDemoRoleVersion] = useState(0)
    const [isAdmin, setIsAdmin] = useState(() => api.isAdmin(user?.telegramId))

    useEffect(() => {
        setIsAdmin(api.isAdmin(user?.telegramId))
    }, [user?.telegramId, demoRoleVersion])

    useEffect(() => {
        if (!demoMode || typeof window === 'undefined') return
        const handler = () => setDemoRoleVersion(prev => prev + 1)
        window.addEventListener('demo-role-change', handler as EventListener)
        return () => window.removeEventListener('demo-role-change', handler as EventListener)
    }, [demoMode])

    const loadMessages = useCallback(async (userId?: number, options?: { silent?: boolean }) => {
        if (!options?.silent) {
            setLoading(true)
        }
        try {
            const data = await api.getSupportMessages(userId)
            setMessages(data)
        } finally {
            if (!options?.silent) {
                setLoading(false)
            }
        }
    }, [])

    const loadUsers = useCallback(async (options?: { silent?: boolean }) => {
        if (demoMode && !api.isAdmin(user?.telegramId)) {
            if (!options?.silent) {
                setUsers([])
                setUsersLoading(false)
            }
            return false
        }
        if (!options?.silent) {
            setUsersLoading(true)
        }
        try {
            const data = await api.getSupportUsers()
            setUsers(data)
            if (!demoMode) {
                setIsAdmin(true)
            }
            return true
        } catch {
            if (!options?.silent) {
                setUsers([])
                if (!demoMode) {
                    setIsAdmin(false)
                }
            }
            return false
        } finally {
            if (!options?.silent) {
                setUsersLoading(false)
            }
        }
    }, [demoMode, user?.telegramId])

    const loadUnreadCount = useCallback(async () => {
        try {
            const { count } = await api.getSupportUnreadCount()
            setUnreadCount(count)
        } catch {
            // ignore
        }
    }, [])

    const sendMessage = useCallback(async (text: string, toUserId?: number) => {
        const newMsg = await api.sendSupportMessage(text, toUserId)
        setMessages(prev => [...prev, newMsg])
    }, [])

    const editMessage = useCallback(async (id: number, text: string) => {
        const updated = await api.editSupportMessage(id, text)
        setMessages(prev => prev.map(msg => msg.id === id ? updated : msg))
    }, [])

    const deleteMessage = useCallback(async (id: number) => {
        await api.deleteSupportMessage(id)
        setMessages(prev => prev.filter(msg => msg.id !== id))
    }, [])

    const markAsRead = useCallback(async (messageIds: number[], userId?: number) => {
        if (messageIds.length === 0) return
        await api.markMessagesAsRead(messageIds, userId)
        const idSet = new Set(messageIds)
        setMessages(prev => prev.map(msg => idSet.has(msg.id) ? { ...msg, isRead: true } : msg))
        loadUnreadCount()
    }, [loadUnreadCount])

    useEffect(() => {
        if (bootstrap?.unreadCount !== undefined) {
            setUnreadCount(bootstrap.unreadCount)
            return
        }
        loadUnreadCount()
    }, [loadUnreadCount, bootstrap?.unreadCount])

    return {
        isAdmin,
        messages,
        loading,
        users,
        usersLoading,
        unreadCount,
        loadMessages,
        loadUsers,
        sendMessage,
        editMessage,
        deleteMessage,
        markAsRead,
        refreshUnreadCount: loadUnreadCount
    }
}
