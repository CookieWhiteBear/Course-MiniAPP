import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from './config/env.js'
import { getDB } from './config/database.js'
import { errorHandler } from './middleware/error.middleware.js'
import { rateLimiter } from './middleware/rateLimit.middleware.js'
import { botShield } from './middleware/botShield.middleware.js'
import { hidePublic } from './middleware/hidePublic.middleware.js'
import routes from './routes/index.js'
import { logger, requestLogger } from './utils/logger.js'
import { registerTelegramWebhook } from './services/telegram-bot.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Auto-migrate database on startup
function autoMigrate() {
    try {
        const db = getDB()

        // Check if tables exist
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()

        if (!tables) {
            logger.info('AutoMigrationStarted', 'Database tables not found, starting auto-migration process')

            // Run migration schema
            const schema = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                photo_url TEXT,
                language_code TEXT DEFAULT 'en',
                notifications_enabled INTEGER DEFAULT 1,
                has_started INTEGER DEFAULT 0,
                is_blocked_for_reviews INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);

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

            CREATE TABLE IF NOT EXISTS course_modules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS lessons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                type TEXT CHECK(type IN ('text', 'image', 'video', 'quiz', 'completion')) DEFAULT 'text',
                image_url TEXT,
                video_url TEXT,
                duration_seconds INTEGER,
                sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lesson_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                type TEXT CHECK(type IN ('single', 'multiple', 'text')) DEFAULT 'single',
                explanation TEXT,
                hint TEXT,
                points INTEGER DEFAULT 1,
                time_limit INTEGER,
                sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson ON quiz_questions(lesson_id);

            CREATE TABLE IF NOT EXISTS quiz_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                answer_text TEXT NOT NULL,
                is_correct INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_quiz_answers_question ON quiz_answers(question_id);

            CREATE TABLE IF NOT EXISTS quiz_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lesson_id INTEGER UNIQUE NOT NULL,
                passing_score REAL DEFAULT 70.0,
                max_attempts INTEGER DEFAULT -1,
                shuffle_questions INTEGER DEFAULT 0,
                shuffle_answers INTEGER DEFAULT 1,
                show_explanations INTEGER DEFAULT 1,
                require_pass INTEGER DEFAULT 1,
                FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                score REAL NOT NULL,
                max_score INTEGER NOT NULL,
                percentage REAL NOT NULL,
                answers_data TEXT,
                time_spent INTEGER,
                passed INTEGER DEFAULT 0,
                attempt_number INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (lesson_id) REFERENCES lessons(id)
            );
            CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson ON quiz_attempts(user_id, lesson_id);

            CREATE TABLE IF NOT EXISTS remedial_content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lesson_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                content_type TEXT CHECK(content_type IN ('text', 'video', 'article', 'practice')) DEFAULT 'text',
                media_url TEXT,
                sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_remedial_content_lesson ON remedial_content(lesson_id);

            CREATE TABLE IF NOT EXISTS video_access_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                access_token TEXT,
                accessed_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (lesson_id) REFERENCES lessons(id)
            );
            CREATE INDEX IF NOT EXISTS idx_video_access_user_lesson ON video_access_log(user_id, lesson_id);
            CREATE INDEX IF NOT EXISTS idx_video_access_token ON video_access_log(access_token);

            CREATE TABLE IF NOT EXISTS user_courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                is_favorite INTEGER DEFAULT 0,
                purchased_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, course_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_user_courses_user ON user_courses(user_id);

            CREATE TABLE IF NOT EXISTS lesson_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                completed_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, lesson_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (lesson_id) REFERENCES lessons(id)
            );
            CREATE INDEX IF NOT EXISTS idx_progress_user_course ON lesson_progress(user_id, course_id);

            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                rating INTEGER NOT NULL,
                comment TEXT,
                is_edited INTEGER DEFAULT 0,
                admin_reply TEXT,
                admin_reply_user_id INTEGER,
                admin_reply_is_edited INTEGER DEFAULT 0,
                admin_reply_created_at TEXT,
                admin_reply_updated_at TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, course_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS review_reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                review_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                value INTEGER NOT NULL CHECK(value IN (1, -1)),
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(review_id, user_id),
                FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_review_reactions_review ON review_reactions(review_id);
            CREATE INDEX IF NOT EXISTS idx_review_reactions_user ON review_reactions(user_id);

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
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
            `

            db.exec(schema)
            ensureSupportTables(db)
            ensureTransactionNotificationColumn(db)
            ensureUserLanguageColumn(db)
            ensureReviewColumns(db)
            ensureReviewReplyColumns(db)
            ensureReviewReactionTable(db)
            ensureUserStartedColumn(db)
            ensureUserReviewBlockColumn(db)
            migrateRemoveLessonsForeignKeys(db)
            logger.info('AutoMigrationCompleted', 'Database schema created successfully with all tables and indexes')

        } else {
            logger.info('DatabaseReady', 'Database tables already exist, skipping migration')
            ensureSupportTables(db)
            ensureTransactionNotificationColumn(db)
            ensureUserLanguageColumn(db)
            ensureReviewColumns(db)
            ensureReviewReplyColumns(db)
            ensureReviewReactionTable(db)
            ensureUserStartedColumn(db)
            ensureUserReviewBlockColumn(db)
            migrateRemoveLessonsForeignKeys(db)
        }
    } catch (error) {
        logger.error('AutoMigrationFailed', `Auto-migration process failed: ${error instanceof Error ? error.message : String(error)}`)
    }
}

function ensureSupportTables(db: any) {
    try {
        db.exec(`
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
            CREATE INDEX IF NOT EXISTS idx_support_messages_unread
                ON support_messages(chat_user_id, is_read)
                WHERE is_deleted = 0;
        `)
        logger.info('MigrationApplied', 'Support tables ensured')
    } catch (error) {
        logger.error('MigrationFailed', `Failed to ensure support tables: ${error instanceof Error ? error.message : String(error)}`)
    }
}

function ensureTransactionNotificationColumn(db: any) {
    try {
        const columns = db.prepare('PRAGMA table_info(transactions)').all() as { name: string }[]
        const hasColumn = columns.some(column => column.name === 'notification_message_id')
        if (!hasColumn) {
            db.exec('ALTER TABLE transactions ADD COLUMN notification_message_id INTEGER')
            logger.info('MigrationApplied', 'Added notification_message_id column to transactions')
        }
    } catch (error) {
        logger.error('MigrationFailed', `Failed to ensure transactions notification column: ${error instanceof Error ? error.message : String(error)}`)
    }
}

function ensureReviewColumns(db: any) {
    try {
        const columns = db.prepare('PRAGMA table_info(reviews)').all() as { name: string }[]
        const hasEdited = columns.some(column => column.name === 'is_edited')
        const hasUpdated = columns.some(column => column.name === 'updated_at')
        if (!hasEdited) {
            db.exec('ALTER TABLE reviews ADD COLUMN is_edited INTEGER DEFAULT 0')
            logger.info('MigrationApplied', 'Added is_edited column to reviews')
        }
        if (!hasUpdated) {
            db.exec('ALTER TABLE reviews ADD COLUMN updated_at TEXT')
            db.exec('UPDATE reviews SET updated_at = datetime(\'now\') WHERE updated_at IS NULL')
            logger.info('MigrationApplied', 'Added updated_at column to reviews')
        }
    } catch (error) {
        logger.error('MigrationFailed', `Failed to ensure reviews columns: ${error instanceof Error ? error.message : String(error)}`)
    }
}

function ensureReviewReplyColumns(db: any) {
    try {
        const columns = db.prepare('PRAGMA table_info(reviews)').all() as { name: string }[]
        const hasReply = columns.some(column => column.name === 'admin_reply')
        const hasReplyUser = columns.some(column => column.name === 'admin_reply_user_id')
        const hasReplyEdited = columns.some(column => column.name === 'admin_reply_is_edited')
        const hasReplyCreated = columns.some(column => column.name === 'admin_reply_created_at')
        const hasReplyUpdated = columns.some(column => column.name === 'admin_reply_updated_at')

        if (!hasReply) {
            db.exec('ALTER TABLE reviews ADD COLUMN admin_reply TEXT')
            logger.info('MigrationApplied', 'Added admin_reply column to reviews')
        }
        if (!hasReplyUser) {
            db.exec('ALTER TABLE reviews ADD COLUMN admin_reply_user_id INTEGER')
            logger.info('MigrationApplied', 'Added admin_reply_user_id column to reviews')
        }
        if (!hasReplyEdited) {
            db.exec('ALTER TABLE reviews ADD COLUMN admin_reply_is_edited INTEGER DEFAULT 0')
            logger.info('MigrationApplied', 'Added admin_reply_is_edited column to reviews')
        }
        if (!hasReplyCreated) {
            db.exec('ALTER TABLE reviews ADD COLUMN admin_reply_created_at TEXT')
            logger.info('MigrationApplied', 'Added admin_reply_created_at column to reviews')
        }
        if (!hasReplyUpdated) {
            db.exec('ALTER TABLE reviews ADD COLUMN admin_reply_updated_at TEXT')
            logger.info('MigrationApplied', 'Added admin_reply_updated_at column to reviews')
        }
    } catch (error) {
        logger.error('MigrationFailed', `Failed to ensure reviews reply columns: ${error instanceof Error ? error.message : String(error)}`)
    }
}

function ensureUserStartedColumn(db: any) {
    try {
        const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
        const hasStarted = columns.some(column => column.name === 'has_started')
        if (!hasStarted) {
            db.exec('ALTER TABLE users ADD COLUMN has_started INTEGER DEFAULT 0')
            logger.info('MigrationApplied', 'Added has_started column to users')
        }
    } catch (error) {
        logger.error('MigrationFailed', `Failed to ensure users has_started column: ${error instanceof Error ? error.message : String(error)}`)
    }
}

function ensureUserReviewBlockColumn(db: any) {
    try {
        const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
        const hasColumn = columns.some(column => column.name === 'is_blocked_for_reviews')
        if (!hasColumn) {
            db.exec('ALTER TABLE users ADD COLUMN is_blocked_for_reviews INTEGER DEFAULT 0')
            logger.info('MigrationApplied', 'Added is_blocked_for_reviews column to users')
        }
    } catch (error) {
        logger.error('MigrationFailed', `Failed to ensure users is_blocked_for_reviews column: ${error instanceof Error ? error.message : String(error)}`)
    }
}

function ensureReviewReactionTable(db: any) {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS review_reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                review_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                value INTEGER NOT NULL CHECK(value IN (1, -1)),
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(review_id, user_id),
                FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_review_reactions_review ON review_reactions(review_id);
            CREATE INDEX IF NOT EXISTS idx_review_reactions_user ON review_reactions(user_id);
        `)
        logger.info('MigrationApplied', 'Review reactions table ensured')
    } catch (error) {
        logger.error('MigrationFailed', `Failed to ensure review reactions table: ${error instanceof Error ? error.message : String(error)}`)
    }
}

