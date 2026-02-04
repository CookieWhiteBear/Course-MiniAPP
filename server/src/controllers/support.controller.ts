import type { Request, Response, NextFunction } from 'express'
import { query, insert } from '../config/database.js'
import { createError } from '../middleware/error.middleware.js'
import { notifyNewSupportMessage } from '../services/support-notifications.service.js'
import { config } from '../config/env.js'
import { isDemoRequest } from '../utils/demo.js'
import { isAdminTelegramId } from '../utils/admin.js'

type SenderType = 'user' | 'admin'

const DEMO_AVATAR_URL = 'https://i.imgur.com/zOlPMhT.png'
const DEMO_ADMIN_TELEGRAM_ID = -9004
const DEMO_USERS = [
    { telegramId: -9001, index: 1 },
    { telegramId: -9002, index: 2 },
    { telegramId: -9003, index: 3 }
]

interface SupportMessageRow {
    id: number
    sender_id: number
    sender_type: SenderType
    chat_user_id: number
    message: string
    is_read: number
    is_edited: number
    is_deleted: number
    created_at: string
    updated_at: string
    first_name?: string | null
    last_name?: string | null
    username?: string | null
}

interface SupportMessageResponse {
    id: number
    senderId: number
    senderType: SenderType
    senderName: string
    chatUserId: number
    message: string
    isRead: boolean
    isEdited: boolean
    createdAt: string
    updatedAt: string
}

interface SupportUserRow {
    id: number
    telegram_id: number
    first_name: string
    last_name: string | null
    username: string | null
    photo_url: string | null
    unread_count: number
    last_message_at?: string | null
    last_transaction_at?: string | null
    last_purchase_at?: string | null
    created_at?: string | null
    has_started?: number | null
}

function shouldIncludeDemo(req: Request): boolean {
    return isDemoRequest(req)
}

function isAdminRequest(req: Request): boolean {
    const demoRole = req.headers['x-demo-role'] as string | undefined
    if (isDemoRequest(req) && demoRole === 'admin') {
        return true
    }

    const telegramId = req.telegramId ?? req.user?.telegram_id
    return isAdminTelegramId(telegramId)
}

