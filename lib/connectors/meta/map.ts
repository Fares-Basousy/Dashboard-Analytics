/** Pure mapper: Meta Marketing API insights → domain types. */
import type { AdCampaign, AdSpendDaily } from "@/lib/domain/types";
import { round2 } from "@/lib/format";
import { skuFromName, toNumber } from "../http";

export interface MetaCampaignNode {
  id: string;
  name: string;
  objective: string;
  effective_status: string;
}

export interface MetaInsightRow {
  campaign_id: string;
  date_start: string;
  spend: string;
  impressions: string;
  clicks: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

/** Meta reports purchases under several overlapping action types; take the first available. */
function purchases(list: { action_type: string; value: string }[] | undefined): number {
  for (const type of PURCHASE_TYPES) {
    const hit = list?.find((a) => a.action_type === type);
    if (hit) return toNumber(hit.value);
  }
  return 0;
}

export function mapMeta(campaignNodes: MetaCampaignNode[], rows: MetaInsightRow[]): { campaigns: AdCampaign[]; adSpend: AdSpendDaily[] } {
  return {
    campaigns: campaignNodes.map((c) => ({
      id: `m-${c.id}`,
      channel: "meta",
      name: c.name,
      type: c.objective,
      status: c.effective_status === "ACTIVE" ? "active" : "paused",
      sku: skuFromName(c.name),
    })),
    adSpend: rows.map((r) => ({
      campaignId: `m-${r.campaign_id}`,
      date: r.date_start,
      spend: round2(toNumber(r.spend)),
      impressions: toNumber(r.impressions),
      clicks: toNumber(r.clicks),
      conversions: purchases(r.actions),
      conversionValue: round2(purchases(r.action_values)),
    })),
  };
}