function ensureUserLanguageColumn(db: any) {
    try {
        const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
        const hasColumn = columns.some(column => column.name === 'language_code')
        if (!hasColumn) {
            db.exec('ALTER TABLE users ADD COLUMN language_code TEXT DEFAULT "en"')
            logger.info('MigrationApplied', 'Added language_code column to users')
        }
    } catch (error) {
        logger.error('MigrationFailed', `Failed to ensure language_code column: ${error instanceof Error ? error.message : String(error)}`)
    }
}

/**
 * Migration: Remove FOREIGN KEY constraints on lessons table
 * Required for filesystem-based courses where lessons don't exist in DB
 */
function migrateRemoveLessonsForeignKeys(db: any) {
    try {
        // Check if migration is needed by trying to insert a test record
        // If FK constraint exists and lessons table is empty, it will fail
        const needsMigration = (() => {
            try {
                // Check if lesson_progress has FK constraint by looking at table schema
                const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='lesson_progress'").get() as { sql: string } | undefined
                if (tableInfo?.sql?.includes('REFERENCES lessons')) {
                    return true
                }
                return false
            } catch {
                return false
            }
        })()

        if (!needsMigration) {
            return // Already migrated
        }

        logger.info('MigrationStarted', 'Removing lessons FK constraints for filesystem compatibility')

        // Disable FK checks temporarily
        db.exec('PRAGMA foreign_keys = OFF')

        // Recreate lesson_progress without FK to lessons
        db.exec(`
            CREATE TABLE IF NOT EXISTS lesson_progress_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                completed_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, lesson_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            INSERT OR IGNORE INTO lesson_progress_new SELECT * FROM lesson_progress;
            DROP TABLE lesson_progress;
            ALTER TABLE lesson_progress_new RENAME TO lesson_progress;
            CREATE INDEX IF NOT EXISTS idx_progress_user_course ON lesson_progress(user_id, course_id);
        `)

        // Recreate quiz_attempts without FK to lessons
        db.exec(`
            CREATE TABLE IF NOT EXISTS quiz_attempts_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                score REAL NOT NULL,
                max_score INTEGER NOT NULL,
                percentage REAL NOT NULL,
                answers_data TEXT,
                time_spent INTEGER,
                passed INTEGER DEFAULT 0,
                attempt_number INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            INSERT OR IGNORE INTO quiz_attempts_new SELECT * FROM quiz_attempts;
            DROP TABLE quiz_attempts;
            ALTER TABLE quiz_attempts_new RENAME TO quiz_attempts;
            CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson ON quiz_attempts(user_id, lesson_id);
        `)

        // Re-enable FK checks
        db.exec('PRAGMA foreign_keys = ON')

        logger.success('MigrationCompleted', 'Removed lessons FK constraints from lesson_progress and quiz_attempts')
    } catch (error) {
        // Re-enable FK checks even on error
        try { db.exec('PRAGMA foreign_keys = ON') } catch { }
        logger.error('MigrationFailed', `Failed to remove lessons FK: ${error instanceof Error ? error.message : String(error)}`)
    }
}

