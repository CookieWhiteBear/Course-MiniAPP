-- Support messages table
CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Sender
    sender_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL, -- 'user' or 'admin'

    -- Chat owner (always the regular user)
    chat_user_id INTEGER NOT NULL,

    -- Message
    message TEXT NOT NULL,

    -- Status
    is_read INTEGER DEFAULT 0,    -- 0 = unread, 1 = read
    is_edited INTEGER DEFAULT 0,  -- 0 = not edited
    is_deleted INTEGER DEFAULT 0, -- 0 = not deleted (soft delete)

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (chat_user_id) REFERENCES users(id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_support_messages_chat ON support_messages(chat_user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender ON support_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_unread
    ON support_messages(chat_user_id, is_read)
    WHERE is_deleted = 0;
