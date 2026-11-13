/**
 * AI tools: thin wrappers over the profit engine and insight rules.
 * The model never calculates business numbers itself – it asks these tools,
 * which return exactly what the dashboard shows.
 */
import { tool } from "ai";
import { z } from "zod";
import type { Dataset, DateRange } from "@/lib/domain/types";
import { PRESETS, presetRange, previousRange, type Preset } from "@/lib/date-range";
import { round2 } from "@/lib/format";
import { campaignPerformance, categoryProfits, channelPerformance, productProfits, summarize } from "@/lib/profit/engine";
import { detectInsights } from "@/lib/insights/rules";
import type { InsightsToolResult } from "./demo-model";
import type { Translator } from "@/lib/i18n/translate";

export interface ToolContext {
  /** Translates the texts tools produce (insight titles and recommendations). */
  translator: Pick<Translator, "t">;
  /** Language the assistant must answer in, e.g. "German". */
  language: string;
  load: (range: DateRange) => Promise<Dataset>;
  today: string;
  defaultPreset: Preset;
}

const period = z.enum(Object.keys(PRESETS) as [Preset, ...Preset[]]).optional().describe("Analysis window; defaults to the period selected in the dashboard");

/** Round all numbers so tool output stays compact and readable for the model. */
const compact = <T>(v: T): T =>
  JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "number" ? (Math.abs(x) < 10 ? round2(x * 100) / 100 : round2(x)) : x)));

export function createTools(ctx: ToolContext) {
  const rangeOf = (p?: Preset) => presetRange(p ?? ctx.defaultPreset, ctx.today);
  const load = (p?: Preset) => ctx.load(rangeOf(p));

  return {
    getProfitSummary: tool({
      description: "Store-wide P&L for a period (revenue, COGS, refunds, shipping, fees, ad spend, net profit, margin, ROAS, POAS) plus the previous period for comparison.",
      inputSchema: z.object({ period }),
      execute: async ({ period: p }) => {
        const range = rangeOf(p);
        const [current, previous] = await Promise.all([ctx.load(range), ctx.load(previousRange(range))]);
        return compact({ currency: current.currency, range, current: summarize(current), previousPeriod: summarize(previous) });
      },
    }),

    getProductProfitability: tool({
      description: "Products ranked by profitability after ALL costs (COGS, refunds, shipping, payment fees, allocated ad spend). Use for 'most/least profitable products' and 'where do we lose money'.",
      inputSchema: z.object({
        period,
        sortBy: z.enum(["netProfit", "margin", "revenue", "returnRate", "adSpend"]).default("netProfit"),
        order: z.enum(["desc", "asc"]).default("desc").describe("asc = worst first"),
        limit: z.number().int().min(1).max(50).default(10),
        category: z.string().optional(),
      }),
      execute: async ({ period: p, sortBy, order, limit, category }) => {
        const ds = await load(p);
        const rows = productProfits(ds)
          .filter((r) => !category || r.category.toLowerCase() === category.toLowerCase())
          .sort((a, b) => (order === "asc" ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy]));
        return compact({ currency: ds.currency, total: rows.length, products: rows.slice(0, limit) });
      },
    }),

    getCategoryProfitability: tool({
      description: "Profit breakdown per product category.",
      inputSchema: z.object({ period }),
      execute: async ({ period: p }) => {
        const ds = await load(p);
        return compact({ currency: ds.currency, categories: categoryProfits(productProfits(ds)).sort((a, b) => b.netProfit - a.netProfit) });
      },
    }),

    getMarketingPerformance: tool({
      description: "Ad performance per channel and per campaign with ROAS and POAS (profit on ad spend; POAS < 1 = campaign loses money). Use for budget questions.",
      inputSchema: z.object({ period, channel: z.enum(["google_ads", "meta", "tiktok"]).optional() }),
      execute: async ({ period: p, channel }) => {
        const ds = await load(p);
        const campaigns = campaignPerformance(ds).filter((c) => !channel || c.channel === channel);
        return compact({ currency: ds.currency, channels: channelPerformance(campaigns), campaigns: campaigns.sort((a, b) => a.poas - b.poas) });
      },
    }),

    getInsights: tool({
      description: "Automatically detected problems and opportunities with evidence, concrete recommendation and estimated monthly impact. Use for 'what should we do', 'where are we losing money', 'which budgets to optimize'.",
      inputSchema: z.object({ period }),
      execute: async ({ period: p }): Promise<InsightsToolResult> => {
        const ds = await load(p);
        return compact({ currency: ds.currency, insights: detectInsights(ds, ctx.translator) });
      },
    }),

    getDataSources: tool({
      description: "Which data sources are connected (live), running on demo data (mock), or planned.",
      inputSchema: z.object({}),
      execute: async () => (await load()).sources,
    }),
  };
}

export function systemPrompt(ctx: Pick<ToolContext, "today" | "defaultPreset" | "language">, currency: string) {
  return `You are the AI profit analyst for Ersatzteilstore, an online spare-parts shop. All money values are in ${currency}.
Today is ${ctx.today}. The user is looking at the last ${PRESETS[ctx.defaultPreset]} days unless they say otherwise.

Rules:
- Always answer in ${ctx.language}, whatever language the tool results are in. Keep product, campaign and company names as they are.
- ALWAYS get numbers from tools. Never estimate or invent figures.
- Judge profitability by net profit after all costs and by POAS (profit on ad spend), not by revenue or ROAS.
- Be concise and executive: lead with the answer, then 3–6 bullet points with concrete numbers, then clear next actions.
- When recommending, quantify the expected impact where the tools provide it.
- Format money as ${currency} 1'234. Use markdown tables only for rankings.
- If data comes from demo sources (status "mock"), you may mention it once briefly.`;
}
