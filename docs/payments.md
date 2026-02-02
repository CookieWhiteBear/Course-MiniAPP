# Payments

Two payment methods: PayPal and Telegram Stars.

## PayPal

### Setup

1. Create app at https://developer.paypal.com
2. Get Client ID and Secret
3. Create webhook with events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `CHECKOUT.ORDER.APPROVED`
4. Add to config:

```yaml
env:
  paypal:
    clientId: "..."
    secret: "..."
    webhookId: "..."
    mode: sandbox | live
```

### Flow

1. User clicks "Buy" → `POST /api/purchase/create`
2. Server creates PayPal order
3. User redirected to PayPal
4. User approves payment
5. PayPal sends webhook to `/paypal-hook`
6. Server verifies signature, grants access

### Webhook URL

Production: `https://your-domain.com/paypal-hook`

Note: Webhook is at root, not under `/api`.

## Telegram Stars

### Setup

1. Enable payments in @BotFather
2. Configure bot token in config

```yaml
env:
  telegram:
    botToken: "..."
```

### Flow

1. User clicks "Buy with Stars" → `POST /api/purchase/telegram-stars`
2. Server creates invoice link
3. User pays in Telegram
4. Telegram sends payment notification to bot
5. Server grants access

### Price

Set `starsPrice` in `config.yaml` under courses. Must be a positive integer.

```yaml
courses:
  - id: 1
    starsPrice: 100
```

Currency for Stars transactions: `XTR` (Telegram Stars token).

## Transaction Statuses

| Status | Description |
|--------|-------------|
| `pending` | Order created, waiting for payment |
| `success` | Payment confirmed, access granted |
| `failed` | Payment failed or denied |
| `refunded` | Payment refunded, access revoked |

## Refunds

PayPal refunds are handled automatically via webhook. Access is revoked when `PAYMENT.CAPTURE.REFUNDED` event received.

Telegram Stars refunds must be processed manually in Telegram.
