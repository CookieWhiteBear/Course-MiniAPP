# Configuration

All configuration is in `config.yaml` at project root.

## Structure

```yaml
app:
  name: string
  description: string
  defaultCurrency: USD | EUR | RUB | etc.

env:
  port: number
  nodeEnv: development | production
  demoMode: boolean
  defaultLanguage: en | ru | uk
  frontendUrl: string

  redis:
    enabled: boolean
    host: string
    port: number
    password: string

  telegram:
    botToken: string
    webhookUrl: string
    adminIds: number[]
    initDataTtl: number

  paypal:
    clientId: string
    secret: string
    webhookId: string
    mode: sandbox | live

  cloudflare:
    accountId: string
    apiToken: string
    signingKey: string
    customerSubdomain: string

  video:
    signingKey: string

features:
  demoMode: boolean
  telegramAuth: boolean
  supportChat: boolean
  hidePublic: boolean

`env.telegram.initDataTtl` defines how many seconds a Telegram `initData` payload remains valid before the server rejects it. A shorter TTL (default 300s) reduces the replay window for intercepted credentials.
`features.hidePublic` gates access to the frontend and public API routes behind valid Telegram `initData`. When enabled, unauthenticated requests are dropped at the connection level (browser shows a real network error).

### `features.hidePublic` (MiniApp-only access)
**What it does**
- Blocks all frontend/static requests unless the client has a valid access cookie.
- Allows API requests only when they include valid `x-telegram-init-data`.
- Provides a dedicated MiniApp entry point at `/tg` (and `/tg/`).

**How to enable**
1. Set `features.hidePublic: true`
2. Ensure `env.telegram.botToken` is set (required to validate initData).
3. Update your Telegram MiniApp URL in BotFather to point to `/tg`:
   Example: `https://your-domain.example/tg`

**How it works**
1. Telegram opens `/tg` inside the MiniApp.
2. `/tg` verifies Telegram auth using `initData`.
3. On success it redirects to `/` (or to a deep link if `?to=/path` is provided) and sets an access cookie.
4. Any external browser without the cookie gets a hard connection drop.

**Notes**
- If the MiniApp URL is still `/`, the server will drop the connection.
- For external browsers, this is intentional: the page won’t load, and no title/favicon is shown.

payments:
  paypal:
    enabled: boolean
    currency: string
  telegramStars:
    enabled: boolean

demo:
  avatarUrl: string
  userNamePrefix: string
  support:
    seedMessage: string
    seedReply: string

ui:
  homeHero:
    imageUrl: string
    wave:
      colors: string[]
      fps: number
      seed: number
      speed: number

authors:
  - id: string
    name: string
    avatarUrl: string

courses:
  - id: number
    title: string
    authorId: string
    description: string
    category: string
    imageUrl: string
    duration: string
    program: string[]
    price: number
    starsPrice: number
    currency: string
    visibility: public | hidden
```

## Production Requirements

| Key | Required | Notes |
|-----|----------|-------|
| `env.nodeEnv` | yes | Must be `production` |
| `env.demoMode` | yes | Must be `false` |
| `env.frontendUrl` | yes | Full URL with protocol |
| `env.telegram.botToken` | yes | From @BotFather |
| `env.telegram.adminIds` | yes | Array of Telegram user IDs |
| `env.paypal.webhookId` | if PayPal enabled | From PayPal Developer Dashboard |
| `env.video.signingKey` | if video content | Min 32 characters |

## Environment Variables

Config can be overridden via environment variables. Env vars take precedence over config.yaml.

```
CONFIG_PATH=/path/to/config.yaml

PORT=3001
NODE_ENV=production
DEMO_MODE=false
DEFAULT_LANGUAGE=en
FRONTEND_URL=https://example.com
HIDE_PUBLIC=false

REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret

TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=https://example.com/api/telegram/webhook
ADMIN_TELEGRAM_IDS=123456789,987654321
TELEGRAM_INIT_DATA_TTL=300

PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_MODE=live

CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_STREAM_SIGNING_KEY=...
CLOUDFLARE_CUSTOMER_SUBDOMAIN=customer-xxx.cloudflarestream.com

VIDEO_SIGNING_KEY=...
```

## Config Resolution

1. Looks for `CONFIG_PATH` env var
2. Falls back to `./config.yaml` (current working directory)
3. Falls back to `../config.yaml` (parent directory)
