"use server";

import { CREDENTIAL_GROUPS, type CredentialGroupId } from "@/lib/credentials/fields";
import { parseCredentialForm } from "@/lib/credentials/form";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { clearCookieCredentials, updateCookieCredentials } from "@/lib/credentials/store";
import { updateTag } from "next/cache";
import { DATASET_TAG } from "@/lib/data/dataset";
import { INSIGHTS_TAG } from "@/lib/insights/report";

export type FormState = { ok: boolean; message: string } | null;

const isGroupId = (v: unknown): v is CredentialGroupId => CREDENTIAL_GROUPS.some((g) => g.id === v);

/** Save (or clear) one credential group into the encrypted httpOnly cookie. */
export async function saveCredentials(_prev: FormState, form: FormData): Promise<FormState> {
  // Server Actions can't read the URL's language (next/root-params), so the form sends it.
  const locale = form.get("locale");
  const { t } = await getTranslator(isLocale(locale) ? locale : DEFAULT_LOCALE);
  const groupId = form.get("group");
  if (!isGroupId(groupId)) return { ok: false, message: t("cred.unknownGroup") };

  const clear = form.get("intent") === "clear";
  const entries = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const result = parseCredentialForm(groupId, entries, clear);
  if (!result.ok) {
    const { key, fieldKey, example } = result.error;
    return { ok: false, message: t(key, { field: fieldKey ? t(`field.${fieldKey}`) : "", example: example ?? "" }) };
  }

  await updateCookieCredentials(result.updates);
  return { ok: true, message: t(clear ? "cred.removed" : "cred.saved") };
}

export async function forgetAllCredentials(): Promise<void> {
  await clearCookieCredentials();
}

/** After seeding: drop cached data so the dashboard shows the new orders on the next render. */
export async function refreshDashboardData(): Promise<void> {
  updateTag(DATASET_TAG);
  updateTag(INSIGHTS_TAG);
}
