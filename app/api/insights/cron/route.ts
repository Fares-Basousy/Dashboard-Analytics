import { revalidateTag } from "next/cache";
import { DATASET_TAG } from "@/lib/data/dataset";
import { INSIGHTS_TAG } from "@/lib/insights/report";
import { loadDataset } from "@/lib/connectors/registry";
import { envCredentials } from "@/lib/credentials/store";
import { detectInsights } from "@/lib/insights/rules";
import { DEFAULT_PRESET, presetRange, toISODate } from "@/lib/date-range";
import { formatMoney } from "@/lib/format";

/**
 * Proactive monitoring loop (Vercel Cron, see vercel.json):
 * re-pull all sources, re-run the rules, refresh cached pages, and push critical findings to Slack.
 * Runs without a browser session, so it uses server env credentials (see README: "Database").
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ds = await loadDataset(presetRange(DEFAULT_PRESET, toISODate(new Date())), envCredentials());
  const insights = detectInsights(ds);
  revalidateTag(DATASET_TAG, "max");
  revalidateTag(INSIGHTS_TAG, "max");

  const critical = insights.filter((i) => i.severity === "critical");
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (webhook && critical.length) {
    const text = [`*Profit alert: ${critical.length} critical finding(s)*`, ...critical.map((i) => `• ${i.title} – ${i.recommendation} (≈ ${formatMoney(i.impact, ds.currency)}/month)`)].join("\n");
    await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).catch((e) =>
      console.error("[cron] slack", e),
    );
  }

  return Response.json({ ok: true, insights: insights.length, critical: critical.length, notified: Boolean(webhook && critical.length) });
}
