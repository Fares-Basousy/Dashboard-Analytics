import { describe, expect, it, vi } from "vitest";
import { mapOrder, mapVariant } from "@/lib/connectors/shopify/map";
import { mapGoogleAdsRows } from "@/lib/connectors/google-ads/map";
import { mapMeta } from "@/lib/connectors/meta/map";
import { skuFromName } from "@/lib/connectors/http";
import { loadDataset } from "@/lib/connectors/registry";
import type { Connector } from "@/lib/connectors/types";
import { costConfig } from "@/lib/config";

const money = (amount: string) => ({ shopMoney: { amount } });
const RANGE = { from: "2026-11-01", to: "2026-11-02" };

describe("Shopify mapper", () => {
  it("maps variants by SKU", () => {
    expect(mapVariant({ id: "gid://shopify/ProductVariant/7", sku: "X-1", title: "Default Title", price: "19.90", product: { title: "Filter", productType: "" }, inventoryItem: { unitCost: { amount: "7.5" } } })).toEqual({
      sku: "X-1",
      title: "Filter",
      category: "Uncategorized",
      price: 19.9,
      unitCost: 7.5,
    });
  });

  it("falls back to the variant ID when a product has no SKU, and names variants", () => {
    const p = mapVariant({ id: "gid://shopify/ProductVariant/42", sku: "", title: "Blue", price: "5", product: { title: "Knob", productType: "Oven" }, inventoryItem: null });
    expect(p).toMatchObject({ sku: "variant-42", title: "Knob – Blue", unitCost: 0 });
  });

  it("matches SKU-less order and refund lines to the same variant key", () => {
    const line = { name: "Knob", sku: null, variant: { id: "gid://shopify/ProductVariant/42" } };
    const { order, refunds } = mapOrder(
      {
        id: "gid://shopify/Order/9",
        processedAt: "2026-11-01T10:00:00Z",
        taxesIncluded: false,
        totalPriceSet: money("5"),
        lineItems: { nodes: [{ ...line, quantity: 1, originalUnitPriceSet: money("5"), totalDiscountSet: money("0"), taxLines: [] }, { name: "Gift wrap", sku: null, variant: null, quantity: 1, originalUnitPriceSet: money("2"), totalDiscountSet: money("0"), taxLines: [] }] },
        refunds: [{ createdAt: "2026-11-02T00:00:00Z", refundLineItems: { nodes: [{ quantity: 1, subtotalSet: money("5"), lineItem: line }] } }],
        transactions: [],
      },
      costConfig(),
    );
    expect(order.lines.map((l) => l.sku)).toEqual(["variant-42", "custom-Gift wrap"]);
    expect(refunds[0].sku).toBe("variant-42");
  });

  it("maps orders, real payment fees and refunds", () => {
    const { order, refunds } = mapOrder(
      {
        id: "gid://shopify/Order/123",
        processedAt: "2026-11-01T10:00:00Z",
        taxesIncluded: false,
        totalPriceSet: money("50.00"),
        lineItems: { nodes: [{ name: "Filter", sku: "X-1", variant: { id: "gid://shopify/ProductVariant/7" }, quantity: 2, originalUnitPriceSet: money("25.00"), totalDiscountSet: money("5.00"), taxLines: [] }] },
        refunds: [{ createdAt: "2026-11-03T09:00:00Z", refundLineItems: { nodes: [{ quantity: 1, subtotalSet: money("22.50"), lineItem: { name: "Filter", sku: "X-1", variant: { id: "gid://shopify/ProductVariant/7" } } }] } }],
        transactions: [{ fees: [{ amount: { amount: "1.75" } }] }],
      },
      costConfig(),
    );
    expect(order).toEqual({ id: "123", date: "2026-11-01", lines: [{ sku: "X-1", qty: 2, unitPrice: 25, discount: 5, includedTax: 0 }], shippingCost: 6.5, paymentFee: 1.75 });
    expect(refunds).toEqual([{ orderId: "123", date: "2026-11-03", sku: "X-1", qty: 1, amount: 22.5 }]);
  });

  it("removes VAT from line revenue when the shop's prices include tax", () => {
    const { order } = mapOrder(
      {
        id: "7",
        processedAt: "2026-10-20T09:00:00Z",
        taxesIncluded: true,
        totalPriceSet: money("108.10"),
        lineItems: { nodes: [{ name: "Pump", sku: "P", variant: null, quantity: 1, originalUnitPriceSet: money("108.10"), totalDiscountSet: money("0"), taxLines: [{ priceSet: money("8.10") }] }] },
        refunds: [],
        transactions: [],
      },
      costConfig(),
    );
    expect(order.date).toBe("2026-10-20"); // business date, not import time
    expect(order.lines[0]).toMatchObject({ unitPrice: 108.1, includedTax: 8.1 });
  });

  it("ignores tax lines when prices exclude tax (tax is charged on top)", () => {
    const { order } = mapOrder(
      {
        id: "8",
        processedAt: "2026-10-20T09:00:00Z",
        taxesIncluded: false,
        totalPriceSet: money("108.10"),
        lineItems: { nodes: [{ name: "Pump", sku: "P", variant: null, quantity: 1, originalUnitPriceSet: money("100"), totalDiscountSet: money("0"), taxLines: [{ priceSet: money("8.10") }] }] },
        refunds: [],
        transactions: [],
      },
      costConfig(),
    );
    expect(order.lines[0].includedTax).toBe(0);
  });

  it("estimates payment fees when the gateway reports none", () => {
    const { order } = mapOrder(
      { id: "1", processedAt: "2026-11-01T00:00:00Z", taxesIncluded: false, totalPriceSet: money("100"), lineItems: { nodes: [] }, refunds: [], transactions: [] },
      { shippingCostPerOrder: 0, paymentFeePct: 0.02, paymentFeeFixed: 0.5 },
    );
    expect(order.paymentFee).toBe(2.5);
  });
});

