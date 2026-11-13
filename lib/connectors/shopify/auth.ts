import type { Credentials } from "@/lib/credentials/fields";
import { fetchJson, requireCredential } from "../http";

/** Refresh this long before Shopify's 24 h expiry to avoid using a token mid-expiry. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

/** Per server instance; tokens are short-lived and scoped to one store + app. */
const tokenCache = new Map<string, CachedToken>();

/**
 * Admin API access token for a store.
 * - Current Shopify model (apps from the Dev Dashboard, 2026+): client credentials grant, token valid 24 h.
 *   https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
 * - Legacy custom apps (created before 2026): static `shpat_…` token.
 */
export async function getShopifyAccessToken(creds: Credentials, now = Date.now()): Promise<string> {
  if (!creds.SHOPIFY_CLIENT_ID || !creds.SHOPIFY_CLIENT_SECRET) {
    return requireCredential(creds, "SHOPIFY_ADMIN_TOKEN");
  }

  const domain = requireCredential(creds, "SHOPIFY_STORE_DOMAIN");
  const clientId = requireCredential(creds, "SHOPIFY_CLIENT_ID");
  const cacheKey = `${domain}|${clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now) return cached.token;

  const res = await fetchJson<{ access_token: string; expires_in: number; scope: string }>(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: requireCredential(creds, "SHOPIFY_CLIENT_SECRET"),
    }),
  });
  tokenCache.set(cacheKey, { token: res.access_token, expiresAt: now + res.expires_in * 1000 });
  return res.access_token;
}

/** For tests. */
export function clearShopifyTokenCache() {
  tokenCache.clear();
}
