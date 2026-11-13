/**
 * Single source of truth for every credential the app understands.
 * Drives: the settings form, connector "is configured" checks, the AI provider switch and `.env.example`.
 * Client-safe: contains field metadata only, never values.
 */

export interface CredentialField {
  key: string;
  label: string;
  secret: boolean;
  placeholder?: string;
  /**
   * Allowed format (anchored automatically). A string, not a RegExp, so it can cross the
   * server→client boundary and double as the HTML `pattern` attribute. Values that end up in
   * outbound request URLs MUST have one – it prevents SSRF / path injection.
   */
  pattern?: string;
}

export interface CredentialGroup {
  id: "ai" | "shopify" | "google_ads" | "meta";
  title: string;
  description: string;
  fields: readonly CredentialField[];
  /**
   * Alternative key sets: the group is configured when ALL keys of ANY one set are present
   * (e.g. Shopify: client credentials OR a legacy static token). Empty = never "configured".
   */
  requiredAnyOf: readonly (readonly string[])[];
}

export const CREDENTIAL_GROUPS = [
  {
    id: "ai",
    title: "AI model",
    description: "One key is enough. Without any key the assistant runs in rule-based demo mode.",
    fields: [
      { key: "NVIDIA_API_KEY", label: "NVIDIA API key (Nemotron, default)", secret: true, placeholder: "nvapi-…" },
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API key", secret: true, placeholder: "sk-ant-…" },
      { key: "OPENAI_API_KEY", label: "OpenAI API key", secret: true, placeholder: "sk-…" },
      { key: "AI_GATEWAY_API_KEY", label: "Vercel AI Gateway key", secret: true },
      { key: "AI_PROVIDER", label: "Provider override (nvidia | anthropic | openai | gateway | demo)", secret: false, placeholder: "auto" },
      { key: "AI_MODEL", label: "Model override", secret: false, placeholder: "e.g. nvidia/nemotron-3.5-super-vl-120b-a12b" },
    ],
    requiredAnyOf: [],
  },
  {
    id: "shopify",
    title: "Shopify",
    description:
      "Dev Dashboard app with read_orders, read_products, read_inventory scopes, installed on the store. Use client ID + secret (current) – or a legacy custom-app token.",
    fields: [
      { key: "SHOPIFY_STORE_DOMAIN", label: "Store domain", secret: false, placeholder: "your-store.myshopify.com", pattern: "[a-z0-9][a-z0-9\\-]*\\.myshopify\\.com" },
      { key: "SHOPIFY_CLIENT_ID", label: "Client ID (Dev Dashboard app)", secret: false, pattern: "[A-Za-z0-9]+" },
      { key: "SHOPIFY_CLIENT_SECRET", label: "Client secret", secret: true, placeholder: "shpss_…" },
      { key: "SHOPIFY_ADMIN_TOKEN", label: "Legacy Admin API token – only for apps created before 2026", secret: true, placeholder: "shpat_…" },
    ],
    requiredAnyOf: [
      ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"],
      ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN"],
    ],
  },
  {
    id: "google_ads",
    title: "Google Ads",
    description: "Developer token + OAuth refresh token with the adwords scope.",
    fields: [
      { key: "GOOGLE_ADS_DEVELOPER_TOKEN", label: "Developer token", secret: true },
      { key: "GOOGLE_ADS_CLIENT_ID", label: "OAuth client ID", secret: false },
      { key: "GOOGLE_ADS_CLIENT_SECRET", label: "OAuth client secret", secret: true },
      { key: "GOOGLE_ADS_REFRESH_TOKEN", label: "OAuth refresh token", secret: true },
      { key: "GOOGLE_ADS_CUSTOMER_ID", label: "Customer ID", secret: false, placeholder: "123-456-7890", pattern: "\\d{3}-?\\d{3}-?\\d{4}" },
      { key: "GOOGLE_ADS_LOGIN_CUSTOMER_ID", label: "Manager (MCC) ID – optional", secret: false, pattern: "\\d{3}-?\\d{3}-?\\d{4}" },
    ],
    requiredAnyOf: [["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"]],
  },
  {
    id: "meta",
    title: "Meta Ads",
    description: "System-user access token with ads_read on the ad account.",
    fields: [
      { key: "META_ACCESS_TOKEN", label: "Access token", secret: true },
      { key: "META_AD_ACCOUNT_ID", label: "Ad account ID", secret: false, placeholder: "act_1234567890", pattern: "(act_)?\\d+" },
    ],
    requiredAnyOf: [["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"]],
  },
] as const satisfies readonly CredentialGroup[];

export type CredentialGroupId = CredentialGroup["id"];
export type CredentialKey = (typeof CREDENTIAL_GROUPS)[number]["fields"][number]["key"];

/** Resolved credential values (cookie over environment). Server-side only. */
export type Credentials = Partial<Record<CredentialKey, string>>;

/** Where a key's effective value comes from (safe to show in the UI). */
export type CredentialSource = "cookie" | "env" | "none";

export const ALL_CREDENTIAL_KEYS: CredentialKey[] = CREDENTIAL_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

export const ALL_FIELDS = Object.fromEntries(CREDENTIAL_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f]))) as Record<CredentialKey, CredentialField>;

export const isCredentialKey = (k: string): k is CredentialKey => (ALL_CREDENTIAL_KEYS as string[]).includes(k);

export function groupById(id: CredentialGroupId): CredentialGroup {
  return CREDENTIAL_GROUPS.find((g) => g.id === id)!;
}

/** Validate a value against its field pattern (no pattern = any value). */
export function matchesPattern(field: CredentialField, value: string): boolean {
  return !field.pattern || new RegExp(`^(?:${field.pattern})$`).test(value);
}

export function isGroupConfigured(id: CredentialGroupId, creds: Credentials): boolean {
  return groupById(id).requiredAnyOf.some((set) => set.every((k) => Boolean(creds[k as CredentialKey])));
}