describe("Google Ads mapper", () => {
  it("converts micros, dedupes campaigns and reads SKU tags", () => {
    const row = (date: string, cost: string) => ({
      campaign: { id: "9", name: "Shopping [sku:AB-1]", status: "ENABLED", advertisingChannelType: "SHOPPING" },
      segments: { date },
      metrics: { costMicros: cost, impressions: "100", clicks: "10", conversions: 2, conversionsValue: 120.5 },
    });
    const res = mapGoogleAdsRows([row("2026-11-01", "12500000"), row("2026-11-02", "1000000")]);
    expect(res.campaigns).toEqual([{ id: "g-9", channel: "google_ads", name: "Shopping [sku:AB-1]", type: "SHOPPING", status: "active", sku: "AB-1" }]);
    expect(res.adSpend[0]).toMatchObject({ campaignId: "g-9", spend: 12.5, clicks: 10, conversionValue: 120.5 });
  });
});

describe("Meta mapper", () => {
  it("picks purchase actions and maps status", () => {
    const res = mapMeta(
      [{ id: "5", name: "Retargeting", objective: "OUTCOME_SALES", effective_status: "PAUSED" }],
      [{ campaign_id: "5", date_start: "2026-11-01", spend: "40.10", impressions: "900", clicks: "30", actions: [{ action_type: "link_click", value: "30" }, { action_type: "omni_purchase", value: "3" }], action_values: [{ action_type: "omni_purchase", value: "210.00" }] }],
    );
    expect(res.campaigns[0]).toMatchObject({ id: "m-5", status: "paused", channel: "meta" });
    expect(res.adSpend[0]).toMatchObject({ campaignId: "m-5", spend: 40.1, conversions: 3, conversionValue: 210 });
  });
});

describe("skuFromName", () => {
  it.each([
    ["Shopping [sku:ETS-1]", "ETS-1"],
    ["[SKU: abc ] promo", "abc"],
    ["No tag", undefined],
  ])("%s → %s", (name, sku) => expect(skuFromName(name)).toBe(sku));
});

describe("connector registry", () => {
  const fake = (overrides: Partial<Connector>): Connector => ({
    id: "fake",
    name: "Fake",
    provides: "",
    credentialGroup: "shopify",
    fetch: vi.fn(async () => ({ products: [{ sku: "LIVE", title: "", category: "", price: 1, unitCost: 0 }] })),
    mock: vi.fn(() => ({ products: [{ sku: "MOCK", title: "", category: "", price: 1, unitCost: 0 }] })),
    ...overrides,
  });
  const shopifyCreds = { SHOPIFY_STORE_DOMAIN: "x.myshopify.com", SHOPIFY_ADMIN_TOKEN: "t" };

  it("uses demo data when credentials are missing", async () => {
    const c = fake({});
    const ds = await loadDataset(RANGE, {}, [c]);
    expect(ds.products[0].sku).toBe("MOCK");
    expect(ds.sources[0].status).toBe("mock");
    expect(c.fetch).not.toHaveBeenCalled();
  });

  it("uses the real API when credentials are complete", async () => {
    const ds = await loadDataset(RANGE, shopifyCreds, [fake({})]);
    expect(ds.products[0].sku).toBe("LIVE");
    expect(ds.sources[0].status).toBe("live");
  });

  it("falls back to demo data and reports the error when the API fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ds = await loadDataset(RANGE, shopifyCreds, [fake({ fetch: async () => Promise.reject(new Error("401 Unauthorized")) })]);
    expect(ds.products[0].sku).toBe("MOCK");
    expect(ds.sources[0]).toMatchObject({ status: "error" });
    expect(ds.sources[0].message).toContain("401");
  });

  it("refuses malformed credentials from the environment before any request (SSRF guard)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { shopify } = await import("@/lib/connectors/shopify");
    const ds = await loadDataset(RANGE, { SHOPIFY_STORE_DOMAIN: "internal-host:8080", SHOPIFY_ADMIN_TOKEN: "t" }, [shopify]);
    expect(ds.sources[0]).toMatchObject({ status: "error" });
    expect(ds.sources[0].message).toContain("Invalid format");
  });

  it("lists planned sources without fetching", async () => {
    const c = fake({ planned: true });
    const ds = await loadDataset(RANGE, shopifyCreds, [c]);
    expect(ds.sources[0].status).toBe("planned");
    expect(c.fetch).not.toHaveBeenCalled();
  });

  it("takes the currency from the shop source, CHF for demo data", async () => {
    expect((await loadDataset(RANGE, {})).currency).toBe("CHF");
    const egpShop = fake({ credentialGroup: undefined, planned: false, mock: () => ({ currency: "EGP", products: [] }) });
    expect((await loadDataset(RANGE, {}, [egpShop])).currency).toBe("EGP");
  });

  it("generates deterministic demo data", async () => {
    const [a, b] = await Promise.all([loadDataset(RANGE, {}), loadDataset(RANGE, {})]);
    expect(a.orders.length).toBeGreaterThan(0);
    expect(a.orders).toEqual(b.orders);
  });
});
