# API Reference

Base URL: `/api`

Auth header: `x-telegram-init-data: <initData from Telegram WebApp>`

## Bootstrap

### GET /bootstrap
Get initial app data (user, courses, progress) in single request.

Requires auth.

## Config

### GET /config/ui
Get UI configuration (homeHero, wave settings).

Public endpoint.

## Courses

### GET /courses/featured
List all published courses.

Response:
```json
{
  "success": true,
  "data": [{
    "id": 1,
    "title": "string",
    "author": { "name": "string", "avatarUrl": "string" },
    "price": 9.99,
    "starsPrice": 100,
    "rating": 4.5,
    "category": "string",
    "imageUrl": "string",
    "description": "string",
    "duration": "6h 30m",
    "program": ["string"]
  }]
}
```

### GET /courses/:id
Get single course details.

Optional auth (shows purchase status if authenticated).

### GET /courses/:id/lessons
Get course lessons.

Requires auth + purchase.

### GET /courses/:id/reviews
Get course reviews.

Query params:
- `page`: number (default 1)
- `limit`: number (default 20)

## User

### GET /user/profile
Get current user profile.

### GET /user/courses
Get purchased courses.

### PUT /user/settings
Update user settings.

Body:
```json
{
  "notificationsEnabled": boolean
}
```

### PUT /user/courses/:id/favorite
Toggle course favorite status.

### GET /user/transactions
Get user's transaction history.

## Progress

### GET /progress/:courseId
Get user progress for course.

Response:
```json
{
  "success": true,
  "data": {
    "completed": 5,
    "total": 10,
    "completedLessonIds": [1, 2, 3, 4, 5]
  }
}
```

### POST /progress/:courseId/lesson/:lessonId
Mark lesson as complete.

## Reviews

### POST /reviews
Create review.

Body:
```json
{
  "courseId": 1,
  "rating": 5,
  "comment": "string"
}
```

### GET /reviews/:courseId/me
Get current user's review for course.

### POST /reviews/:id/reaction
React to review (upvote/downvote).

Body:
```json
{
  "value": 1 | -1
}
```

### POST /reviews/:id/reply
Admin: Reply to review.

Body:
```json
{
  "reply": "string"
}
```

### DELETE /reviews/:id
Admin: Delete review.

## Quiz

### GET /quiz/:lessonId
Get quiz data for lesson.

### POST /quiz/:lessonId/submit
Submit quiz answers.

Body:
```json
{
  "answers": {
    "1": [2],
    "2": [1, 3]
  },
  "timeSpent": 120
}
```

### GET /quiz/:lessonId/remedial
Get remedial content for failed quiz.

## Video

### POST /video/access/:lessonId
Generate signed video URL.

Response:
```json
{
  "success": true,
  "data": {
    "videoUrl": "string",
    "expiresIn": 300,
    "expiresAt": "ISO date"
  }
}
```

### GET /video/verify/:token
Verify video access token (for CDN).

### GET /video/analytics/:courseId
Get video view analytics.

### POST /video/report-piracy
Report piracy.

Body:
```json
{
  "lessonId": 1,
  "description": "string",
  "evidence": "string"
}
```

## Cloudflare Stream

### POST /stream/sign-url
Generate signed Cloudflare Stream URL.

Body:
```json
{
  "videoId": "abc123...",
  "courseId": 1
}
```

### GET /stream/metadata/:videoId
Get video metadata.

### GET /stream/analytics/:videoId
Get video analytics from Cloudflare.

### GET /stream/validate/:videoId
Validate video ID exists.

## Purchases

### POST /purchase/create
Create PayPal order.

Body:
```json
{
  "courseId": 1
}
```

Response:
```json
{
  "success": true,
  "data": {
    "orderId": "string",
    "approveUrl": "string",
    "price": 9.99,
    "amount": "9.99",
    "currency": "USD"
  }
}
```

### POST /purchase/telegram-stars
Create Telegram Stars invoice.

Body:
```json
{
  "courseId": 1
}
```

Response:
```json
{
  "success": true,
  "data": {
    "invoiceLink": "string"
  }
}
```

## Dynamic Courses (Filesystem)

### GET /dynamic/courses/:id
Get course from filesystem.

### GET /dynamic/courses/:id/lessons
Get lessons from filesystem.

### POST /dynamic/quiz/:courseId/:lessonId/submit
Submit quiz for filesystem course.

### GET /dynamic/quiz/:courseId/:lessonId/remedial
Get remedial content for filesystem course.

## Support

### GET /support/messages
Get user's support messages.

### POST /support/messages
Send support message.

Body:
```json
{
  "message": "string"
}
```

### POST /support/messages/read
Mark messages as read.

Body:
```json
{
  "messageIds": [1, 2, 3]
}
```

### GET /support/unread-count
Get unread message count.

### GET /support/users
Admin: List users with support conversations.

### GET /support/users/search
Admin: Search support users.

Query: `?q=search_term`

### GET /support/messages/:userId
Admin: Get messages for specific user.

### PUT /support/messages/:id
Admin: Edit message.

### DELETE /support/messages/:id
Admin: Delete message.

## Admin

All admin endpoints require telegram_id in `env.telegram.adminIds`.

### GET /admin/metrics
Get platform metrics (users, transactions, courses).

### GET /admin/users
List users with pagination.

Query params:
- `page`: number
- `limit`: number

### PATCH /admin/users/:userId
Update user.

### GET /admin/users/:userId/overview
Get detailed user overview.

### POST /admin/users/:userId/courses/:courseId
Grant course access to user.

### DELETE /admin/users/:userId/courses/:courseId
Revoke course access from user.

### GET /admin/transactions
List all transactions.

### GET /admin/reviews
List all reviews.

### GET /admin/courses
List all courses with stats.

## Webhooks

### POST /webhooks/paypal
PayPal webhook handler.

Also available at `/paypal-hook` (root level, outside /api).

### POST /webhooks/telegram
Telegram bot webhook handler.

### GET /webhooks/paypal/test
Test webhook accessibility.
