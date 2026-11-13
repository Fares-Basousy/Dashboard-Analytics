import { LANGUAGE_NAMES, type Locale } from "./config";
import { en, type MessageKey, type Messages } from "./messages/en";
import { placeholders } from "./translate";

/** Translates a batch of English texts (key → text) into a language; returns key → translation. */
export type TranslateBatch = (texts: Partial<Record<MessageKey, string>>, language: string) => Promise<Record<string, unknown>>;

/**
 * Full message set for a language: the hand-written translations, plus AI translations for any key
 * that has none. Pure (the AI is injected) so the fallback rules are unit-tested:
 * - an AI translation is only used if it is a non-empty string with exactly the same {placeholders};
 * - if the AI is unavailable or fails, English is used.
 */
export async function resolveMessages(
  locale: Locale,
  translations: Partial<Messages>,
  translate?: TranslateBatch,
): Promise<{ messages: Messages; aiTranslated: MessageKey[] }> {
  const keys = Object.keys(en) as MessageKey[];
  const messages = { ...en, ...translations } as Messages;
  if (locale === "en") return { messages: en, aiTranslated: [] };

  const missing = keys.filter((k) => !translations[k]?.trim());
  if (!missing.length || !translate) return { messages, aiTranslated: [] };

  let result: Record<string, unknown> = {};
  try {
    result = await translate(Object.fromEntries(missing.map((k) => [k, en[k]])), LANGUAGE_NAMES[locale]);
  } catch (err) {
    console.error(`[i18n] AI translation to ${locale} failed, using English`, err);
  }

  const aiTranslated: MessageKey[] = [];
  for (const key of missing) {
    const value = result[key];
    if (typeof value === "string" && value.trim() && placeholders(value).join() === placeholders(en[key]).join()) {
      messages[key] = value.trim();
      aiTranslated.push(key);
    }
  }
  return { messages, aiTranslated };
}
