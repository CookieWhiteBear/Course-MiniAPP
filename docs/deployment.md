# Deployment

## Requirements

- Node.js >= 20.0.0
- Redis (optional, for caching)
- Reverse proxy (nginx/caddy) recommended

## Build

```bash
# Frontend
npm install
npm run build

# Server
cd server
npm install
npm run build
```

Output:
- Frontend: `dist/`
- Server: `server/dist/`

## Production Config

Create `config.yaml` at project root:

```yaml
env:
  nodeEnv: production
  demoMode: false
  frontendUrl: https://your-domain.com

  redis:
    enabled: true
    host: localhost
    port: 6379

  telegram:
    botToken: "your-bot-token"
    webhookUrl: https://your-domain.com/api/webhooks/telegram
    adminIds: [your-telegram-id]

  paypal:
    clientId: "live-client-id"
    secret: "live-secret"
    webhookId: "webhook-id"
    mode: live

  video:
    signingKey: "random-32-char-string"

  cloudflare:
    accountId: "..."
    apiToken: "..."
    signingKey: "..."
    customerSubdomain: "customer-xxx.cloudflarestream.com"
```

## Start Server

```bash
cd server
npm start
```

Or with PM2:
```bash
cd server
pm2 start dist/app.js --name course-app
```

Or directly:
```bash
NODE_ENV=production node server/dist/app.js
```

## Nginx Config

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Telegram Bot Setup

1. Create bot via @BotFather
2. Set menu button:
   ```
   /setmenubutton
   Select bot → Web App URL → https://your-domain.com
   ```
3. Register webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/webhooks/telegram"
   ```

## PayPal Webhook

Add webhook URL in PayPal Developer Dashboard:
```
https://your-domain.com/paypal-hook
```

Events to subscribe:
- PAYMENT.CAPTURE.COMPLETED
- PAYMENT.CAPTURE.DENIED
- PAYMENT.CAPTURE.REFUNDED
- CHECKOUT.ORDER.APPROVED

Note: PayPal webhook is at root `/paypal-hook`, not under `/api`.

## Health Check

```bash
curl https://your-domain.com/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": "...",
  "memory": { ... },
  "nodeVersion": "...",
  "env": "production"
}
```

## Pterodactyl

For Pterodactyl panel deployment:
- Server binds to `0.0.0.0`
- Set allocation port in panel
- Server reads from `SERVER_PORT` or `PORT` env var

## Directory Structure (Production)

```
/app/
├── server/
│   └── dist/       # Compiled server
├── dist/           # Built frontend (server serves from public/)
├── data/
│   └── database.sqlite
├── courses/
│   ├── 1/
│   ├── 2/
│   └── ...
├── config.yaml
└── package.json
```

Server serves static files from `public/` directory. Copy frontend build there:

```bash
cp -r dist/* server/dist/public/
```

Or use build script:
```bash
npm run build:deploy
```

## Environment Variables

Alternative to config.yaml (higher priority):

```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com
DEMO_MODE=false

REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

TELEGRAM_BOT_TOKEN=...
ADMIN_TELEGRAM_IDS=123456789

PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_MODE=live

VIDEO_SIGNING_KEY=...
```