function formatUserName(row?: { first_name?: string | null; last_name?: string | null; username?: string | null }): string {
    const fullName = [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim()
    return fullName || row?.username || 'Support'
}

function mapSupportMessage(row: SupportMessageRow): SupportMessageResponse {
    const senderName = formatUserName({
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        username: row.username ?? null
    })

    return {
        id: row.id,
        senderId: row.sender_id,
        senderType: row.sender_type,
        senderName,
        chatUserId: row.chat_user_id,
        message: row.message,
        isRead: row.is_read === 1,
        isEdited: row.is_edited === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

const SUPPORT_USER_SELECT = `
    SELECT
        u.id,
        u.telegram_id,
        u.first_name,
        u.last_name,
        u.username,
        u.photo_url,
        u.has_started,
        sm.last_message_at,
        sm.unread_count,
        tx.last_transaction_at,
        uc.last_purchase_at,
        u.created_at as created_at
    FROM users u
    LEFT JOIN (
        SELECT
            chat_user_id,
            MAX(created_at) as last_message_at,
            SUM(CASE WHEN sender_type = 'user' AND is_read = 0 AND is_deleted = 0 THEN 1 ELSE 0 END) as unread_count
        FROM support_messages
        WHERE is_deleted = 0
        GROUP BY chat_user_id
    ) sm ON sm.chat_user_id = u.id
    LEFT JOIN (
        SELECT user_id, MAX(created_at) as last_transaction_at
        FROM transactions
        GROUP BY user_id
    ) tx ON tx.user_id = u.id
    LEFT JOIN (
        SELECT user_id, MAX(purchased_at) as last_purchase_at
        FROM user_courses
        GROUP BY user_id
    ) uc ON uc.user_id = u.id
`

function mapSupportUser(row: SupportUserRow) {
    const lastMessageAt = row.last_message_at
        || row.last_purchase_at
        || row.last_transaction_at
        || row.created_at
        || new Date().toISOString()

    return {
        id: row.id,
        telegramId: row.telegram_id,
        firstName: row.first_name,
        lastName: row.last_name || undefined,
        username: row.username || undefined,
        photoUrl: row.photo_url || undefined,
        unreadCount: row.unread_count || 0,
        lastMessageAt,
        hasStarted: row.has_started === 1
    }
}

async function fetchSupportMessageById(id: number): Promise<SupportMessageResponse | null> {
    const rows = await query<SupportMessageRow[]>(
        `SELECT m.*, u.first_name, u.last_name, u.username
         FROM support_messages m
         LEFT JOIN users u ON u.id = m.sender_id
         WHERE m.id = ? AND m.is_deleted = 0`,
        [id]
    )

    return rows[0] ? mapSupportMessage(rows[0]) : null
}

async function ensureSupportUserByTelegramId(telegramId: number, username?: string | null): Promise<SupportUserRow | null> {
    await query(
        `INSERT OR IGNORE INTO users (telegram_id, username, first_name, last_name, photo_url, notifications_enabled, has_started)
         VALUES (?, ?, ?, ?, ?, 1, 0)`,
        [telegramId, username || null, username || 'Unknown', null, null]
    )

    if (username) {
        await query(
            `UPDATE users
             SET username = COALESCE(username, ?), first_name = COALESCE(first_name, ?), updated_at = datetime('now')
             WHERE telegram_id = ?`,
            [username, username, telegramId]
        )
    }

    const rows = await query<SupportUserRow[]>(
        `${SUPPORT_USER_SELECT}
         WHERE u.telegram_id = ?
         LIMIT 1`,
        [telegramId]
    )

    return rows[0] || null
}

async function getAdminUserIds(): Promise<number[]> {
    if (config.adminTelegramIds.length === 0) {
        return []
    }

    const placeholders = config.adminTelegramIds.map(() => '?').join(',')
    const rows = await query<{ id: number }[]>(
        `SELECT id FROM users WHERE telegram_id IN (${placeholders})`,
        config.adminTelegramIds
    )

    return rows.map(row => row.id)
}

async function ensureDemoUser(
    telegramId: number,
    index: number
): Promise<number> {
    const firstName = 'Demo'
    const lastName = String(index)
    const username = `demo_${index}`
    await query(
        `INSERT OR IGNORE INTO users (telegram_id, username, first_name, last_name, photo_url)
         VALUES (?, ?, ?, ?, ?)`,
        [telegramId, username, firstName, lastName, DEMO_AVATAR_URL]
    )

    await query(
        `UPDATE users
         SET username = ?, first_name = ?, last_name = ?, photo_url = ?
         WHERE telegram_id = ?`,
        [username, firstName, lastName, DEMO_AVATAR_URL, telegramId]
    )

    const rows = await query<{ id: number }[]>(
        'SELECT id FROM users WHERE telegram_id = ?',
        [telegramId]
    )

    return rows[0]?.id || 0
}

async function ensureDemoSupportSeed(req: Request): Promise<void> {
    if (!isDemoRequest(req)) return

    const adminId = await ensureDemoUser(DEMO_ADMIN_TELEGRAM_ID, 4)
    const demoUserIds: number[] = []

    for (const user of DEMO_USERS) {
        const userId = await ensureDemoUser(user.telegramId, user.index)
        demoUserIds.push(userId)
    }

    const existing = await query<{ count: number }[]>(
        'SELECT COUNT(*) as count FROM support_messages'
    )

    if ((existing[0]?.count || 0) > 0) {
        if (adminId) {
            await query(
                `UPDATE support_messages
                 SET message = ?
                 WHERE sender_id = ? AND sender_type = 'admin' AND is_deleted = 0`,
                ['Demo reply', adminId]
            )
        }

        if (demoUserIds.length > 0) {
            const placeholders = demoUserIds.map(() => '?').join(',')
            await query(
                `UPDATE support_messages
                 SET message = ?
                 WHERE sender_id IN (${placeholders}) AND sender_type = 'user' AND is_deleted = 0`,
                ['Demo text', ...demoUserIds]
            )
        }
        return
    }

    for (const userId of demoUserIds) {
        const userMessageId = insert(
            `INSERT INTO support_messages (sender_id, sender_type, chat_user_id, message)
             VALUES (?, 'user', ?, ?)`,
            [userId, userId, 'Demo text']
        )

        if (userMessageId && adminId) {
            insert(
                `INSERT INTO support_messages (sender_id, sender_type, chat_user_id, message)
                 VALUES (?, 'admin', ?, ?)`,
                [adminId, userId, 'Demo reply']
            )
        }
    }
}

/**
 * GET /api/support/messages
 * User: their messages
 * Admin: all messages
 */
export async function getMessages(req: Request, res: Response, next: NextFunction) {
    try {
        await ensureDemoSupportSeed(req)
        const user = req.user!
        const isAdmin = isAdminRequest(req)
        const includeDemo = shouldIncludeDemo(req)

        const rows = isAdmin
            ? await query<SupportMessageRow[]>(
                `SELECT m.*, u.first_name, u.last_name, u.username
                 FROM support_messages m
                 LEFT JOIN users u ON u.id = m.sender_id
                 ${includeDemo ? '' : 'LEFT JOIN users cu ON cu.id = m.chat_user_id'}
                 WHERE m.is_deleted = 0
                 ${includeDemo ? '' : 'AND cu.telegram_id > 0'}
                 ORDER BY m.chat_user_id ASC, m.created_at ASC`
            )
            : await query<SupportMessageRow[]>(
                `SELECT m.*, u.first_name, u.last_name, u.username
                 FROM support_messages m
                 LEFT JOIN users u ON u.id = m.sender_id
                 WHERE m.chat_user_id = ? AND m.is_deleted = 0
                 ORDER BY m.created_at ASC`,
                [user.id]
            )

        res.json({ success: true, data: rows.map(mapSupportMessage) })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/support/messages/:userId (admin only)
 */
export async function getMessagesForUser(req: Request, res: Response, next: NextFunction) {
    try {
        await ensureDemoSupportSeed(req)
        const includeDemo = shouldIncludeDemo(req)
        const userId = Number(req.params.userId)
        if (!Number.isFinite(userId)) {
            throw createError('Invalid user id', 400)
        }

        const rows = await query<SupportMessageRow[]>(
            `SELECT m.*, u.first_name, u.last_name, u.username
             FROM support_messages m
             LEFT JOIN users u ON u.id = m.sender_id
             ${includeDemo ? '' : 'LEFT JOIN users cu ON cu.id = m.chat_user_id'}
             WHERE m.chat_user_id = ? AND m.is_deleted = 0
             ${includeDemo ? '' : 'AND cu.telegram_id > 0'}
             ORDER BY m.created_at ASC`,
            [userId]
        )

        res.json({ success: true, data: rows.map(mapSupportMessage) })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/support/messages
 */
export async function sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!
        const { message, toUserId } = req.body as { message?: string; toUserId?: number }

        if (!message || typeof message !== 'string' || !message.trim()) {
            throw createError('Message is required', 400)
        }

        const isDemo = isDemoRequest(req)
        const isAdmin = isAdminRequest(req)
        const trimmedMessage = message.trim()

        let senderType: SenderType
        let chatUserId: number

        if (isAdmin) {
            if (!toUserId || !Number.isFinite(toUserId)) {
                throw createError('Recipient user id is required', 400)
            }
            senderType = 'admin'
            chatUserId = Number(toUserId)
        } else {
            if (toUserId) {
                throw createError('Recipient user id not allowed', 400)
            }
            senderType = 'user'
            chatUserId = user.id
        }

        const storedMessage = isDemo && senderType === 'user'
            ? 'Demo text'
            : trimmedMessage

        const messageId = insert(
            `INSERT INTO support_messages (sender_id, sender_type, chat_user_id, message)
             VALUES (?, ?, ?, ?)`,
            [user.id, senderType, chatUserId, storedMessage]
        )

        const responseMessage = await fetchSupportMessageById(messageId)
        if (!responseMessage) {
            throw createError('Failed to load message', 500)
        }

        if (!isDemo) {
            // Send Telegram notification to recipient
            if (senderType === 'admin') {
                const senderName = formatUserName(user)
                void notifyNewSupportMessage(chatUserId, senderName)
            } else {
                const senderName = formatUserName(user)
                const adminUserIds = await getAdminUserIds()
                for (const adminUserId of adminUserIds) {
                    void notifyNewSupportMessage(adminUserId, senderName)
                }
            }
        } else if (senderType === 'user') {
            const adminId = await ensureDemoUser(
                DEMO_ADMIN_TELEGRAM_ID,
                4
            )
            if (adminId) {
                insert(
                    `INSERT INTO support_messages (sender_id, sender_type, chat_user_id, message)
                     VALUES (?, 'admin', ?, ?)`,
                    [adminId, chatUserId, 'Demo reply']
                )
            }
        }

        res.json({ success: true, data: responseMessage })
    } catch (error) {
        next(error)
    }
}

/**
 * PUT /api/support/messages/:id (admin only, own messages)
 */
export async function editMessage(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!
        const messageId = Number(req.params.id)
        const { message } = req.body as { message?: string }

        if (!Number.isFinite(messageId)) {
            throw createError('Invalid message id', 400)
        }
        if (!message || typeof message !== 'string' || !message.trim()) {
            throw createError('Message is required', 400)
        }

        const existing = await query<{ id: number }[]>(
            `SELECT id FROM support_messages
             WHERE id = ? AND sender_id = ? AND sender_type = 'admin' AND is_deleted = 0`,
            [messageId, user.id]
        )
        if (existing.length === 0) {
            throw createError('Message not found', 404)
        }

        await query(
            `UPDATE support_messages
             SET message = ?, is_edited = 1, updated_at = datetime('now')
             WHERE id = ?`,
            [message.trim(), messageId]
        )

        const responseMessage = await fetchSupportMessageById(messageId)
        if (!responseMessage) {
            throw createError('Failed to load message', 500)
        }

        res.json({ success: true, data: responseMessage })
    } catch (error) {
        next(error)
    }
}

/**
 * DELETE /api/support/messages/:id (admin only, own messages)
 */
export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!
        const messageId = Number(req.params.id)

        if (!Number.isFinite(messageId)) {
            throw createError('Invalid message id', 400)
        }

        const existing = await query<{ id: number }[]>(
            `SELECT id FROM support_messages
             WHERE id = ? AND sender_id = ? AND sender_type = 'admin' AND is_deleted = 0`,
            [messageId, user.id]
        )
        if (existing.length === 0) {
            throw createError('Message not found', 404)
        }

        await query(
            `UPDATE support_messages
             SET is_deleted = 1, updated_at = datetime('now')
             WHERE id = ?`,
            [messageId]
        )

        res.json({ success: true, data: null })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/support/messages/read
 */
export async function markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!
        const { messageIds, userId } = req.body as { messageIds?: number[]; userId?: number }
        const isAdmin = isAdminRequest(req)

        if (Array.isArray(messageIds) && messageIds.length > 0) {
            const ids = messageIds.filter(id => Number.isFinite(id))
            if (ids.length === 0) {
                return res.json({ success: true, data: null })
            }

            const placeholders = ids.map(() => '?').join(',')
            if (isAdmin) {
                await query(
                    `UPDATE support_messages
                     SET is_read = 1, updated_at = datetime('now')
                     WHERE id IN (${placeholders}) AND sender_type = 'user' AND is_deleted = 0`,
                    ids
                )
            } else {
                await query(
                    `UPDATE support_messages
                     SET is_read = 1, updated_at = datetime('now')
                     WHERE id IN (${placeholders})
                       AND chat_user_id = ?
                       AND sender_type = 'admin'
                       AND is_deleted = 0`,
                    [...ids, user.id]
                )
            }

            return res.json({ success: true, data: null })
        }

        if (isAdmin && userId && Number.isFinite(userId)) {
            await query(
                `UPDATE support_messages
                 SET is_read = 1, updated_at = datetime('now')
                 WHERE chat_user_id = ? AND sender_type = 'user' AND is_deleted = 0`,
                [userId]
            )
            return res.json({ success: true, data: null })
        }

        throw createError('Invalid request', 400)
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/support/unread-count
 */
export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!
        const isAdmin = isAdminRequest(req)
        const includeDemo = shouldIncludeDemo(req)

        const rows = isAdmin
            ? await query<{ count: number }[]>(
                `SELECT COUNT(*) as count
                 FROM support_messages m
                 ${includeDemo ? '' : 'LEFT JOIN users cu ON cu.id = m.chat_user_id'}
                 WHERE m.sender_type = 'user' AND m.is_read = 0 AND m.is_deleted = 0
                 ${includeDemo ? '' : 'AND cu.telegram_id > 0'}`
            )
            : await query<{ count: number }[]>(
                `SELECT COUNT(*) as count
                 FROM support_messages
                 WHERE chat_user_id = ? AND sender_type = 'admin' AND is_read = 0 AND is_deleted = 0`,
                [user.id]
            )

        res.json({ success: true, data: { count: rows[0]?.count || 0 } })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/support/users (admin only)
 */
export async function getSupportUsers(_req: Request, res: Response, next: NextFunction) {
    try {
        await ensureDemoSupportSeed(_req)
        const includeDemo = shouldIncludeDemo(_req)
        const rows = await query<SupportUserRow[]>(
            `${SUPPORT_USER_SELECT}
             WHERE (sm.chat_user_id IS NOT NULL OR tx.user_id IS NOT NULL OR uc.user_id IS NOT NULL)
             ${includeDemo ? '' : 'AND u.telegram_id > 0'}
             ORDER BY COALESCE(last_message_at, last_purchase_at, last_transaction_at, u.created_at) DESC`
        )

        res.json({
            success: true,
            data: rows.map(mapSupportUser)
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/support/users/search?q=
 * Admin search for support users (by telegram id or username)
 */
export async function searchSupportUsers(req: Request, res: Response, next: NextFunction) {
    try {
        await ensureDemoSupportSeed(req)
        const includeDemo = shouldIncludeDemo(req)
        const raw = String(req.query.q || '').trim()
        if (!raw) {
            return res.json({ success: true, data: [] })
        }

        const queryText = raw.startsWith('@') ? raw.slice(1) : raw
        const numeric = /^\d+$/.test(queryText)

        if (numeric) {
            const numberValue = Number(queryText)
            if (!includeDemo && numberValue < 0) {
                return res.json({ success: true, data: [] })
            }
            const rows = await query<SupportUserRow[]>(
                `${SUPPORT_USER_SELECT}
                 WHERE (u.telegram_id = ? OR u.id = ?)
                 ${includeDemo ? '' : 'AND u.telegram_id > 0'}
                 LIMIT 1`,
                [numberValue, numberValue]
            )

            if (rows[0]) {
                return res.json({ success: true, data: [mapSupportUser(rows[0])] })
            }

            if (queryText.length < 5) {
                return res.json({ success: true, data: [] })
            }

            const created = await ensureSupportUserByTelegramId(numberValue, null)
            if (!created) {
                return res.json({ success: true, data: [] })
            }

            return res.json({ success: true, data: [mapSupportUser(created)] })
        }

        const like = `%${queryText.toLowerCase()}%`
        const rows = await query<SupportUserRow[]>(
            `${SUPPORT_USER_SELECT}
             WHERE (
                LOWER(u.username) LIKE ?
                OR LOWER(u.first_name) LIKE ?
                OR LOWER(u.last_name) LIKE ?
             )
             ${includeDemo ? '' : 'AND u.telegram_id > 0'}
             ORDER BY COALESCE(last_message_at, last_purchase_at, last_transaction_at, u.created_at) DESC
             LIMIT 20`,
            [like, like, like]
        )

        res.json({ success: true, data: rows.map(mapSupportUser) })
    } catch (error) {
        next(error)
    }
}