// Run migration on startup
autoMigrate()

const app = express()

// Trust proxy for Pterodactyl/reverse proxy
app.set('trust proxy', true)
app.disable('x-powered-by')

// Security middleware - relaxed for same-origin frontend
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for React
    referrerPolicy: { policy: 'no-referrer' }
}))

// CORS configuration
// SECURITY: In production, frontendUrl MUST be explicitly configured
const corsOrigin = (() => {
    if (config.frontendUrl) {
        return config.frontendUrl
    }
    if (config.nodeEnv === 'production') {
        logger.error('CorsConfigMissing', 'FRONTEND_URL must be configured in production for CORS security')
        // In production without config, only allow same-origin requests
        return false
    }
    // Development: allow localhost origins
    logger.warn('CorsDevMode', 'CORS allowing localhost origins - configure frontendUrl for production')
    return [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:5173'
    ]
})()

app.use(cors({
    origin: corsOrigin,
    credentials: true
}))

// Performance middleware
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(hidePublic())
app.use(botShield())

// Request logging (only in development)
if (config.nodeEnv === 'development') {
    app.use(requestLogger())
}

// Rate limiting for API
app.use('/api', rateLimiter)

// API Routes
app.use('/api', routes)

// PayPal Webhook at root (not under /api) - required by PayPal
import * as paypalController from './controllers/paypal.controller.js'
import { webhookRateLimiter } from './middleware/rateLimit.middleware.js'
app.post('/paypal-hook', webhookRateLimiter, paypalController.handlePayPalWebhook)
app.get('/paypal-hook/test', paypalController.testWebhookEndpoint)

