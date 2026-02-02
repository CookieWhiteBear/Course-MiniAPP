# Authentication

## Telegram WebApp Auth

Primary auth method. Uses Telegram's initData validation.

### Client

```typescript
const initData = window.Telegram?.WebApp?.initData

fetch('/api/user/profile', {
  headers: {
    'x-telegram-init-data': initData
  }
})
```

### Server

1. Receives `x-telegram-init-data` header
2. Validates with `@telegram-apps/init-data-node`
3. Extracts user data from initData
4. Creates/updates user in database
5. Attaches user to `req.user`
6. Sets `req.telegramId`

### Token Expiry

initData expires after 24 hours (configurable in validation).

## Demo Mode

For development without Telegram.

Enable in config:
```yaml
env:
  demoMode: true
```

When enabled:
- All requests bypass Telegram validation
- Demo users are created with negative telegram_id
- Demo users are cached in Redis (15 min TTL)
- User identity based on `x-demo-user` header hash (or default if not provided)

Demo users:
```
telegram_id: -1 (or hashed negative value)
username: demo_N
first_name: Demo
last_name: N
```

Security note: Demo mode should NEVER be enabled in production (`demoMode: false`).

## Admin Access

Admins are identified by telegram_id in config:

```yaml
env:
  telegram:
    adminIds: [123456789, 987654321]
```

Admin endpoints check if `req.telegramId` is in this list.

In development with demo mode:
- If `adminIds` is empty AND `nodeEnv !== 'production'`, demo users get admin access
- Otherwise, only IDs in `adminIds` have admin access

## Middleware

### authMiddleware
Required auth. Returns 401 if no valid credentials.

```typescript
router.get('/protected', authMiddleware, handler)
```

### optionalAuthMiddleware
Optional auth. Sets `req.user` if valid credentials, continues without error if not.

```typescript
router.get('/public', optionalAuthMiddleware, handler)
```

### adminMiddleware
Requires admin access. Must be used after authMiddleware. Returns 403 if not admin.

```typescript
router.get('/admin-only', authMiddleware, adminMiddleware, handler)
```

## Request Properties

After auth middleware:
- `req.user` - User object from database
- `req.telegramId` - Telegram user ID (number)

## User Object

```typescript
interface User {
  id: number
  telegram_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  photo_url: string | null
  notifications_enabled: boolean
  has_started: number
  is_blocked_for_reviews: number
  created_at: Date
  updated_at: Date
}
```
