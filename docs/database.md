# Database

SQLite with better-sqlite3. Auto-migrates on startup.

Location: `data/database.sqlite` (relative to cwd, or `SQLITE_PATH` env var)

Pragmas enabled:
- `journal_mode = WAL` (better concurrency)
- `foreign_keys = ON`

## Tables

### users
```sql
id                      INTEGER PRIMARY KEY AUTOINCREMENT
telegram_id             INTEGER UNIQUE NOT NULL
username                TEXT
first_name              TEXT
last_name               TEXT
photo_url               TEXT
notifications_enabled   INTEGER DEFAULT 1
has_started             INTEGER DEFAULT 0
is_blocked_for_reviews  INTEGER DEFAULT 0
created_at              TEXT DEFAULT (datetime('now'))
updated_at              TEXT DEFAULT (datetime('now'))
```

### user_courses
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
user_id         INTEGER NOT NULL
course_id       INTEGER NOT NULL
is_favorite     INTEGER DEFAULT 0
purchased_at    TEXT DEFAULT (datetime('now'))
UNIQUE(user_id, course_id)
FK user_id -> users(id)
```

### lesson_progress
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
user_id         INTEGER NOT NULL
course_id       INTEGER NOT NULL
lesson_id       INTEGER NOT NULL
completed_at    TEXT DEFAULT (datetime('now'))
UNIQUE(user_id, lesson_id)
FK user_id -> users(id)
```

### reviews
```sql
id                      INTEGER PRIMARY KEY AUTOINCREMENT
user_id                 INTEGER NOT NULL
course_id               INTEGER NOT NULL
rating                  INTEGER NOT NULL
comment                 TEXT
is_edited               INTEGER DEFAULT 0
admin_reply             TEXT
admin_reply_user_id     INTEGER
admin_reply_is_edited   INTEGER DEFAULT 0
admin_reply_created_at  TEXT
admin_reply_updated_at  TEXT
created_at              TEXT DEFAULT (datetime('now'))
updated_at              TEXT DEFAULT (datetime('now'))
UNIQUE(user_id, course_id)
FK user_id -> users(id)
```

### review_reactions
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
review_id   INTEGER NOT NULL
user_id     INTEGER NOT NULL
value       INTEGER CHECK(value IN (1, -1))
created_at  TEXT DEFAULT (datetime('now'))
updated_at  TEXT DEFAULT (datetime('now'))
UNIQUE(review_id, user_id)
FK review_id -> reviews(id) ON DELETE CASCADE
FK user_id -> users(id)
```

### transactions
```sql
id                      INTEGER PRIMARY KEY AUTOINCREMENT
user_id                 INTEGER NOT NULL
course_id               INTEGER
payment_id              TEXT
amount                  REAL NOT NULL
currency                TEXT DEFAULT 'USD'
status                  TEXT CHECK(status IN ('pending', 'success', 'failed', 'refunded'))
type                    TEXT CHECK(type IN ('purchase', 'subscription', 'refund'))
notification_message_id INTEGER
created_at              TEXT DEFAULT (datetime('now'))
FK user_id -> users(id)
```

### quiz_attempts
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
user_id         INTEGER NOT NULL
lesson_id       INTEGER NOT NULL
course_id       INTEGER NOT NULL
score           REAL NOT NULL
max_score       INTEGER NOT NULL
percentage      REAL NOT NULL
answers_data    TEXT
time_spent      INTEGER
passed          INTEGER DEFAULT 0
attempt_number  INTEGER DEFAULT 1
created_at      TEXT DEFAULT (datetime('now'))
FK user_id -> users(id)
```

### video_access_log
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
user_id         INTEGER NOT NULL
lesson_id       INTEGER NOT NULL
course_id       INTEGER NOT NULL
ip_address      TEXT
user_agent      TEXT
access_token    TEXT
accessed_at     TEXT DEFAULT (datetime('now'))
FK user_id -> users(id)
```

### support_messages
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
sender_id       INTEGER NOT NULL
sender_type     TEXT NOT NULL
chat_user_id    INTEGER NOT NULL
message         TEXT NOT NULL
is_read         INTEGER DEFAULT 0
is_edited       INTEGER DEFAULT 0
is_deleted      INTEGER DEFAULT 0
created_at      TEXT DEFAULT (datetime('now'))
updated_at      TEXT DEFAULT (datetime('now'))
FK sender_id -> users(id)
FK chat_user_id -> users(id)
```

### Legacy Tables (Database-based courses)

These tables exist in schema but filesystem-based courses are preferred:

**courses**
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
title           TEXT NOT NULL
author          TEXT NOT NULL
price           REAL NOT NULL
rating          REAL DEFAULT 0
category        TEXT
image_url       TEXT
description     TEXT
duration        TEXT
is_published    INTEGER DEFAULT 0
created_at      TEXT DEFAULT (datetime('now'))
```

**course_modules**
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
course_id   INTEGER NOT NULL
title       TEXT NOT NULL
sort_order  INTEGER DEFAULT 0
```

**lessons**
```sql
id                  INTEGER PRIMARY KEY AUTOINCREMENT
module_id           INTEGER NOT NULL
course_id           INTEGER NOT NULL
title               TEXT NOT NULL
content             TEXT
type                TEXT CHECK(type IN ('text', 'image', 'video', 'quiz', 'completion'))
image_url           TEXT
video_url           TEXT
duration_seconds    INTEGER
sort_order          INTEGER DEFAULT 0
FK module_id -> course_modules(id) ON DELETE CASCADE
```

**quiz_questions**
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
lesson_id   INTEGER NOT NULL
question    TEXT NOT NULL
type        TEXT CHECK(type IN ('single', 'multiple', 'text'))
explanation TEXT
hint        TEXT
points      INTEGER DEFAULT 1
time_limit  INTEGER
sort_order  INTEGER DEFAULT 0
FK lesson_id -> lessons(id) ON DELETE CASCADE
```

**quiz_answers**
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
question_id INTEGER NOT NULL
answer_text TEXT NOT NULL
is_correct  INTEGER DEFAULT 0
sort_order  INTEGER DEFAULT 0
FK question_id -> quiz_questions(id) ON DELETE CASCADE
```

**quiz_settings**
```sql
id                  INTEGER PRIMARY KEY AUTOINCREMENT
lesson_id           INTEGER UNIQUE NOT NULL
passing_score       REAL DEFAULT 70.0
max_attempts        INTEGER DEFAULT -1
shuffle_questions   INTEGER DEFAULT 0
shuffle_answers     INTEGER DEFAULT 1
show_explanations   INTEGER DEFAULT 1
require_pass        INTEGER DEFAULT 1
FK lesson_id -> lessons(id) ON DELETE CASCADE
```

**remedial_content**
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
lesson_id       INTEGER NOT NULL
title           TEXT NOT NULL
content         TEXT NOT NULL
content_type    TEXT CHECK(content_type IN ('text', 'video', 'article', 'practice'))
media_url       TEXT
sort_order      INTEGER DEFAULT 0
FK lesson_id -> lessons(id) ON DELETE CASCADE
```

## Redis

Optional caching layer. Enable with `redis.enabled: true` in config.

### Cache Keys

```
courses:featured              - Featured courses list
courses:{id}                  - Single course data
courses:{id}:lessons          - Course lessons
user:{telegramId}             - User object (15 min TTL)
user:{userId}:courses         - User's purchased course IDs
```

### Configuration

```yaml
env:
  redis:
    enabled: true
    host: localhost
    port: 6379
    password: ""
```

Falls back to no-op if Redis unavailable.
