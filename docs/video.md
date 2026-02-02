# Video

## Cloudflare Stream

Primary video hosting for protected content.

### Setup

1. Create Cloudflare account
2. Enable Stream
3. Create API token with Stream permissions
4. Add to config:

```yaml
env:
  cloudflare:
    accountId: "..."
    apiToken: "..."
    signingKey: "..."  # Optional: for self-signed tokens
    customerSubdomain: "customer-xxx.cloudflarestream.com"
```

### Uploading Videos

Use Cloudflare Dashboard or API.

Video ID after upload: 32 character hex string (e.g., `abc123def456789012345678901234ab`).

### Embedding in Lessons

In markdown lesson file, use `<vid:>` tag:

```markdown
# Video Lesson

<vid:abc123def456789012345678901234ab>

Text content below video.
```

Also accepts full URLs:
```markdown
<vid:https://customer-xxx.cloudflarestream.com/abc123.../manifest/video.m3u8>
```

This gets parsed to `{{CLOUDFLARE_STREAM:videoId}}` for frontend rendering.

### Signed URLs

Two approaches for generating signed playback URLs:

1. **Self-signing** (with `signingKey`): Fast, unlimited tokens
2. **Token API** (without `signingKey`): Uses Cloudflare API, limited to 1000/day

Flow:
1. Client requests: `POST /api/stream/sign-url` with `{ videoId, courseId }`
2. Server verifies user has purchased course
3. Server generates signed URL (1 hour expiry default)
4. Client plays video with signed URL

### API Endpoints

```
POST /api/stream/sign-url      - Generate signed playback URL
GET  /api/stream/metadata/:id  - Get video metadata
GET  /api/stream/analytics/:id - Get video analytics
GET  /api/stream/validate/:id  - Validate video ID exists
```

### Playback URLs

With customer subdomain:
```
https://customer-xxx.cloudflarestream.com/{videoId}/manifest/video.m3u8?token=...
```

Without (default):
```
https://videodelivery.net/{videoId}/manifest/video.m3u8?token=...
```

## Local Video Files

For non-Cloudflare videos, store files in course directory:

```
courses/1/
├── 1.md
├── 2.md
└── assets/
    └── intro.mp4
```

Embed in lesson:
```markdown
<vid:assets/intro.mp4>
```

Or use video file directly as lesson:
```
courses/1/
├── 1.md
├── 2.mp4    # Video-only lesson
└── 3.md
```

Supported formats: `.mp4`, `.webm`, `.mov`, `.avi`

## Legacy Video Access (video.controller)

For database-stored video URLs, there's a separate signed URL system:

### API Endpoint

```
POST /api/video/access/:lessonId
```

### Token Payload

```json
{
  "userId": 123,
  "lessonId": 456,
  "courseId": 789,
  "timestamp": 1234567890
}
```

- Expires in 5 minutes
- Requires `video.signingKey` in config
- Access logged to `video_access_log` table

### Additional Endpoints

```
GET  /api/video/verify/:token     - Verify token (for CDN)
GET  /api/video/analytics/:courseId - User's video view history
POST /api/video/report-piracy     - Report piracy
```

## Security

- Videos should have `requireSignedURLs: true` in Cloudflare Stream settings
- All video access is logged with user ID, IP, user agent
- Signed URLs expire (1 hour for Stream, 5 min for legacy)
- Purchase verification before generating URLs

## Frontend Player

Frontend uses `CloudflareStreamPlayer` component which:
- Detects `{{CLOUDFLARE_STREAM:videoId}}` markers
- Requests signed URL from server
- Uses HLS.js for playback
- Shows loading/error states
