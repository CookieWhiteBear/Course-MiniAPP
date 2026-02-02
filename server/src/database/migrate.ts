import { getDB, closeDB } from '../config/database.js'

const schema = `
-- Пользователи (привязка к Telegram ID)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    photo_url TEXT,
    notifications_enabled INTEGER DEFAULT 1,
    has_started INTEGER DEFAULT 0,
    is_blocked_for_reviews INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);

-- Курсы
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    price REAL NOT NULL,
    rating REAL DEFAULT 0,
    category TEXT,
    image_url TEXT,
    description TEXT,
    duration TEXT,
    is_published INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Модули курса
CREATE TABLE IF NOT EXISTS course_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Уроки (steps)
CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT CHECK(type IN ('text', 'image', 'video', 'completion')) DEFAULT 'text',
    image_url TEXT,
    video_url TEXT,
    duration_seconds INTEGER,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Покупки курсов
CREATE TABLE IF NOT EXISTS user_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    is_favorite INTEGER DEFAULT 0,
    purchased_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE INDEX IF NOT EXISTS idx_user_courses_user ON user_courses(user_id);

-- Прогресс прохождения
CREATE TABLE IF NOT EXISTS lesson_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, lesson_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user_course ON lesson_progress(user_id, course_id);

-- Отзывы
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Транзакции (для Billing History)
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER,
    payment_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT CHECK(status IN ('pending', 'success', 'failed', 'refunded')) DEFAULT 'pending',
    type TEXT CHECK(type IN ('purchase', 'subscription', 'refund')) DEFAULT 'purchase',
    notification_message_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
`

const supportSchema = `
-- Support messages
CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL,
    chat_user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    is_edited INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (chat_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_support_messages_chat ON support_messages(chat_user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender ON support_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON support_messages(chat_user_id, is_read) WHERE is_deleted = 0;
`

function migrate() {
    console.log('🔄 Running database migrations...')

    try {
        const db = getDB()

        // Execute schema
        db.exec(schema)
        db.exec(supportSchema)
        ensureTransactionNotificationColumn(db)
        ensureUserLanguageColumn(db)

        console.log('✅ Migrations completed successfully!')
        closeDB()
    } catch (error) {
        console.error('❌ Migration failed:', error)
        closeDB()
        process.exit(1)
    }
}

migrate()

function ensureTransactionNotificationColumn(db: any) {
    try {
        const columns = db.prepare('PRAGMA table_info(transactions)').all() as { name: string }[]
        const hasColumn = columns.some(column => column.name === 'notification_message_id')
        if (!hasColumn) {
            db.exec('ALTER TABLE transactions ADD COLUMN notification_message_id INTEGER')
            console.log('✅ Added notification_message_id column to transactions')
        }
    } catch (error) {
        console.error('❌ Failed to ensure notification_message_id column:', error)
    }
}

function ensureUserLanguageColumn(db: any) {
    try {
        const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
        const hasColumn = columns.some(column => column.name === 'language_code')
        if (!hasColumn) {
            db.exec('ALTER TABLE users ADD COLUMN language_code TEXT DEFAULT "en"')
            console.log('✅ Added language_code column to users')
        }
    } catch (error) {
        console.error('❌ Failed to ensure language_code column:', error)
    }
}
