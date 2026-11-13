import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seal, unseal } from "@/lib/credentials/crypto";
import { parseCredentialForm } from "@/lib/credentials/form";
import { ALL_CREDENTIAL_KEYS, isGroupConfigured } from "@/lib/credentials/fields";

describe("cookie encryption", () => {
  it("round-trips and uses a fresh IV every time", () => {
    const a = seal('{"token":"super-secret-token"}');
    expect(unseal(a)).toBe('{"token":"super-secret-token"}');
    expect(seal('{"token":"super-secret-token"}')).not.toBe(a);
    expect(a).not.toContain("super-secret");
  });

  it("rejects tampered or garbage values", () => {
    const sealed = seal("secret");
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(unseal(tampered)).toBeNull();
    expect(unseal("not-a-cookie")).toBeNull();
  });
});

describe("credential form parsing", () => {
  it("accepts only keys of the submitted group and trims values", () => {
    const res = parseCredentialForm("shopify", { SHOPIFY_STORE_DOMAIN: " shop.myshopify.com ", SHOPIFY_ADMIN_TOKEN: "shpat_1", ANTHROPIC_API_KEY: "smuggled" });
    expect(res).toEqual({ ok: true, updates: { SHOPIFY_STORE_DOMAIN: "shop.myshopify.com", SHOPIFY_ADMIN_TOKEN: "shpat_1" } });
  });

  it("treats empty inputs as 'keep existing'", () => {
    expect(parseCredentialForm("meta", { META_ACCESS_TOKEN: "abc", META_AD_ACCOUNT_ID: "" })).toEqual({ ok: true, updates: { META_ACCESS_TOKEN: "abc" } });
  });

  it("clears the whole group", () => {
    expect(parseCredentialForm("meta", {}, true)).toEqual({ ok: true, updates: { META_ACCESS_TOKEN: "", META_AD_ACCOUNT_ID: "" } });
  });

  it("rejects empty submissions and secrets with whitespace", () => {
    expect(parseCredentialForm("meta", {}).ok).toBe(false);
    expect(parseCredentialForm("ai", { ANTHROPIC_API_KEY: "sk ant" }).ok).toBe(false);
  });

  it.each([
    ["shopify", "SHOPIFY_STORE_DOMAIN", "evil.example.com/steal?x="],
    ["shopify", "SHOPIFY_STORE_DOMAIN", "169.254.169.254"],
    ["meta", "META_AD_ACCOUNT_ID", "123/../../me"],
    ["google_ads", "GOOGLE_ADS_CUSTOMER_ID", "123?x=1"],
  ] as const)("rejects %s %s = %s (values used in request URLs)", (group, key, value) => {
    expect(parseCredentialForm(group, { [key]: value }).ok).toBe(false);
  });

  it("reduces a pasted store URL to its domain", () => {
    expect(parseCredentialForm("shopify", { SHOPIFY_STORE_DOMAIN: " https://Ersatzteilstore.myshopify.com/admin " })).toEqual({
      ok: true,
      updates: { SHOPIFY_STORE_DOMAIN: "ersatzteilstore.myshopify.com" },
    });
  });

  it("accepts well-formed identifiers", () => {
    expect(parseCredentialForm("shopify", { SHOPIFY_STORE_DOMAIN: "ersatzteil-store.myshopify.com" }).ok).toBe(true);
    expect(parseCredentialForm("google_ads", { GOOGLE_ADS_CUSTOMER_ID: "123-456-7890" }).ok).toBe(true);
    expect(parseCredentialForm("meta", { META_AD_ACCOUNT_ID: "act_123456" }).ok).toBe(true);
  });

  it("knows when a group is complete", () => {
    expect(isGroupConfigured("meta", { META_ACCESS_TOKEN: "x" })).toBe(false);
    expect(isGroupConfigured("meta", { META_ACCESS_TOKEN: "x", META_AD_ACCOUNT_ID: "1" })).toBe(true);
  });
});

describe(".env.example", () => {
  it("documents every credential the app understands", () => {
    const example = readFileSync(".env.example", "utf8");
    const missing = ALL_CREDENTIAL_KEYS.filter((k) => !new RegExp(`^${k}=`, "m").test(example));
    expect(missing).toEqual([]);
  });
});
