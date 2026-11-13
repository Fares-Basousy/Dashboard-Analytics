# Profit Pilot – AI Profit Dashboard

AI-based profit monitoring for e-commerce. It joins **Shopify** (orders, products, unit costs, refunds)
with **Google Ads** and **Meta Ads** (spend, conversions) into one P&L. The AI answers questions
such as *"Which products are the most profitable after all costs?"*, *"Where are we losing money?"* and
*"Which marketing budgets should we optimize?"*, and it **proactively** reports problems and opportunities
with concrete recommendations and their CHF impact.

The app works without any credentials: missing sources fall back to a realistic, deterministic
demo world (a Swiss spare-parts shop), and a missing AI key falls back to a rule-based demo assistant.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # optional – everything has a fallback
pnpm dev                     # http://localhost:3000
```

You can enter API keys in the UI (**Connections & Keys**) or set them as environment variables.

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build && pnpm start` | Run the app |
| `pnpm test` | Unit tests (Vitest): profit engine, rules, connectors, credentials, AI |
| `pnpm test:e2e` | End-to-end tests (Playwright) against a production build |
| `pnpm check` | Lint, typecheck and unit tests |

## Features

- **Overview**: revenue, net profit, margin, ad spend, POAS and return rate with period-over-period change; daily trend; a "where the money goes" breakdown; top AI findings.
- **Products**: every SKU after COGS, refunds, its share of shipping and payment fees, and allocated ad spend.
- **Marketing**: channels and campaigns ranked by **POAS** (profit on ad spend), not just ROAS.
- **AI assistant**: a chat drawer on every page. It defaults to NVIDIA `nemotron-3.5-super-vl-120b-a12b` (set `NVIDIA_API_KEY`), called with NVIDIA's recommended settings (`lib/ai/nvidia.ts`): temperature 1, top_p 0.95, max_tokens 16384, seed 42, parallel tool calls, thinking enabled. The model's reasoning appears collapsed in the chat. Anthropic, OpenAI or the Vercel AI Gateway work via env vars. The model calls typed tools over the profit engine, so every number it quotes is the number on screen.
- **AI insights**: a rule engine detects money leaks and opportunities, and the LLM writes an executive briefing. A Vercel Cron job refreshes it daily and can post critical alerts to Slack.
- **Connections & Keys**: connect sources and see their status (live / demo / planned).

## Architecture

```
Connectors ──► Dataset ──► Profit engine ──► Pages (UI)
 (Shopify,     (one         (pure functions)  └► AI tools ──► LLM chat / briefing
  Google Ads,   schema)          │
  Meta, …)                       └► Insight rules ──► Insights page, cron alerts
```

| Layer | Location | Responsibility |
|---|---|---|
| Domain | `lib/domain/types.ts` | The single shared schema |
| Connectors | `lib/connectors/*` | Fetch + map each API into the schema; fall back to mock data |
| Data | `lib/data/dataset.ts` | One cached loader (`'use cache'` + `cacheTag`) |
| Profit engine | `lib/profit/engine.ts` | Pure calculations (P&L, per product, per campaign, POAS) |
| Insights | `lib/insights/*` | Pure detection rules + cached report |
| AI | `lib/ai/*` | Provider switch, tools, system prompt, briefing, demo model |
| Credentials | `lib/credentials/*` | Field registry, encrypted cookie store, form validation |
| UI | `components/*`, `app/(dashboard)/*` | Generic table, KPI grid, charts and cards, assembled into pages |

Design principles:

- **Single source of truth.** One schema, one data loader and one engine. The UI and the AI share the same calculations.
- **Open/closed.** A new data source implements the `Connector` interface. Nothing else changes.
- **Dependency injection.** Credentials are passed explicitly into connectors and the model factory, never read globally, which keeps everything testable.
- **Pure core, thin edges.** Engine, rules, mappers and form parsing are pure functions with unit tests. I/O sits in small adapters.
- **Fail soft.** A failing API never breaks the dashboard: that source shows demo data and is flagged in the UI.

### Profit model

```
net profit = revenue − COGS − refunds − shipping cost − payment fees − ad spend
POAS       = gross profit attributed to the campaign ÷ ad spend   (POAS < 1 ⇒ the campaign loses money)
```

- Order-level costs (shipping, payment fees) are allocated to lines by revenue share.
- Ad spend from single-product campaigns goes to that SKU. Tag the campaign name with `[sku:ABC-123]` on any platform. All other spend is spread by revenue share.
- Campaign profit = platform conversion value × the gross margin ratio of the advertised SKU, or of the whole store.
- Refunded spare parts are assumed not resellable, so their COGS is kept (a conservative choice).

### Adding a data source (e.g. TikTok Ads)

1. Add its credential fields to `lib/credentials/fields.ts`. The settings form and `.env.example` test pick them up.
2. Create `lib/connectors/tiktok/{map.ts,index.ts}` implementing `Connector` (`fetch` + `mock`).
3. Replace the `planned("tiktok", …)` entry in `lib/connectors/registry.ts` with the new connector.

The UI, profit engine, insights and AI tools need no changes.

## API keys and security

- Keys entered in the UI are stored in **one cookie** that is `httpOnly` (invisible to JavaScript), `secure` in production, `sameSite=lax`, and **encrypted with AES-256-GCM** (`CREDENTIALS_SECRET`). A leaked cookie value is useless.
- Keys are only ever decrypted on the server. The UI only receives *where* a key comes from (browser / server / not set), never the value.
- Resolution order: **browser cookie, then server environment variable**.
- Fields whose values end up in outbound request URLs (Shopify domain, Google and Meta account IDs) are format-validated, both in the form and before every request, to prevent SSRF and path injection.
- Server Actions are protected against CSRF by Next.js origin checks.

## Database

**The proof of concept does not need a database.** Data is pulled live from the APIs and cached by
Next.js, and keys live in the encrypted cookie.

For production I recommend **PostgreSQL (Neon, via the Vercel Marketplace; it has a free tier and only needs `DATABASE_URL`)** to:

1. **Store credentials server-side (encrypted).** The cron job has no browser session, so it currently only sees env-var keys. Proactive monitoring with keys entered in the UI needs them stored on the server.
2. **Keep history.** Snapshots of daily P&L and insight history, so we can track whether recommendations were applied and worked.
3. **Sync incrementally.** With 20M+ articles, products and orders should be synced into the database (webhooks plus nightly backfill) instead of fetched per request.

## Environment variables

See [`.env.example`](.env.example). Every variable is optional except `CREDENTIALS_SECRET` (and `CRON_SECRET`) in production.

## Deploy (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Set `CREDENTIALS_SECRET` (`openssl rand -base64 32`), `CRON_SECRET`, and optionally an AI key and source credentials.
3. `vercel.json` schedules the daily insight job (`/api/insights/cron`).

## Known limitations / next steps

- The chat endpoint has no auth or rate limit. Add auth (or rate limiting) before exposing a server-side AI key publicly.
- Shopify refunds are taken from orders created in the selected period.
- Next steps: GA4 (funnel and conversion rate), Merchant Center (feed issues, price competitiveness), TikTok Ads, a database (see above), and alerting to email or Slack per user.
