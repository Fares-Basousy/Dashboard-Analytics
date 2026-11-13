import { cacheLife, cacheTag } from "next/cache";
import type { Credentials } from "@/lib/credentials/fields";
import { getDataset } from "@/lib/data/dataset";
import { presetRange, type Preset } from "@/lib/date-range";
import { summarize } from "@/lib/profit/engine";
import { detectInsights } from "./rules";
import { getModel } from "@/lib/ai/provider";
import { generateBriefing } from "@/lib/ai/briefing";

export const INSIGHTS_TAG = "insights";

/** Rule-based findings for a period. Cheap, so pages render them immediately. */
export async function getInsights(preset: Preset, today: string, creds: Credentials) {
  "use cache";
  cacheLife("hours");
  cacheTag(INSIGHTS_TAG);
  return detectInsights(await getDataset(presetRange(preset, today), creds));
}

/** AI executive briefing on top of the findings. Cached; refreshed by the cron job. Null in demo mode. */
export async function getBriefing(preset: Preset, today: string, creds: Credentials): Promise<{ text: string; model: string } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(INSIGHTS_TAG);
  const ai = getModel(creds);
  if (ai.isDemo) return null;
  const ds = await getDataset(presetRange(preset, today), creds);
  try {
    return { text: await generateBriefing(ai.model, summarize(ds), detectInsights(ds)), model: ai.label };
  } catch (err) {
    console.error("[briefing]", err);
    return null;
  }
}
