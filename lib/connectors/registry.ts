import type { Dataset, DateRange, SourceInfo } from "@/lib/domain/types";
import type { Connector, DatasetSlice } from "./types";
import { isGroupConfigured, type Credentials } from "@/lib/credentials/fields";
import { shopify } from "./shopify";
import { googleAds } from "./google-ads";
import { meta } from "./meta";

/** Roadmap sources: visible in the UI, wired in by implementing `Connector`. */
const planned = (id: string, name: string, provides: string): Connector => ({
  id,
  name,
  provides,
  planned: true,
  fetch: async () => ({}),
  mock: () => ({}),
});

export const CONNECTORS: Connector[] = [
  shopify,
  googleAds,
  meta,
  planned("tiktok", "TikTok Ads", "Campaigns, spend, conversions"),
  planned("merchant_center", "Google Merchant Center", "Product feed status, price competitiveness, disapprovals"),
  planned("ga4", "Google Analytics 4", "Sessions, funnel, conversion rate, customer behaviour"),
];

const isConfigured = (c: Connector, creds: Credentials) => Boolean(c.credentialGroup && isGroupConfigured(c.credentialGroup, creds));

async function loadSlice(c: Connector, range: DateRange, creds: Credentials): Promise<{ slice: DatasetSlice; info: SourceInfo }> {
  const base = { id: c.id, name: c.name, provides: c.provides };
  if (c.planned) return { slice: {}, info: { ...base, status: "planned" } };
  if (!isConfigured(c, creds)) return { slice: c.mock(range), info: { ...base, status: "mock", message: "No credentials – showing demo data" } };
  try {
    return { slice: await c.fetch(range, creds), info: { ...base, status: "live" } };
  } catch (err) {
    // A failing source must never take the whole dashboard down.
    console.error(`[connector:${c.id}]`, err);
    return { slice: c.mock(range), info: { ...base, status: "error", message: `API error – showing demo data. ${(err as Error).message}` } };
  }
}

/** Fetch all sources in parallel and merge them into one Dataset. Uncached; see `lib/data/dataset.ts`. */
export async function loadDataset(range: DateRange, creds: Credentials, connectors: Connector[] = CONNECTORS): Promise<Dataset> {
  const results = await Promise.all(connectors.map((c) => loadSlice(c, range, creds)));
  const merged: Dataset = { range, products: [], orders: [], refunds: [], campaigns: [], adSpend: [], sources: [] };
  for (const { slice, info } of results) {
    merged.products.push(...(slice.products ?? []));
    merged.orders.push(...(slice.orders ?? []));
    merged.refunds.push(...(slice.refunds ?? []));
    merged.campaigns.push(...(slice.campaigns ?? []));
    merged.adSpend.push(...(slice.adSpend ?? []));
    merged.sources.push(info);
  }
  return merged;
}
