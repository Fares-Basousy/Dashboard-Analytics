import type { Connector } from "../types";
import type { Credentials } from "@/lib/credentials/fields";
import { fetchJson, requireCredential } from "../http";
import { mockAds } from "@/lib/mock/seed";
import { mapGoogleAdsRows, type GoogleAdsRow } from "./map";

const API_VERSION = "v22";

const campaignQuery = (from: string, to: string) => `
  SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, segments.date,
         metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
  FROM campaign
  WHERE segments.date BETWEEN '${from}' AND '${to}'`;

const digitsOnly = (id: string) => id.replaceAll("-", "");

/** Exchange the long-lived refresh token for a short-lived access token. */
async function accessToken(creds: Credentials): Promise<string> {
  const res = await fetchJson<{ access_token: string }>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireCredential(creds, "GOOGLE_ADS_CLIENT_ID"),
      client_secret: requireCredential(creds, "GOOGLE_ADS_CLIENT_SECRET"),
      refresh_token: requireCredential(creds, "GOOGLE_ADS_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  return res.access_token;
}

export const googleAds: Connector = {
  id: "google_ads",
  name: "Google Ads",
  provides: "Campaigns, daily spend, clicks, conversions, conversion value",
  credentialGroup: "google_ads",
  async fetch(range, creds) {
    const customerId = digitsOnly(requireCredential(creds, "GOOGLE_ADS_CUSTOMER_ID"));
    const loginCustomerId = creds.GOOGLE_ADS_LOGIN_CUSTOMER_ID && digitsOnly(requireCredential(creds, "GOOGLE_ADS_LOGIN_CUSTOMER_ID"));
    const batches = await fetchJson<{ results?: GoogleAdsRow[] }[]>(
      `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await accessToken(creds)}`,
          "developer-token": requireCredential(creds, "GOOGLE_ADS_DEVELOPER_TOKEN"),
          ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
        },
        body: JSON.stringify({ query: campaignQuery(range.from, range.to) }),
      },
    );
    return mapGoogleAdsRows(batches.flatMap((b) => b.results ?? []));
  },
  mock: (range) => mockAds("google_ads", range),
};
