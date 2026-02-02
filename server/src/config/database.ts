import Database from 'better-sqlite3'
import path from 'path'
import { mkdirSync, existsSync } from 'fs'
import { logger } from '../utils/logger.js'

// SQLite database path - use environment variable or default to ./data/database.sqlite
const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'database.sqlite')

// Ensure data directory exists
const dbDir = path.dirname(dbPath)
if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
}

let db: Database.Database | null = null

export function getDB(): Database.Database {
    if (!db) {
        // Only enable verbose logging in development or when DEBUG_SQL=true
        const enableVerbose = process.env.NODE_ENV === 'development' || process.env.DEBUG_SQL === 'true'

        db = new Database(dbPath, {
            verbose: enableVerbose ? (message?: unknown) => {
                logger.debug('SQLQuery', `${String(message)}`)
            } : undefined
        })
        db.pragma('journal_mode = WAL') // Better concurrency
        db.pragma('foreign_keys = ON')  // Enable foreign keys
        logger.info('DatabaseConnected', `SQLite database connected at ${dbPath}`)
    }
    return db
}

export function closeDB(): void {
    if (db) {
        db.close()
        db = null
        logger.info('DatabaseClosed', 'SQLite connection closed successfully')
    }
}

// Helper to run queries with parameters
export function query<T>(sql: string, params: any[] = []): T {
    const database = getDB()

    // Detect query type
    const queryType = sql.trim().toUpperCase()

    if (queryType.startsWith('SELECT')) {
        // SELECT query - return all rows
        const stmt = database.prepare(sql)
        return stmt.all(...params) as T
    } else if (queryType.startsWith('INSERT') || queryType.startsWith('UPDATE') || queryType.startsWith('DELETE')) {
        // INSERT/UPDATE/DELETE - return info
        const stmt = database.prepare(sql)
        const info = stmt.run(...params)
        return info as T
    } else {
        // Other queries (CREATE, DROP, etc.)
        const result = database.exec(sql)
        return result as T
    }
}

// Helper for INSERT queries to get last inserted ID
export function insert(sql: string, params: any[] = []): number {
    const database = getDB()
    const stmt = database.prepare(sql)
    const info = stmt.run(...params)
    return info.lastInsertRowid as number
}

// Export db instance for direct access if needed
export const pool = {
    execute: async (sql: string, params?: any[]) => {
        const result = query(sql, params)
        return [result]
    }
}
