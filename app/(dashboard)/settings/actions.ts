"use server";

import { CREDENTIAL_GROUPS, type CredentialGroupId } from "@/lib/credentials/fields";
import { parseCredentialForm } from "@/lib/credentials/form";
import { clearCookieCredentials, updateCookieCredentials } from "@/lib/credentials/store";

export type FormState = { ok: boolean; message: string } | null;

const isGroupId = (v: unknown): v is CredentialGroupId => CREDENTIAL_GROUPS.some((g) => g.id === v);

/** Save (or clear) one credential group into the encrypted httpOnly cookie. */
export async function saveCredentials(_prev: FormState, form: FormData): Promise<FormState> {
  const groupId = form.get("group");
  if (!isGroupId(groupId)) return { ok: false, message: "Unknown integration." };

  const clear = form.get("intent") === "clear";
  const entries = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const result = parseCredentialForm(groupId, entries, clear);
  if (!result.ok) return { ok: false, message: result.error };

  await updateCookieCredentials(result.updates);
  return { ok: true, message: clear ? "Removed from this browser." : "Saved securely in this browser." };
}

export async function forgetAllCredentials(): Promise<void> {
  await clearCookieCredentials();
}
