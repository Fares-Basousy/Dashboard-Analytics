import "server-only";
import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import { envCredentials } from "@/lib/credentials/store";
import type { TranslateBatch } from "./resolve";

/**
 * Fallback translator for UI texts that have no hand-written translation.
 * Uses the server's AI key (translations are shared by all visitors and cached). Without a key: no-op.
 */
export const aiTranslateBatch: TranslateBatch = async (texts, language) => {
  const ai = getModel(envCredentials());
  if (ai.isDemo || !Object.keys(texts).length) return {};

  const { text } = await generateText({
    model: ai.model,
    system:
      `You translate user-interface texts of an e-commerce profit dashboard from English into ${language}. ` +
      "Return ONLY a JSON object with exactly the same keys. Keep every {placeholder} unchanged. " +
      "Do not translate names (products, brands, campaigns, companies, people), currency codes or the metrics POAS, ROAS, COGS, SKU, P&L. " +
      "Keep symbols such as →, –, ≈, ✦ and the tone (short, professional).",
    prompt: JSON.stringify(texts),
  });
  return parseJsonObject(text);
};

/** Models sometimes wrap JSON in prose or ``` fences – take the outermost object. */
export function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
