/**
 * CLI for the Shopify test-data seed (same logic as the "Generate test data" button in Settings).
 * Manual only – never runs on install or deploy.
 *
 *   pnpm seed:shopify                    # 15 orders over the last 30 days
 *   pnpm seed:shopify --orders 40 --days 14
 */
import { ALL_FIELDS, normalizeCredential, type Credentials } from "@/lib/credentials/fields";
import { MAX_ORDERS_PER_RUN, runShopifySeed } from "@/lib/seed/shopify-seed";
import { describeSeedEvent } from "@/lib/seed/messages";
import { english } from "@/lib/i18n/english";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : fallback;
  if (!Number.isInteger(v) || v <= 0) throw new Error(`--${name} must be a positive integer`);
  return v;
}

function shopifyCredentials(): Credentials {
  process.loadEnvFile(".env.local");
  const keys = ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET", "SHOPIFY_ADMIN_TOKEN"] as const;
  return Object.fromEntries(keys.map((k) => [k, normalizeCredential(ALL_FIELDS[k], process.env[k] ?? "")]).filter(([, v]) => v));
}

runShopifySeed(shopifyCredentials(), {
  // The CLI has no serverless time limit, so larger runs are fine here.
  orders: arg("orders", MAX_ORDERS_PER_RUN),
  days: arg("days", 30),
  onEvent: (e) => {
    const { title, message } = describeSeedEvent(e, english);
    console.log(e.type === "progress" ? `  ${title} · ${message}` : `${title}: ${message}`);
  },
}).catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
