import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "./config";
import { en, type Messages } from "./messages/en";
import { de } from "./messages/de";
import { sv } from "./messages/sv";
import { resolveMessages } from "./resolve";
import { aiTranslateBatch } from "./ai-translate";
import { createTranslator, type Translator } from "./translate";

const TRANSLATIONS: Record<Locale, Partial<Messages>> = { en, sv, de };

export const I18N_TAG = "i18n";

/**
 * All texts for a language. Missing translations are filled by the AI once, then cached and shared
 * by every page and visitor (works in Route Handlers and Server Actions too – pass the locale).
 */
export async function getMessages(locale: Locale): Promise<Messages> {
  "use cache";
  cacheLife("days");
  cacheTag(I18N_TAG);
  const { messages, aiTranslated } = await resolveMessages(locale, TRANSLATIONS[locale], aiTranslateBatch);
  if (aiTranslated.length) console.info(`[i18n] AI-translated ${aiTranslated.length} text(s) to ${locale}: ${aiTranslated.join(", ")}`);
  return messages;
}

export async function getTranslator(locale: Locale): Promise<Translator> {
  return createTranslator(locale, await getMessages(locale));
}