// Health check with detailed info
app.get('/health', (_, res) => {
    const uptime = process.uptime()
    const memory = process.memoryUsage()

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
            heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(memory.rss / 1024 / 1024)}MB`
        },
        nodeVersion: process.version,
        env: config.nodeEnv
    })
})

// Debug endpoints (development only)
if (config.nodeEnv === 'development') {
    // Show safe config values
    app.get('/debug/config', (_, res) => {
        res.json({
            nodeEnv: config.nodeEnv,
            port: config.port,
            frontendUrl: config.frontendUrl,
            paypalMode: config.paypal.mode,
            paypalConfigured: !!config.paypal.clientId,
            telegramConfigured: !!config.telegram.botToken,
            redisHost: config.redis.host,
            redisPort: config.redis.port
        })
    })

    // Show database tables
    app.get('/debug/db', (_, res) => {
        try {
            const db = getDB()
            const tables = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `).all() as { name: string }[]

            const tableInfo = tables.map(t => {
                const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get() as { count: number }
                return { table: t.name, rows: count.count }
            })

            res.json({ tables: tableInfo })
        } catch (error) {
            res.status(500).json({ error: 'Failed to get DB info' })
        }
    })

    // Show memory usage
    app.get('/debug/memory', (_, res) => {
        const memory = process.memoryUsage()
        res.json({
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            external: memory.external,
            rss: memory.rss,
            formatted: {
                heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100} MB`,
                heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100} MB`,
                rss: `${Math.round(memory.rss / 1024 / 1024 * 100) / 100} MB`
            }
        })
    })

    logger.info('DebugEndpoints', 'Development debug endpoints enabled: /debug/config, /debug/db, /debug/memory')
}

