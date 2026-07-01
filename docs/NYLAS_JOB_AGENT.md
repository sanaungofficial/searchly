# Nylas job-search inbox agent

Kimchi reads a **dedicated job-search Gmail/Outlook** (recommended for money-back clients) and updates the pipeline from application emails and calendar invites.

## User flow

1. User creates a dedicated job-search mailbox (e.g. `firstname.jobs@gmail.com`).
2. Profile → **Preferences** → **Connect Gmail** or **Connect Outlook**.
3. Agent is **on by default**; users can opt out under Agent settings.
4. High-confidence signals auto-update pipeline stages; all activity is logged.

## Nylas dashboard setup

In [Nylas Dashboard](https://dashboard.nylas.com) for the Kimchi app:

### Hosted OAuth (user inboxes)

1. **Hosted Authentication → Identity providers** — enable Google and Microsoft.
2. **Redirect URI** — ensure `https://kimchi.so/api/nylas/callback` is registered (keep `https://app.kimchi.so/api/nylas/callback` during transition if needed).
3. **Scopes** — enable email read and calendar read for connected accounts (Gmail readonly + Calendar readonly).

### Webhooks

Subscribe at `https://kimchi.so/api/webhooks/nylas`:

- `message.created`, `message.updated`
- `event.created`, `event.updated`
- Existing booking events (`booking.*`)

### Kimchi Agent Account (system mailbox)

1. Register domain (e.g. `kimchi.so`) under Agent Accounts.
2. Set env vars on Vercel production:
   - `KIMCHI_AGENT_EMAIL=assistant@kimchi.so` (or similar)
   - `KIMCHI_AGENT_DISPLAY_NAME=Kimchi` (optional)
3. Provision via admin: `POST /api/admin/kimchi-agent` (admin session required).

## Env vars

| Variable | Purpose |
|----------|---------|
| `NYLAS_API_KEY` | API key (includes Smart Compose when enabled on your Nylas app) |
| `NYLAS_CLIENT_ID` | OAuth client |
| `NYLAS_WEBHOOK_SECRET` | Webhook HMAC |
| `NYLAS_OAUTH_APP_URL` | `https://kimchi.so` |
| `KIMCHI_AGENT_EMAIL` | Nylas Agent Account address |
| `CRON_SECRET` | Cron auth for `/api/cron/email-agent-sync` |

## API routes

| Route | Purpose |
|-------|---------|
| `GET /api/nylas/user/connect?provider=google\|microsoft` | Start OAuth |
| `GET /api/nylas/user/status` | Connection + agent settings |
| `POST /api/nylas/user/disconnect` | Revoke grant |
| `PATCH /api/user/job-agent/settings` | Opt out / auto-apply toggles |
| `GET /api/user/job-agent/activity` | Recent agent log |
| `POST /api/cron/email-agent-sync` | Poll all connected inboxes (every 15 min) |

## Dev note

Email classification, draft replies, and interview prep use **Nylas Smart Compose** (hosted on Nylas — no Anthropic key). Requires `NYLAS_API_KEY` and Smart Compose enabled on your Nylas application. Users must connect Gmail/Outlook with inbox scopes; reconnect if Smart Compose returns scope errors.
