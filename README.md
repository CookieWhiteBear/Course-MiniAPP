# CourseGlobal

Telegram MiniApp platform for selling and delivering online courses. Features PayPal and Telegram Stars payments, Cloudflare Stream video support, and a fully customizable admin dashboard.

## Features

- **Telegram MiniApp** - Native integration with Telegram WebApp API
- **Two Payment Methods** - PayPal and Telegram Stars
- **Video Streaming** - Cloudflare Stream with signed URLs
- **Interactive Quizzes** - Single/multiple choice with remedial content
- **Admin Dashboard** - User management, analytics, support chat
- **Localization** - English, Russian, Ukrainian
- **Demo Mode** - Full functionality without Telegram for development

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Framer Motion

**Backend:** Express.js, TypeScript, SQLite, Redis (optional)

**Integrations:** Telegram Bot API, PayPal REST API, Cloudflare Stream

## Quick Start

### Requirements

- Node.js >= 20.0.0
- npm or pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/course-global.git
cd course-global

# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### Development

```bash
# Interactive CLI - select mode with arrow keys
npm run dev:cli
```

Or run directly:

```bash
npm run dev:cli demo    # Demo mode (no Telegram required)
npm run dev:cli dev     # Dev mode (requires Telegram auth)
```

This starts both frontend (port 5173) and backend (port 3001) simultaneously.

Open http://localhost:5173 - demo mode runs without Telegram.

### Production Build

```bash
# Build frontend
npm run build

# Build server
cd server
npm run build

# Or use combined build script
npm run build:deploy
```

## Configuration

All configuration is in `config.yaml` at project root.

### Minimal Config

```yaml
app:
  name: My Course Platform
  defaultCurrency: USD

env:
  port: 3001
  nodeEnv: production
  demoMode: false
  frontendUrl: https://your-domain.com

  telegram:
    botToken: "your-bot-token"
    adminIds: [123456789]

  paypal:
    clientId: "your-client-id"
    secret: "your-secret"
    webhookId: "your-webhook-id"
    mode: live

courses:
  - id: 1
    title: My First Course
    authorId: main
    price: 29.99
    starsPrice: 500
    visibility: public

authors:
  - id: main
    name: Your Name
```

See [docs/configuration.md](docs/configuration.md) for full reference.

## Course Structure

Courses are stored in the `courses/` directory:

```
courses/
├── 1/
│   ├── 1.md      # Lesson 1
│   ├── 2.md      # Lesson 2
│   └── 3.md      # Quiz
├── 2/
│   └── ...
```

### Lesson Types

**Text lesson:**
```markdown
# Welcome to the Course

Your content here in **markdown**.
```

**Video lesson:**
```markdown
# Video Lesson

<vid:cloudflare-video-id>

Or local: <vid:video.mp4>
```

**Quiz:**
```markdown
<quiz:single>

# What is 2+2?

1. Three
2. Four
3. Five

<q:2>
```

See [docs/courses.md](docs/courses.md) for full format reference.

## Payments

### PayPal

1. Create app at [PayPal Developer](https://developer.paypal.com)
2. Add webhook URL: `https://your-domain.com/paypal-hook`
3. Subscribe to events: `PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`
4. Add credentials to `config.yaml`

### Telegram Stars

1. Enable payments in @BotFather
2. Set `starsPrice` for each course in `config.yaml`

## Deployment

### With PM2

```bash
cd server
npm run build
pm2 start dist/app.js --name course-app
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Telegram Bot Setup

1. Create bot via @BotFather
2. Set menu button: `/setmenubutton` → Web App URL
3. Register webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/webhooks/telegram"
   ```

See [docs/deployment.md](docs/deployment.md) for detailed instructions.

## Project Structure

```
├── src/                    # Frontend source
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities
│   └── locales/            # i18n translations
├── server/                 # Backend source
│   └── src/
│       ├── controllers/    # Route handlers
│       ├── services/       # Business logic
│       ├── middleware/     # Express middleware
│       └── config/         # Configuration
├── courses/                # Course content (markdown)
├── docs/                   # Documentation
└── config.yaml             # Main configuration
```

## Documentation

- [Configuration](docs/configuration.md) - config.yaml reference
- [Courses](docs/courses.md) - Content format and structure
- [API](docs/api.md) - REST endpoints
- [Frontend](docs/frontend.md) - React app architecture
- [Database](docs/database.md) - SQLite schema
- [Payments](docs/payments.md) - PayPal and Telegram Stars
- [Video](docs/video.md) - Cloudflare Stream integration
- [Deployment](docs/deployment.md) - Production setup

## Scripts

```bash
# Development (runs both frontend + backend)
npm run dev:cli       # Interactive mode selector
npm run dev:cli demo  # Demo mode directly
npm run dev:cli dev   # Dev mode directly

# Frontend only
npm run dev           # Development server
npm run demo          # Development with demo mode
npm run build         # Production build
npm run lint          # ESLint

# Server only
cd server
npm run dev           # Development with hot reload
npm run build         # Compile TypeScript
npm start             # Run production build

# Build & Deploy
npm run build:deploy  # Build frontend + server for production
```

## Environment Variables

Alternative to `config.yaml` (takes precedence):

```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com
DEMO_MODE=false

TELEGRAM_BOT_TOKEN=...
ADMIN_TELEGRAM_IDS=123456789

PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_MODE=live
```

## License

MIT
