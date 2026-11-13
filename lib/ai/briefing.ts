import { generateText, type LanguageModel } from "ai";
import type { Insight } from "@/lib/domain/types";
import type { Summary } from "@/lib/profit/engine";
import { formatMoney, formatPercent, formatRatio } from "@/lib/format";

/**
 * Proactive executive briefing. The rules engine finds the issues; the model prioritises
 * and explains them in plain language. Numbers are passed in, never generated.
 */
export async function generateBriefing(model: LanguageModel, summary: Summary, insights: Insight[], currency: string): Promise<string> {
  const money = (v: number) => formatMoney(v, currency);
  const { text } = await generateText({
    model,
    system:
      "You are the profit analyst of a Swiss spare-parts e-commerce store. Write a short executive briefing in English markdown. " +
      "Use only the numbers provided. Structure: one-sentence verdict, then '### Top 3 actions this week' as a numbered list " +
      `(action, why, expected ${currency} impact per month), then one line on what is going well. Max 180 words.`,
    prompt:
      `Period summary: revenue ${money(summary.revenue)}, net profit ${money(summary.netProfit)} (margin ${formatPercent(summary.margin)}), ` +
      `ad spend ${money(summary.adSpend)}, POAS ${formatRatio(summary.poas)}, return rate ${formatPercent(summary.returnRate)}.\n\n` +
      `All money values are in ${currency}. Detected insights (JSON):\n${JSON.stringify(insights.slice(0, 12))}`,
  });
  return text;
}
