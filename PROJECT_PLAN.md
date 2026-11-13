# AI Profit Dashboard — Project Plan

Proof of concept for Ersatzteilstore: an **AI-based profit monitoring & control system** that joins
shop data (Shopify) with marketing data (Google Ads, Meta) and answers *"where do we actually make
and lose money?"* — on demand (chat) and proactively (insights).

Stack: Next.js 16 (App Router, Cache Components), React 19, Tailwind 4, Vercel AI SDK v7
(provider-agnostic: Anthropic / OpenAI / Vercel AI Gateway), Recharts, Zod, Vitest, Playwright. Deployed on Vercel.

---

## 1. User stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-1 | Shop owner | see true profit (after COGS, refunds, shipping, payment fees, ad spend) for a date range | I know the real state of the business, not just revenue |
| US-2 | Shop owner | see every product ranked by net profit and margin | I know which products carry the business and which lose money |
| US-3 | Marketer | see spend, ROAS and **POAS** per channel and campaign | I can judge campaigns by profit, not by revenue |
| US-4 | Shop owner | ask questions in natural language ("Where are we losing money?") | I get answers without building reports |
| US-5 | Shop owner | receive proactive alerts with concrete recommendations and CHF impact | problems are found before I look for them |
| US-6 | Marketer | get budget shift recommendations | money moves from loss-making to profitable campaigns |
| US-7 | Developer | add a new data source by implementing one interface | the system grows to TikTok, GA4, Merchant Center without rewrites |
| US-8 | Reviewer | use the live demo without any credentials | I can evaluate the product immediately (mock data, clearly labelled) |
| US-9 | Admin | see which data sources are live, mocked or planned | I trust where the numbers come from |
| US-10 | Shop owner | enter my API keys in the UI, stored securely (encrypted httpOnly cookie) | I can connect accounts without touching server config |

---

## 2. Domain objects

| Object | Fields (core) | Source |
|---|---|---|
| `Product` | sku, title, category, price, unitCost | Shopify (`inventoryItem.unitCost`) |
| `Order` | id, date, lines[], shipping, shippingCost, paymentFee, channel | Shopify |
| `OrderLine` | sku, qty, unitPrice, discount | Shopify |
| `Refund` | orderId, date, sku, qty, amount | Shopify |
| `AdCampaign` | id, channel, name, type, status, sku? | Google Ads, Meta |
| `AdSpendDaily` | campaignId, date, spend, impressions, clicks, conversions, conversionValue | Google Ads, Meta |
| `Dataset` | all of the above + `sources[]` (id, status live/mock/planned) | Connector registry |
| `ProductProfit` | revenue, cogs, refunds, fees, adSpend, profit, margin, returnRate | Profit engine |
| `CampaignPerformance` | spend, revenue, attributed profit, ROAS, POAS | Profit engine |
| `Insight` | id, severity, kind (loss/opportunity/budget/trend), title, evidence, recommendation, impactChf | Insight rules |

**Profit formula**
`net profit = net revenue − COGS − refunds − shipping cost − payment fees − ad spend`
Ad spend is attributed to a SKU when the campaign targets one product (Shopping / catalog ads),
otherwise distributed by revenue share. **POAS** = gross profit attributed to campaign ÷ spend
(POAS < 1 ⇒ campaign loses money).

---

## 3. Features

- **F1 Overview** — KPI cards (revenue, net profit, margin, ad spend, POAS, return rate) with period-over-period delta; profit trend chart; top 3 insights.
- **F2 Products** — sortable profitability table, profit chart (top/bottom), loss-makers highlighted.
- **F3 Marketing** — channel summary, campaign table (spend, ROAS, POAS, profit), spend vs profit chart.
- **F4 AI Assistant** — chat drawer on every page, streaming, uses tools that call the same profit engine as the UI (no invented numbers), suggested questions.
- **F5 Proactive Insights** — rule engine detects losses/opportunities; AI writes an executive briefing; refreshed by Vercel Cron.
- **F6 Connections** — connector status page (live / mock / planned), explains how to connect.
- **F7 Extensible connectors** — `Connector` interface + registry, real clients with mock fallback.
- **F8 Key management** — settings form generated from one credential registry; keys sealed with AES-256-GCM in an httpOnly cookie, cookie overrides env; SSRF-safe format validation.

---

## 4. Architecture

