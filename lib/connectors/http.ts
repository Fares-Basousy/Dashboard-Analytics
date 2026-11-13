/** Shared HTTP + mapping helpers for all connectors. */
import { ALL_FIELDS, matchesPattern, type CredentialKey, type Credentials } from "@/lib/credentials/fields";

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Read a credential and validate its format. Applies to env values too (defense in depth),
 * because some of them are interpolated into outbound request URLs.
 */
export function requireCredential(creds: Credentials, key: CredentialKey): string {
  const value = creds[key];
  if (!value) throw new Error(`Missing credential ${key}`);
  if (!matchesPattern(ALL_FIELDS[key], value)) throw new Error(`Invalid format for ${key}`);
  return value;
}

/**
 * Naming convention to tie a campaign to one product on any ad platform:
 * put `[sku:ABC-123]` in the campaign name.
 */
export function skuFromName(name: string): string | undefined {
  return /\[sku:([^\]]+)\]/i.exec(name)?.[1]?.trim();
}

export const toNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};
