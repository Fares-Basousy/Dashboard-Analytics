import type { Dataset, DateRange, SourceInfo } from "@/lib/domain/types";
import type { Connector, DatasetSlice } from "./types";
import { isGroupConfigured, type Credentials } from "@/lib/credentials/fields";
import { DEFAULT_CURRENCY, round2, safeDiv } from "@/lib/format";
import { ordersRevenue } from "@/lib/profit/engine";
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

type SliceResult = { slice: DatasetSlice; info: SourceInfo };

/**
 * Demo ads are sized for the demo shop (~CHF 200k revenue a month). Next to a live, smaller shop they
 * would swamp its P&L, so they are resized by liveRevenue / demoRevenue for the same period. Campaign
 * efficiency (ROAS, POAS) is unchanged – only the size follows the real shop. Real ad data is never touched.
 */
export function scaleDemoAdsToLiveShop(results: SliceResult[], connectors: Connector[], range: DateRange): SliceResult[] {
  const shopIndex = results.findIndex((r) => r.info.status === "live" && r.slice.orders);
  if (shopIndex < 0) return results;
  const demoRevenue = ordersRevenue(connectors[shopIndex].mock(range).orders ?? []);
  const factor = safeDiv(ordersRevenue(results[shopIndex].slice.orders!), demoRevenue);

  return results.map((r) => {
    if (r.info.status === "live" || !r.slice.adSpend?.length) return r;
    const adSpend = r.slice.adSpend.map((d) => ({
      ...d,
      spend: round2(d.spend * factor),
      conversionValue: round2(d.conversionValue * factor),
      conversions: round2(d.conversions * factor),
      clicks: Math.round(d.clicks * factor),
      impressions: Math.round(d.impressions * factor),
    }));
    return { slice: { ...r.slice, adSpend }, info: { ...r.info, scaledToShop: true } };
  });
}

/** Fetch all sources in parallel and merge them into one Dataset. Uncached; see `lib/data/dataset.ts`. */
export async function loadDataset(range: DateRange, creds: Credentials, connectors: Connector[] = CONNECTORS): Promise<Dataset> {
  const loaded = await Promise.all(connectors.map((c) => loadSlice(c, range, creds)));
  const results = scaleDemoAdsToLiveShop(loaded, connectors, range);
  const merged: Dataset = { range, currency: DEFAULT_CURRENCY, products: [], orders: [], refunds: [], campaigns: [], adSpend: [], sources: [] };
  // The first source that reports a currency (the shop) defines it for the whole dataset.
  merged.currency = results.find((r) => r.slice.currency)?.slice.currency ?? DEFAULT_CURRENCY;
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
