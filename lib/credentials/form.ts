import { groupById, matchesPattern, type CredentialGroupId, type Credentials, type CredentialKey } from "./fields";

const MAX_LENGTH = 4096;

export type CredentialFormResult = { ok: true; updates: Credentials } | { ok: false; error: string };

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
    const value = entries[key]?.trim() ?? "";
    if (!value) continue;
    if (value.length > MAX_LENGTH) return { ok: false, error: `${field.label} is too long.` };
    if (field.secret && /\s/.test(value)) return { ok: false, error: `${field.label} must not contain spaces.` };
    if (!matchesPattern(field, value)) return { ok: false, error: `${field.label} has an invalid format${field.placeholder ? ` (e.g. ${field.placeholder})` : ""}.` };
    updates[key] = value;
  }
  if (!clear && !Object.keys(updates).length) return { ok: false, error: "Enter at least one value." };
  return { ok: true, updates };
}
