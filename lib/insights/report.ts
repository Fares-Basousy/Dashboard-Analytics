import { cacheLife, cacheTag } from "next/cache";
import type { Credentials } from "@/lib/credentials/fields";
import { getDataset } from "@/lib/data/dataset";
import { presetRange, type Preset } from "@/lib/date-range";
import { summarize } from "@/lib/profit/engine";
import { detectInsights } from "./rules";
import { getModel } from "@/lib/ai/provider";
import { generateBriefing } from "@/lib/ai/briefing";
import { LANGUAGE_NAMES, type Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";

export const INSIGHTS_TAG = "insights";

/** Rule-based findings for a period (with the currency their amounts are in). Cheap, so pages render them immediately. */
export async function getInsights(preset: Preset, today: string, creds: Credentials, locale: Locale) {
  "use cache";
  cacheLife("hours");
  cacheTag(INSIGHTS_TAG);
  const ds = await getDataset(presetRange(preset, today), creds);
  return { currency: ds.currency, insights: detectInsights(ds, await getTranslator(locale)) };
}

/** AI executive briefing on top of the findings. Cached; refreshed by the cron job. Null in demo mode. */
export async function getBriefing(preset: Preset, today: string, creds: Credentials, locale: Locale): Promise<{ text: string; model: string } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(INSIGHTS_TAG);
  const ai = getModel(creds);
  if (ai.isDemo) return null;
  const ds = await getDataset(presetRange(preset, today), creds);
  try {
    const translator = await getTranslator(locale);
    const text = await generateBriefing(ai.model, summarize(ds), detectInsights(ds, translator), ds.currency, {
      language: LANGUAGE_NAMES[locale],
      topActionsHeading: translator.t("briefing.topActions"),
    });
    return { text, model: ai.label };
  } catch (err) {
    console.error("[briefing]", err);
    return null;
  }
}