```
lib/domain/types.ts        single shared schema
lib/connectors/            Connector interface, registry, shopify/, google-ads/, meta/, planned stubs
lib/mock/seed.ts           deterministic demo data (spare parts, CHF, 120 days)
lib/data/dataset.ts        one cached loader ('use cache' + cacheTag('dataset'))
lib/profit/engine.ts       pure calculations (used by UI and AI)
lib/insights/rules.ts      pure detectors -> Insight[]
lib/ai/                    provider switch, tools, system prompt, briefing, offline demo model
lib/credentials/           field registry, AES-GCM cookie store, form validation
components/ui/             Card, KpiCard, DataTable<T>, Badge, PageHeader, EmptyState
components/charts/         one chart wrapper used by every page
app/(dashboard)/           pages
app/api/chat               streaming chat
app/api/insights/cron      proactive refresh (Vercel Cron)
```

DRY rules: one schema, one data loader, one calculation engine shared by UI + AI, one generic table,
one chart wrapper, one KPI card, one page layout.

---

## 5. Milestones & tasks

### M0 — Planning
- [x] T0.1 Write project plan (this file)

### M1 — Foundation
- [x] T1.1 Install deps (AI SDK v7, providers, zod, recharts, vitest, playwright)
- [x] T1.2 Domain types (`lib/domain/types.ts`)
- [x] T1.3 Formatters, tone rules, date-range utils
- [x] T1.4 UI primitives (Card, KpiGrid, DataTable, Badge, PageHeader, Skeleton, charts)
- [x] T1.5 Dashboard shell (sidebar, period picker, chat drawer, `PageData` boundary)

### M2 — Data layer
- [x] T2.1 Connector interface + registry with real/mock/error fallback
- [x] T2.2 Deterministic mock generator with planted problems
- [x] T2.3 Shopify Admin GraphQL client + mapper
- [x] T2.4 Google Ads (GAQL searchStream) client + mapper
- [x] T2.5 Meta Marketing API client + mapper
- [x] T2.6 Planned: TikTok Ads, GA4, Merchant Center
- [x] T2.7 Cached dataset loader

### M3 — Profit engine & pages
- [x] T3.1 Profit engine (totals, per product, per campaign, per channel, timeseries)
- [x] T3.2 Overview page
- [x] T3.3 Products page
- [x] T3.4 Marketing page
- [x] T3.5 Connections & Keys page

### M4 — AI
- [x] T4.1 Provider switch (`AI_PROVIDER`, `AI_MODEL`, keys from cookie/env, demo fallback)
- [x] T4.2 AI tools over the profit engine
- [x] T4.3 Streaming chat route + chat drawer with the questions from the brief
- [x] T4.4 Insight rules (losses, scale candidates, budget shift, loss products, small orders, margin erosion)
- [x] T4.5 AI briefing + cron route (+ optional Slack alert) + Insights page

### M4.5 — Credentials (added on request)
- [x] T4.6 Credential field registry (single source for form, checks, `.env.example`)
- [x] T4.7 AES-256-GCM sealed httpOnly cookie store; cookie overrides env
- [x] T4.8 Settings form + Server Action with validation (group isolation, SSRF-safe patterns)
- [x] T4.9 `.env.example`

### M5 — Testing
- [x] T5.1 Vitest: profit engine (hand-calculated fixture)
- [x] T5.2 Vitest: insight rules (incl. planted demo problems)
- [x] T5.3 Vitest: connector mappers, registry fallback, SSRF guard
- [x] T5.4 Vitest: AI tools, demo model tool loop, provider selection
- [x] T5.5 Vitest: credentials crypto/form, `.env.example` completeness
- [x] T5.6 Playwright e2e: navigation, period switch, sorting, chat, key storage (httpOnly + encrypted)

### M6 — Review & ship
- [x] T6.1 Code review pass (fixed: SSRF via user-supplied domain, cost-share bug for free items, effect cleanup crash), lint, typecheck, build
- [x] T6.2 README (setup, architecture, security, database recommendation, how to add a connector)
- [ ] T6.3 Deploy to Vercel (+ `CREDENTIALS_SECRET`, `CRON_SECRET`, AI key), send link — **needs GitHub repo + Vercel account**

### M7 — Production (after PoC)
- [ ] T7.1 Postgres (Neon): encrypted server-side credentials so cron can use UI-entered keys
- [ ] T7.2 Daily P&L / insight history snapshots
- [ ] T7.3 Incremental sync (Shopify webhooks + nightly backfill) for the full catalogue
- [ ] T7.4 Auth + rate limiting on the chat endpoint
- [ ] T7.5 GA4, Merchant Center, TikTok connectors
