import { cacheLife, cacheTag } from "next/cache";
import type { DateRange } from "@/lib/domain/types";
import type { Credentials } from "@/lib/credentials/fields";
import { loadDataset } from "@/lib/connectors/registry";

export const DATASET_TAG = "dataset";

/**
 * The one data entry point for pages, AI tools and the cron job.
 * Cached per (range, credentials) so different users/keys never share data; refreshed by tag.
 */
export async function getDataset(range: DateRange, creds: Credentials) {
  "use cache";
  cacheLife("hours");
  cacheTag(DATASET_TAG);
  return loadDataset(range, creds);
}
