import type { AdChannel } from "@/lib/domain/types";

/** Platform names (brand names – not translated). */
export const CHANNEL_LABEL: Record<AdChannel, string> = {
  google_ads: "Google Ads",
  meta: "Meta Ads",
  tiktok: "TikTok Ads",
};

/** Add a display name to any row that has a channel (used by the overview and marketing tables). */
export const withChannelLabel = <T extends { channel: AdChannel }>(row: T) => ({ ...row, channelLabel: CHANNEL_LABEL[row.channel] });
