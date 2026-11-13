import { groupById, matchesPattern, normalizeCredential, type CredentialGroupId, type Credentials, type CredentialKey } from "./fields";

const MAX_LENGTH = 4096;

/** Error as message key + field, so the caller can show it in the user's language. */
export type CredentialFormError = { key: "cred.empty" | "cred.tooLong" | "cred.spaces" | "cred.invalid" | "cred.invalidExample"; fieldKey?: CredentialKey; example?: string };

export type CredentialFormResult = { ok: true; updates: Credentials } | { ok: false; error: CredentialFormError };

/**
 * Turn submitted form fields into cookie updates for ONE group (pure, unit-tested).
 * - Only keys belonging to the group are accepted (no smuggling of other keys).
 * - Empty inputs mean "keep what is saved"; `clear` removes every key of the group.
 */
export function parseCredentialForm(groupId: CredentialGroupId, entries: Record<string, string>, clear = false): CredentialFormResult {
  const group = groupById(groupId);
  const updates: Credentials = {};
  for (const field of group.fields) {
    const key = field.key as CredentialKey;
    if (clear) {
      updates[key] = "";
      continue;
    }
    const value = normalizeCredential(field, entries[key] ?? "");
    if (!value) continue;
    if (value.length > MAX_LENGTH) return { ok: false, error: { key: "cred.tooLong", fieldKey: key } };
    if (field.secret && /\s/.test(value)) return { ok: false, error: { key: "cred.spaces", fieldKey: key } };
    if (!matchesPattern(field, value)) {
      return { ok: false, error: field.placeholder ? { key: "cred.invalidExample", fieldKey: key, example: field.placeholder } : { key: "cred.invalid", fieldKey: key } };
    }
    updates[key] = value;
  }
  if (!clear && !Object.keys(updates).length) return { ok: false, error: { key: "cred.empty" } };
  return { ok: true, updates };
}
