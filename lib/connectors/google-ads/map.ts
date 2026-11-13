/** Pure mapper: Google Ads REST (searchStream) rows → domain types. */
import type { AdCampaign, AdSpendDaily } from "@/lib/domain/types";
import { round2 } from "@/lib/format";
import { skuFromName, toNumber } from "../http";

export interface GoogleAdsRow {
  campaign: { id: string; name: string; status: string; advertisingChannelType: string };
  segments: { date: string };
  metrics: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number; conversionsValue?: number };
}

export function mapGoogleAdsRows(rows: GoogleAdsRow[]): { campaigns: AdCampaign[]; adSpend: AdSpendDaily[] } {
  const campaigns = new Map<string, AdCampaign>();
  const adSpend = rows.map((row) => {
    const id = `g-${row.campaign.id}`;
    if (!campaigns.has(id)) {
      campaigns.set(id, {
        id,
        channel: "google_ads",
        name: row.campaign.name,
        type: row.campaign.advertisingChannelType,
        status: row.campaign.status === "ENABLED" ? "active" : "paused",
        sku: skuFromName(row.campaign.name),
      });
    }
    return {
      campaignId: id,
      date: row.segments.date,
      spend: round2(toNumber(row.metrics.costMicros) / 1_000_000),
      impressions: toNumber(row.metrics.impressions),
      clicks: toNumber(row.metrics.clicks),
      conversions: toNumber(row.metrics.conversions),
      conversionValue: round2(toNumber(row.metrics.conversionsValue)),
    };
  });
  return { campaigns: [...campaigns.values()], adSpend };
}
