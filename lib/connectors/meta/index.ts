import type { Connector } from "../types";
import type { Credentials } from "@/lib/credentials/fields";
import { fetchJson, requireCredential } from "../http";
import { mockAds } from "@/lib/mock/seed";
import { mapMeta, type MetaCampaignNode, type MetaInsightRow } from "./map";

const API_VERSION = "v23.0";
const MAX_PAGES = 50;

/** GET an ad-account edge and follow `paging.next` links. */
async function graphPaginate<T>(creds: Credentials, edge: string, params: Record<string, string>): Promise<T[]> {
  const account = requireCredential(creds, "META_AD_ACCOUNT_ID").replace(/^act_/, "");
  const query = new URLSearchParams({ ...params, limit: "500", access_token: requireCredential(creds, "META_ACCESS_TOKEN") });
  let url: string | undefined = `https://graph.facebook.com/${API_VERSION}/act_${account}/${edge}?${query}`;
  const out: T[] = [];
  for (let i = 0; url && i < MAX_PAGES; i++) {
    const page: { data: T[]; paging?: { next?: string } } = await fetchJson(url);
    out.push(...page.data);
    url = page.paging?.next;
  }
  return out;
}

export const meta: Connector = {
  id: "meta",
  name: "Meta Ads",
  provides: "Facebook & Instagram campaigns, spend, purchases, purchase value",
  credentialGroup: "meta",
  async fetch(range, creds) {
    const [campaigns, rows] = await Promise.all([
      graphPaginate<MetaCampaignNode>(creds, "campaigns", { fields: "id,name,objective,effective_status" }),
      graphPaginate<MetaInsightRow>(creds, "insights", {
        level: "campaign",
        time_increment: "1",
        time_range: JSON.stringify({ since: range.from, until: range.to }),
        fields: "campaign_id,spend,impressions,clicks,actions,action_values",
      }),
    ]);
    return mapMeta(campaigns, rows);
  },
  mock: (range) => mockAds("meta", range),
};
