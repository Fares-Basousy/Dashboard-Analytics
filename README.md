# Profit Pilot: AI Profit Dashboard

**An AI monitoring and control system that shows an online store's *real* profitability.**

Profit Pilot joins shop data (**Shopify**) with marketing data (**Google Ads**, **Meta Ads**) into one
profit and loss statement (P&L). Every number is calculated **after all costs**: product cost, refunds,
shipping, payment fees and ad spend. On top of that sits an AI analyst that:

- **answers questions** in plain language, such as *"Which products are the most profitable after deducting all costs?"*, *"Where are we currently losing money?"* or *"Which marketing budgets should we optimize?"*
- **finds problems and opportunities proactively** and gives concrete recommendations with an estimated monthly impact.

The app works without any credentials. Missing sources fall back to a realistic demo shop (a Swiss
spare-parts store), and a missing AI key falls back to a rule-based assistant. Anyone can try it right away.

> **Live demo:** _<add your Vercel URL here>_

---

## Contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Quick start](#quick-start)
4. [Configuration](#configuration)
5. [Connecting data sources and the AI](#connecting-data-sources-and-the-ai)
6. [How it works](#how-it-works)
   - [Languages (English, Swedish, German)](#languages-english-swedish-german)
7. [Project structure](#project-structure)
8. [Testing](#testing)
9. [Deployment (Vercel)](#deployment-vercel)
10. [Security](#security)
11. [Extending the system](#extending-the-system)
12. [Troubleshooting](#troubleshooting)
13. [Roadmap and known limitations](#roadmap-and-known-limitations)

---

## Features

| Page | What you get |
|---|---|
| **Overview** | KPIs (revenue, net profit, net margin, ad spend, POAS, return rate) with change against the previous period, a daily trend chart, a "where the money goes" cost breakdown, the top AI findings, and channel performance. |
| **Products** | Every product after COGS (product cost), refunds, its share of shipping and payment fees, and its share of ad spend. Includes the most and least profitable products, a category summary, and a sortable table. |
| **Marketing** | Channels and campaigns judged by **POAS** (profit on ad spend), not only ROAS (revenue on ad spend). Loss-making campaigns are highlighted. |
| **AI Insights** | Automatically detected money leaks and opportunities, each with evidence, a recommendation and its estimated monthly impact, plus an AI-written executive briefing. |
| **AI Assistant** | A chat drawer on every page. It answers from live data using the same calculations as the pages, and shows the model's reasoning. |
| **Connections & Keys** | Connect sources and the AI model from the UI, see each source's status (connected / demo data / planned), and fill a Shopify dev store with test data from a button, with live progress notifications. |

Also included:

- **Three languages:** English, Swedish and German, switched from the nav bar. The page, the AI chat, the AI briefing and the insight texts follow the chosen language. Texts that have no translation yet are translated by the AI automatically. See [Languages](#languages-english-swedish-german).
- **Period selector:** last 7, 30 or 90 days, kept while you move between pages.
- **Proactive monitoring:** a daily job (Vercel Cron) re-pulls all data, refreshes the insights, and can post critical findings to Slack.
- **Shop currency:** money is shown in the shop's own currency, read from Shopify.
- **Fails soft:** if a source's API fails, the dashboard still works. That source shows demo data and a warning banner.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS 4 (design tokens, light and dark mode) |
| AI | Vercel AI SDK v7, provider-agnostic. Default model: NVIDIA `nemotron-3.5-super-vl-120b-a12b`; Anthropic, OpenAI and the Vercel AI Gateway also work |
| Charts | Recharts |
| Languages | Next.js `[lang]` routing + `next/root-params` + `proxy.ts`, typed dictionaries, AI fallback for missing translations (no i18n library) |
| Validation | Zod |
| Tests | Vitest (unit), Playwright (end-to-end) |
| Hosting | Vercel (with Vercel Cron) |

## Quick start

**Requirements:** Node.js 20.9 or newer (22 recommended) and pnpm.

```bash
pnpm install
cp .env.example .env.local   # optional: everything has a fallback
pnpm dev                     # open http://localhost:3000 (redirects to /en, /sv or /de)
```

Without any configuration you'll see the demo shop and the rule-based assistant. To use real data, add
keys in `.env.local` or on the **Connections & Keys** page. See [Configuration](#configuration).

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright) against a production build |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm check` | Lint, typecheck and unit tests together |
| `pnpm seed:shopify` | Fill a Shopify **dev** store with test products, orders and refunds; the same as the button in Settings (see [Shopify](#shopify)). Never runs on install or deploy. |

## Configuration

All settings come from environment variables (see [`.env.example`](.env.example)). API keys can also be
entered in the UI. **Keys saved in the browser override environment variables.**

| Variable | Required | Purpose |
|---|---|---|
| `CREDENTIALS_SECRET` | **Yes, in production** | Encrypts the cookie that stores UI-entered keys. Generate it with `openssl rand -base64 32`. |
| `CRON_SECRET` | **Yes, in production** | Protects `/api/insights/cron`. Vercel Cron sends it automatically. |
| `NVIDIA_API_KEY` | No | AI model (default provider). |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` | No | Alternative AI providers. |
| `AI_PROVIDER` / `AI_MODEL` | No | Force a provider (`nvidia`, `anthropic`, `openai`, `gateway`, `demo`) and/or a model. |
| `SHOPIFY_STORE_DOMAIN` | For Shopify | e.g. `your-store.myshopify.com` (a pasted URL is accepted). |
| `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | For Shopify | Dev Dashboard app credentials (current method). |
| `SHOPIFY_ADMIN_TOKEN` | No | Only for legacy custom apps created before 2026. |
| `GOOGLE_ADS_*` | For Google Ads | Developer token, OAuth client ID/secret, refresh token, customer ID, optional manager (MCC) ID. |
| `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` | For Meta Ads | System-user token with `ads_read`; ad account `act_…`. |
| `SHIPPING_COST_PER_ORDER` | No (default 6.5) | What the shop pays the carrier per order. |
| `PAYMENT_FEE_PCT` / `PAYMENT_FEE_FIXED` | No (default 0.029 / 0.3) | Payment fee estimate when the gateway doesn't report real fees. |
| `SLACK_WEBHOOK_URL` | No | The daily job posts critical findings here. |

## Connecting data sources and the AI

### AI model (NVIDIA Nemotron, default)

1. Create a free API key at [build.nvidia.com](https://build.nvidia.com). It starts with `nvapi-`.
2. Set `NVIDIA_API_KEY`, or enter it on **Connections & Keys**.

The model is called with NVIDIA's recommended settings (`lib/ai/nvidia.ts`): temperature 1, top_p 0.95,
max_tokens 16384, seed 42, parallel tool calls, and thinking enabled. The model's reasoning appears,
collapsed, in the chat. To use another provider, set its key, plus optionally `AI_PROVIDER` and `AI_MODEL`.

### Shopify

Since January 2026, Shopify doesn't allow new custom apps to be created in the store admin. Apps are
created in the **Dev Dashboard** and use the **client credentials grant**: the app exchanges its client
ID and secret for an access token that lasts 24 hours. Profit Pilot fetches and renews that token
automatically (`lib/connectors/shopify/auth.ts`).

1. On [dev.shopify.com](https://dev.shopify.com), create a **dev store** (it must be in the same organization as the app).
2. Add products with a **Price** and a **Cost per item** (Pricing section), and create some orders, e.g. draft orders marked as paid. Refund one or two. Or let the [test-data seed](#filling-a-dev-store-with-test-data) do all of this.
3. Create an app with the scopes `read_orders`, `read_products` and `read_inventory` (plus `write_products` and `write_orders` while you use the seed), **release** a version, and **install** it on the store.
4. Copy the **Client ID** and **Client secret** from the app's Settings into `.env.local` or **Connections & Keys**, along with the store domain.

Products without a SKU are identified by their Shopify variant ID. Shops whose prices include tax
(common in Switzerland and the EU) are handled: the VAT inside sale prices and refunds is never counted as
revenue. Orders are dated by `processedAt`, the business date, which is also correct for imported orders.

#### Filling a dev store with test data

The seed creates the demo spare-parts catalogue (SKUs and cost per item), orders with Swiss VAT included,
spread over the last 30 days, and refunds (high-return products are refunded more often). It runs **only
when you start it**, never on install or deploy. There are two ways to start it:

- **Button:** **Connections & Keys → Test data → Generate test data** (5, 10 or 15 orders). A notification in
  the bottom-left corner shows the status: *Pending* (checking the store, preparing products), *Seeding x/y*
  (orders being created), then *Done* or *Seeding failed* with the reason. The dashboard refreshes when it's done.
- **CLI:** `pnpm seed:shopify [--orders 15] [--days 30]` with the Shopify variables in `.env.local`. Use this for larger runs.

How it works: `lib/seed/shopify-seed.ts` holds the logic and reports progress events. `POST /api/seed` streams
them as NDJSON (one JSON object per line) to the button. `scripts/seed-shopify.ts` prints them.

Rules: it needs the extra app scopes `write_products` and `write_orders`, **refuses any store that isn't a
development store**, reuses products that already exist, and runs one seed at a time. Dev stores accept at most
5 new orders per minute, so orders are paced (about 13 seconds each), and a button run is capped at 15 orders to fit
the 300-second serverless limit. Remove the write scopes when you're done: the dashboard itself only reads.

### Google Ads

You need a developer token (from a manager account's API Center), an OAuth client (Google Cloud), a
refresh token with the `adwords` scope, and the customer ID. A test-access developer token only works with
test accounts, and those return no real metrics. Real data needs "Basic access" approval from Google.

### Meta Ads

You need a system-user access token with `ads_read` and the ad account ID (`act_…`).

### Tying a campaign to one product

Put `[sku:ABC-123]` (or the variant key shown on the Products page) in the campaign name on any ad
platform. That campaign's spend is then charged to that product. All other spend is spread across
products by revenue share.

## How it works

### Data flow

```
                ┌──────────────┐
 Shopify ──────►│              │      ┌────────────────┐     ┌──────────────────────────┐
 Google Ads ───►│  Connectors  ├─────►│ Dataset        ├────►│ Profit engine (pure)     ├──► Pages
 Meta Ads ─────►│  (real API   │      │ one schema,    │     │ P&L, products, campaigns,│
 TikTok / GA4 ─►│  or demo)    │      │ cached         │     │ POAS, daily series       ├──► AI tools ──► Chat / Briefing
 (planned)      └──────────────┘      └────────────────┘     └───────────┬──────────────┘
                                                                         └──► Insight rules ──► Insights page, Slack
```

1. **Connectors** (`lib/connectors/*`) fetch each API and map the result into **one shared schema** (`lib/domain/types.ts`). A source without credentials returns demo data. A source whose API fails returns demo data and is flagged "API error".
2. The **dataset loader** (`lib/data/dataset.ts`) merges all sources and caches the result per period and set of credentials (`'use cache'`, refreshed by the cron job through a cache tag).
3. The **profit engine** (`lib/profit/engine.ts`) is a set of pure functions over the dataset. Pages and the AI both use it, so the AI quotes exactly the numbers on screen.
4. **Insight rules** (`lib/insights/rules.ts`) scan the engine output for problems and opportunities.
5. The **AI** (`lib/ai/*`) never calculates business numbers itself. It calls typed tools that wrap the engine and the rules.

### Profit model

```
net profit = revenue − COGS − refunds − shipping cost − payment fees − ad spend
POAS       = gross profit from the campaign's conversions ÷ ad spend      (POAS < 1 ⇒ the campaign loses money)
```

- **Order costs** (shipping, payment fees) are split across an order's lines by revenue share.
- **Ad spend** goes to the advertised product when the campaign is tied to one (`[sku:…]`); otherwise it's split by revenue share.
- **Campaign profit** = the platform's conversion value × the gross margin of the advertised product (or of the whole store).
- **Refunded items** are assumed not resellable, so their product cost is kept. This is a conservative choice for spare parts.
- **Payment fees:** real Shopify Payments fees when available, otherwise `PAYMENT_FEE_PCT` and `PAYMENT_FEE_FIXED`.

### Insight rules

| Rule | Detects | Recommends |
|---|---|---|
| Losing campaigns | POAS < 1 | Pause, rebuild, or cut the budget, depending on how bad it is and whether the product itself loses money |
| Scale candidates | POAS ≥ 2 | Raise the budget by 20–30% and watch POAS |
| Budget shift | Losers and winners at the same time | Move budget from losing to winning campaigns, step by step |
| Unprofitable products | Net loss after all costs | Fix quality or listing (high returns), or raise the price or renegotiate cost |
| Small orders | Many orders lose money before ads | A small-order surcharge or minimum order value |
| Margin erosion | A category's margin dropped in the second half of the period | Review discounts and purchase prices |

Each finding has evidence, a recommendation, an **estimated monthly impact**, and a severity
(critical / warning / info).

### AI assistant

The chat (`app/api/chat/route.ts`) streams answers and runs a tool loop of up to 6 steps. The tools are:

| Tool | Returns |
|---|---|
| `getProfitSummary` | Store P&L for a period and the previous period |
| `getProductProfitability` | Products ranked by net profit, margin, revenue, return rate or ad spend |
| `getCategoryProfitability` | Profit per category |
| `getMarketingPerformance` | Channels and campaigns with ROAS and POAS |
| `getInsights` | The detected findings and recommendations |
| `getDataSources` | Which sources are live, demo or planned |

Without an AI key, a built-in **demo model** (`lib/ai/demo-model.ts`) runs the same tool loop and answers
from the insight rules. The chat always works, and the end-to-end tests are deterministic.

### Languages (English, Swedish, German)

Pick a language in the nav bar (**EN / SV / DE**). You stay on the same page and period, and the choice is remembered.

**URLs.** Every page has a language prefix: `/en/products`, `/sv/products`, `/de/products`. All three are
prerendered. A URL without a language (`/`, `/products`) is redirected by `proxy.ts`: to the language
you last picked (`NEXT_LOCALE` cookie), otherwise to your browser's language (`Accept-Language`),
otherwise English. Unsupported languages return 404.

**Texts.** All UI text lives in typed dictionaries in `lib/i18n/messages/`:
- `en.ts` is the source of truth. Every text has a key, e.g. `"nav.products": "Products"`.
- `sv.ts` and `de.ts` hold hand-written translations of those keys.
- Names and numbers are never part of a text. They sit in `{placeholders}` (e.g. `"„{name}“ verliert Geld"`) and are filled in at the end.

**AI translation of missing texts.** If a key has no Swedish or German translation (for example, a text
added later), the AI translates it automatically (`lib/i18n/resolve.ts` and `ai-translate.ts`):
1. All missing English texts for that language are sent to the AI model **in one batch**, with instructions to keep `{placeholders}` and not to translate names, currency codes or metrics (POAS, ROAS, COGS, SKU).
2. A translation is only accepted if it is non-empty and has **exactly the same placeholders** as the English text. Otherwise the English text is used, so a bad translation can never break a sentence or alter a name.
3. The result is cached for days and shared by all pages and visitors. The AI is called once per language, not per visit.
4. Without an AI key (or if the AI fails), missing texts are shown in English. The app never breaks.

Product, campaign, category and shop names come from the data and are always shown as they are.

**What follows the language:**
- **Pages, tables, charts, KPIs, the settings form and server messages:** these come from the dictionaries.
- **Insight titles, evidence and recommendations:** the rules write them from dictionary templates, with names and numbers as placeholders.
- **AI chat and executive briefing:** the model is told to answer in the selected language. The offline demo assistant uses the dictionaries.
- **Seeding notifications:** the progress events carry data, and the browser words them in the selected language.

### Caching and proactive monitoring

- Data and insights are cached for hours, per period and set of credentials.
- `vercel.json` schedules `GET /api/insights/cron` every day at 05:00 UTC. It re-pulls all sources, re-runs the rules, refreshes the cache, and posts critical findings to Slack if `SLACK_WEBHOOK_URL` is set.

### Design principles

- **Single source of truth:** one schema, one data loader, one engine, shared by the UI and the AI.
- **Open/closed:** a new data source implements the `Connector` interface; nothing else changes.
- **Dependency injection:** credentials are passed explicitly into connectors and the model, never read globally, which keeps everything testable.
- **Pure core, thin edges:** engine, rules, mappers and form parsing are pure functions with unit tests. Network code sits in small adapters.
- **Reusable UI:** one table, one KPI grid, one chart style, and one page pattern (`PageData`), all driven by configuration.

## Project structure

```
proxy.ts                  redirects URLs without a language to /en, /sv or /de
app/
  [lang]/layout.tsx       root layout: <html lang>, prerenders en/sv/de, provides texts to client components
  [lang]/(dashboard)/     pages: overview, products, marketing, insights, settings (+ Server Action)
  api/chat/               streaming AI chat
  api/insights/cron/      daily proactive job
  api/seed/               streams Shopify test-data seeding progress
components/
  ui/                     Card, KpiGrid, DataTable, Badge, PageHeader, Skeleton
  charts/                 TrendChart, RankedBarChart, shared chart theme
  ui/Toast                notification used for seeding progress
  I18nProvider, LanguageSwitcher   texts for client components, EN/SV/DE switch in the nav
  ChatPanel, CredentialForm, SeedPanel, KeysExplainer, InsightCard, ProfitBreakdown, DataSourceNotice, PageData, Sidebar, DateRangePicker
lib/
  domain/types.ts         the shared schema
  connectors/             Connector interface, registry, shopify/, google-ads/, meta/
  data/dataset.ts         cached data loader
  profit/engine.ts        profit calculations
  insights/               rules + cached report
  ai/                     provider switch, NVIDIA setup, tools, briefing, demo model
  credentials/            field registry, encrypted cookie store, form validation
  mock/seed.ts            deterministic demo shop
  seed/shopify-seed.ts    fills a Shopify dev store with test data (button + CLI); seed/messages.ts words its events
  i18n/                   languages: config, messages/{en,sv,de}.ts, translator, AI fallback (resolve.ts, ai-translate.ts),
                          server.ts (cached texts per language), page.ts (current language via next/root-params)
  format.ts, date-range.ts, tone.ts, kpis.ts, config.ts, …
scripts/
  seed-shopify.ts         CLI for the Shopify test-data seed
tests/
  unit/                   Vitest
  e2e/                    Playwright
  fixtures/               small hand-calculated dataset
```

## Testing

```bash
pnpm test        # unit tests
pnpm test:e2e    # end-to-end (builds and starts the app on port 3300)
```

- **Unit (Vitest):** the profit engine against a hand-calculated example; insight rules, including the problems planted in the demo shop; every connector mapper (Shopify, Google Ads, Meta) against API-shaped fixtures; Shopify token exchange, token caching and pagination; the registry's fallback and error behaviour; cookie encryption; form validation (including SSRF attempts); `.env.example` completeness; AI tools returning engine numbers; the demo model's tool loop; provider selection; the exact NVIDIA request format; VAT removal on sales and refunds; the Shopify seed (dev-store guard, missing scopes, progress events, VAT-inclusive backdated orders, reuse of existing products, stopping when cancelled); languages (every Swedish and German text keeps the English placeholders, AI fallback accepted only with intact placeholders, English fallback when the AI fails, browser-language and cookie selection, insights translated while names stay unchanged).
- **End-to-end (Playwright):** navigation, switching periods, table sorting, the AI chat, storing keys (the cookie is httpOnly, encrypted, and never sent back to the page), the test-data button and API (disabled without Shopify, input validation, a clean error stream), and languages (browser-language redirect, switching in the nav while keeping the page and period, the remembered choice, the AI answering in German, translated server messages, 404 for unsupported languages).
- E2E tests clear all credentials, so they always run on demo data, even with a local `.env.local`.

## Deployment (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Set the environment variables: at least `CREDENTIALS_SECRET` and `CRON_SECRET`; plus `NVIDIA_API_KEY` for the real AI, and the Shopify variables for live shop data.
3. Deploy. `vercel.json` registers the daily cron job.

Environment variables only apply to new deployments, so redeploy after changing them.

## Security

- **Keys entered in the UI** are stored in one cookie that is `httpOnly` (JavaScript can't read it), `secure` in production, `sameSite=lax`, and **encrypted with AES-256-GCM**. A leaked cookie value is useless without `CREDENTIALS_SECRET`.
- **Secrets never reach the browser.** The settings page only shows *where* a key comes from: browser, server, or not set.
- **SSRF protection:** values that end up in request URLs (Shopify domain, Google and Meta account IDs) are format-checked, in the form and again before every request. SSRF means tricking the server into calling an address it shouldn't.
- **CSRF protection** for Server Actions comes from Next.js origin checks.
- **Cron endpoint** is protected by `CRON_SECRET`.
- **Test-data seeding** only writes to Shopify **development** stores (checked through the API before any write), needs explicit write scopes, validates its input, and runs one seed at a time.

## Extending the system

**Add a data source** (e.g. TikTok Ads):
1. Add its credential fields to `lib/credentials/fields.ts`. The settings form, validation and `.env.example` test pick them up.
2. Create `lib/connectors/tiktok/map.ts` (pure mapping into the schema) and `index.ts` (implements `Connector`: `fetch` and `mock`).
3. Swap the `planned("tiktok", …)` entry in `lib/connectors/registry.ts` for the new connector.

The UI, the profit engine, the insights and the AI tools need no changes.

**Add an insight rule:** add a detector in `lib/insights/rules.ts` that returns `Insight` objects. It
appears on the Insights page, in the AI's `getInsights` tool, and in the cron alerts automatically.

**Add an AI tool:** add it to `createTools` in `lib/ai/tools.ts`, wrapping an engine function.

**Add or change a text:** add the key to `lib/i18n/messages/en.ts` and use `t("your.key")`. Add the
Swedish and German texts to `sv.ts` and `de.ts`. If you don't, the AI translates them on first use. A unit
test checks that every translation keeps the English `{placeholders}`.

**Add a language** (e.g. French): add `"fr"` to `LOCALES` (and its names) in `lib/i18n/config.ts`, create
`messages/fr.ts` (it can start empty; the AI fills it), and register it in `lib/i18n/server.ts`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Demo data for Shopify…" banner | Shopify credentials are incomplete. Check domain, client ID and secret. |
| "API error – showing demo data" | The source rejected the request. Check the app is **installed** on the store and has the scopes; check the server log line `[connector:…]`. |
| Margins look too high, COGS is 0 | Products have no **Cost per item** in Shopify. That's a different field from *Price*. |
| No returns showing | Refunds must be completed in Shopify (order status "Partially refunded" or "Refunded"). |
| New orders don't appear | Data is cached for hours. Wait, call the cron endpoint, or restart the dev server. |
| Chat says "Demo mode" | No AI key is set. Add `NVIDIA_API_KEY` (or another provider). |
| Saving keys fails in production | `CREDENTIALS_SECRET` isn't set. |
| Some Swedish/German texts appear in English | The text has no translation and no AI key is set on the server, or the AI translation was rejected (placeholders changed). Add the text to `sv.ts`/`de.ts`, or set `NVIDIA_API_KEY`. |

## Roadmap and known limitations

**Next steps**
- **Database (Postgres on Neon):** store keys encrypted on the server so the daily job can use keys entered in the UI; keep a history of P&L and insights; sync data incrementally instead of fetching per request (needed for a 20M+ article catalogue).
- **More sources:** GA4 (traffic, funnel, conversion rate), Google Merchant Center (feed issues, price competitiveness), TikTok Ads.
- **Alerts** per user by email or Slack.

**Known limitations**
- The chat endpoint has no login or rate limit. Add one before sharing a deployment that has a paid AI key.
- Shopify refunds are counted for orders created in the selected period.
- Orders older than 60 days need Shopify's `read_all_orders` scope.
- Numbers and money use Swiss formatting (`1'234`) in every language.
- Technical error messages from Shopify (e.g. in seeding notifications) are shown as Shopify sends them, in English.
- AI translations of missing texts use the server's AI key (keys saved in a browser aren't used), because the result is shared by all visitors.
- Ad platforms reporting in a different currency than the shop aren't converted.
- The Google Ads connector hasn't been run against the live API yet (no API access).
