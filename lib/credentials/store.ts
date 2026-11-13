import "server-only";
import { cookies } from "next/headers";
import { ALL_CREDENTIAL_KEYS, type CredentialKey, type Credentials, type CredentialSource, isCredentialKey } from "./fields";
import { seal, unseal } from "./crypto";

const COOKIE_NAME = "pd_credentials";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Credentials from the server environment only (used by cron jobs, which have no browser session). */
export function envCredentials(): Credentials {
  const out: Credentials = {};
  for (const k of ALL_CREDENTIAL_KEYS) {
    const v = process.env[k]?.trim();
    if (v) out[k] = v;
  }
  return out;
}

async function readCookieCredentials(): Promise<Credentials> {
  const sealed = (await cookies()).get(COOKIE_NAME)?.value;
  const json = sealed ? unseal(sealed) : null;
  if (!json) return {};
  const parsed: Record<string, unknown> = JSON.parse(json);
  return Object.fromEntries(Object.entries(parsed).filter(([k, v]) => isCredentialKey(k) && typeof v === "string" && v));
}

/** Effective credentials for this request: values saved in the browser override server env vars. */
export async function getCredentials(): Promise<Credentials> {
  return { ...envCredentials(), ...(await readCookieCredentials()) };
}

/** Where each key comes from – safe to send to the client (no values). */
export async function getCredentialSources(): Promise<Record<CredentialKey, CredentialSource>> {
  const cookie = await readCookieCredentials();
  const env = envCredentials();
  return Object.fromEntries(ALL_CREDENTIAL_KEYS.map((k) => [k, cookie[k] ? "cookie" : env[k] ? "env" : "none"])) as Record<
    CredentialKey,
    CredentialSource
  >;
}

/** Merge `updates` into the cookie. Empty string removes a key. Only callable from Server Actions / Route Handlers. */
export async function updateCookieCredentials(updates: Credentials): Promise<void> {
  const next = { ...(await readCookieCredentials()) };
  for (const [k, v] of Object.entries(updates) as [CredentialKey, string][]) {
    if (v) next[k] = v;
    else delete next[k];
  }
  const store = await cookies();
  if (!Object.keys(next).length) {
    store.delete(COOKIE_NAME);
    return;
  }
  store.set(COOKIE_NAME, seal(JSON.stringify(next)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearCookieCredentials(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