// Serve static frontend files
const staticPath = path.join(__dirname, 'public')
app.get(['/tg', '/tg/'], (_req, res) => {
    res.sendFile(path.join(staticPath, 'tg.html'))
})
app.use(express.static(staticPath))

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    // Don't serve index.html for API routes  
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Not found' })
    }
    res.sendFile(path.join(staticPath, 'index.html'))
})

// Error handling
app.use(errorHandler)

// Start server
const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || String(config.port), 10)
const HOST = '0.0.0.0' // Required for Pterodactyl

app.listen(PORT, HOST, () => {
    // Show startup banner in development
    if (config.nodeEnv === 'development') {
        console.log('')
        console.log('\x1b[36m╔═══════════════════════════════════════════════════════════╗\x1b[0m')
        console.log('\x1b[36m║\x1b[0m                                                           \x1b[36m║\x1b[0m')
        console.log('\x1b[36m║\x1b[0m   \x1b[1m🎓 Course Platform Server\x1b[0m                              \x1b[36m║\x1b[0m')
        console.log('\x1b[36m║\x1b[0m                                                           \x1b[36m║\x1b[0m')
        console.log(`\x1b[36m║\x1b[0m   Port:        \x1b[32m${PORT}\x1b[0m${' '.repeat(40 - String(PORT).length)}\x1b[36m║\x1b[0m`)
        console.log(`\x1b[36m║\x1b[0m   Environment: \x1b[33m${config.nodeEnv}\x1b[0m${' '.repeat(40 - config.nodeEnv.length)}\x1b[36m║\x1b[0m`)
        console.log(`\x1b[36m║\x1b[0m   Frontend:    \x1b[90m${staticPath.slice(-35)}\x1b[0m${' '.repeat(Math.max(0, 40 - Math.min(35, staticPath.length)))}\x1b[36m║\x1b[0m`)
        console.log('\x1b[36m║\x1b[0m                                                           \x1b[36m║\x1b[0m')
        console.log('\x1b[36m╚═══════════════════════════════════════════════════════════╝\x1b[0m')
        console.log('')
        logger.success('ServerReady', `http://localhost:${PORT}`)
    } else {
        logger.info('ServerStarted', `Express server running on http://${HOST}:${PORT}, environment ${config.nodeEnv}`)
    }

    if (config.telegram.botToken) {
        registerTelegramWebhook(config.telegram.webhookUrl)
    }
})

export default app
