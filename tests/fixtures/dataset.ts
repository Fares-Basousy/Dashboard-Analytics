import type { Dataset } from "@/lib/domain/types";

/**
 * Tiny hand-calculable world:
 * - A: price 100, cost 40 | B: price 10, cost 8
 * - o1 (Nov 1): 1×A + 1×B, shipping 10, fee 5   → revenue 110
 * - o2 (Nov 2): 2×A with CHF 20 discount, shipping 10, fee 5 → revenue 180
 * - refund: 1×A for CHF 100 on Nov 2
 * - g-1 (Google, promotes A): spend 50, conv. value 300 | m-1 (Meta, generic): spend 30, conv. value 60
 * Totals: revenue 290, COGS 128, refunds 100, shipping 20, fees 10, ads 80 → gross 32, net −48.
 */
export function tinyDataset(): Dataset {
  return {
    range: { from: "2026-11-01", to: "2026-11-02" },
    products: [
      { sku: "A", title: "Pump", category: "Washer", price: 100, unitCost: 40 },
      { sku: "B", title: "Seal", category: "Dishwasher", price: 10, unitCost: 8 },
    ],
    orders: [
      { id: "o1", date: "2026-11-01", shippingCost: 10, paymentFee: 5, lines: [ { sku: "A", qty: 1, unitPrice: 100, discount: 0 }, { sku: "B", qty: 1, unitPrice: 10, discount: 0 } ] },
      { id: "o2", date: "2026-11-02", shippingCost: 10, paymentFee: 5, lines: [ { sku: "A", qty: 2, unitPrice: 100, discount: 20 } ] },
    ],
    refunds: [{ orderId: "o1", date: "2026-11-02", sku: "A", qty: 1, amount: 100 }],
    campaigns: [
      { id: "g-1", channel: "google_ads", name: "Shopping A [sku:A]", type: "SHOPPING", status: "active", sku: "A" },
      { id: "m-1", channel: "meta", name: "Prospecting", type: "CONVERSIONS", status: "active" },
    ],
    adSpend: [
      { campaignId: "g-1", date: "2026-11-01", spend: 50, impressions: 1000, clicks: 40, conversions: 3, conversionValue: 300 },
      { campaignId: "m-1", date: "2026-11-02", spend: 30, impressions: 2000, clicks: 20, conversions: 1, conversionValue: 60 },
    ],
    sources: [],
  };
}
