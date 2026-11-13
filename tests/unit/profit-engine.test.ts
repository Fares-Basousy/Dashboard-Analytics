import { describe, expect, it } from "vitest";
import { campaignPerformance, categoryProfits, channelPerformance, dailySeries, lossMakingOrders, productProfits, summarize } from "@/lib/profit/engine";
import { tinyDataset } from "../fixtures/dataset";

describe("profit engine", () => {
  const ds = tinyDataset();

  it("computes the store P&L after all costs", () => {
    const s = summarize(ds);
    expect(s).toMatchObject({ revenue: 290, cogs: 128, refunds: 100, shippingCost: 20, paymentFees: 10, adSpend: 80, grossProfit: 32, netProfit: -48, orders: 2 });
    expect(s.margin).toBeCloseTo(-48 / 290);
    expect(s.poas).toBeCloseTo(32 / 80);
    expect(s.returnRate).toBeCloseTo(1 / 4);
  });

  it("allocates order costs by revenue share and ad spend by SKU, then by revenue share", () => {
    const a = productProfits(ds).find((p) => p.sku === "A")!;
    expect(a.revenue).toBe(280);
    expect(a.shippingCost).toBeCloseTo(10 * (100 / 110) + 10, 2);
    expect(a.paymentFees).toBeCloseTo(5 * (100 / 110) + 5, 2);
    // 50 direct (SKU campaign) + 30 generic spread by revenue share 280/290
    expect(a.adSpend).toBeCloseTo(50 + 30 * (280 / 290), 2);
    expect(a.unitsSold).toBe(3);
    expect(a.returnRate).toBeCloseTo(1 / 3);
  });

  it("product rows add up to the store total", () => {
    const products = productProfits(ds);
    expect(products.reduce((s, p) => s + p.netProfit, 0)).toBeCloseTo(summarize(ds).netProfit, 1);
  });

  it("scores campaigns by POAS using the advertised product's margin", () => {
    const [g, m] = campaignPerformance(ds);
    const aGrossRatio = productProfits(ds).find((p) => p.sku === "A")!;
    expect(g.roas).toBe(6);
    expect(g.poas).toBeCloseTo((300 * (aGrossRatio.grossProfit / aGrossRatio.revenue)) / 50, 2);
    expect(m.poas).toBeCloseTo((60 * (32 / 290)) / 30, 2);
    expect(m.netProfit).toBeLessThan(0);
  });

  it("aggregates channels and categories", () => {
    const channels = channelPerformance(campaignPerformance(ds));
    expect(channels.map((c) => c.channel).sort()).toEqual(["google_ads", "meta"]);
    expect(categoryProfits(productProfits(ds)).map((c) => c.category).sort()).toEqual(["Dishwasher", "Washer"]);
  });

  it("daily series sums to the same net profit as the P&L", () => {
    const series = dailySeries(ds);
    expect(series.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-02"]);
    expect(series.reduce((s, d) => s + d.netProfit, 0)).toBeCloseTo(-48, 1);
    expect(series.reduce((s, d) => s + d.adSpend, 0)).toBe(80);
  });

  it("finds orders that lose money before ads", () => {
    const ds2 = tinyDataset();
    ds2.orders.push({ id: "o3", date: "2026-11-02", shippingCost: 10, paymentFee: 1, lines: [{ sku: "B", qty: 1, unitPrice: 10, discount: 0 }] });
    const res = lossMakingOrders(ds2);
    expect(res.count).toBe(1);
    expect(res.loss).toBeCloseTo(10 - 8 - 10 - 1);
  });

  it("spreads spend of campaigns tagged with an unknown SKU instead of creating a phantom product", () => {
    const ds2 = tinyDataset();
    ds2.campaigns[0].sku = "DOES-NOT-EXIST";
    const products = productProfits(ds2);
    expect(products.map((p) => p.sku).sort()).toEqual(["A", "B"]);
    expect(products.reduce((s, p) => s + p.adSpend, 0)).toBeCloseTo(80, 2);
  });

  it("gives free items no share of order costs", () => {
    const ds2 = tinyDataset();
    ds2.orders[1].lines.push({ sku: "B", qty: 1, unitPrice: 10, discount: 10 }); // free gift in o2
    const a = productProfits(ds2).find((p) => p.sku === "A")!;
    expect(a.shippingCost).toBeCloseTo(10 * (100 / 110) + 10, 2);
  });

  it("handles an empty dataset without NaN", () => {
    const s = summarize({ ...ds, orders: [], refunds: [], adSpend: [] });
    expect(s.margin).toBe(0);
    expect(s.poas).toBe(0);
    expect(Number.isNaN(s.aov)).toBe(false);
  });
});
