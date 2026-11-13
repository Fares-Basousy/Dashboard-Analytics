import type { Dataset, DateRange } from "@/lib/domain/types";
import type { CredentialGroupId, Credentials } from "@/lib/credentials/fields";

/** The data a connector contributes. Each source fills only the slices it owns; the shop source sets `currency`. */
export type DatasetSlice = Partial<Pick<Dataset, "products" | "orders" | "refunds" | "campaigns" | "adSpend" | "currency">>;

/**
 * Contract for every data source. Adding a source = implement this + register it in `registry.ts`.
 * Nothing else (UI, profit engine, AI) needs to change.
 */
export interface Connector {
  id: string;
  name: string;
  /** Human-readable summary of what the source contributes. */
  provides: string;
  /** Planned sources are listed in the UI but not fetched yet. */
  planned?: boolean;
  /** Credential group (see lib/credentials/fields.ts) that must be complete to use the real API. */
  credentialGroup?: CredentialGroupId;
  /** Fetch from the real API. Only called when the credential group is complete. */
  fetch(range: DateRange, creds: Credentials): Promise<DatasetSlice>;
  /** Deterministic demo data, used when not configured or the API fails. */
  mock(range: DateRange): DatasetSlice;
}
