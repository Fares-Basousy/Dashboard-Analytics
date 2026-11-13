import { describe, expect, it } from "vitest";
import { detectInsights, sliceDataset } from "@/lib/insights/rules";
import { loadDataset } from "@/lib/connectors/registry";
import { tinyDataset } from "../fixtures/dataset";

describe("insight rules", () => {
  it("flags campaigns with POAS < 1 as losses with a positive impact estimate", () => {
    const insights = detectInsights(tinyDataset());
    const loss = insights.find((i) => i.id === "campaign-loss:m-1");
    expect(loss).toBeDefined();
    expect(loss!.kind).toBe("loss");
    expect(loss!.impactChf).toBeGreaterThan(0);
  });

  it("sorts critical findings first", () => {
    const order = { critical: 0, warning: 1, info: 2 };
    const ranks = detectInsights(tinyDataset()).map((i) => order[i.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("produces no insights and no errors for an empty period", () => {
    const empty = { ...tinyDataset(), orders: [], refunds: [], adSpend: [] };
    expect(detectInsights(empty)).toEqual([]);
  });

  it("slices a dataset to a sub-range", () => {
    const s = sliceDataset(tinyDataset(), "2026-11-02", "2026-11-02");
    expect(s.orders.map((o) => o.id)).toEqual(["o2"]);
    expect(s.adSpend.map((a) => a.campaignId)).toEqual(["m-1"]);
  });

  it("finds the problems planted in the demo world", async () => {
    const ds = await loadDataset({ from: "2026-10-15", to: "2026-11-13" }, {});
    const ids = detectInsights(ds).map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "campaign-loss:g-104", // ad for a product that loses money
        "campaign-loss:m-204", // awareness campaign with ROAS 0.35
        "product-loss:ETS-SA-AKKU", // high-return battery
        "campaign-scale:g-102", // brand search, POAS > 2
        "budget-shift",
        "small-orders",
      ]),
    );
  });
});
