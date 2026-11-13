import { describe, expect, it } from "vitest";
import { daysBetween, eachDay, isPreset, presetRange, previousRange } from "@/lib/date-range";
import { formatMoney, formatRatio, formatValue, safeDiv } from "@/lib/format";
import { toneFor } from "@/lib/tone";

describe("date ranges", () => {
  it("builds presets ending today and the previous period", () => {
    const r = presetRange("7d", "2026-11-13");
    expect(r).toEqual({ from: "2026-11-07", to: "2026-11-13" });
    expect(daysBetween(r)).toBe(7);
    expect(previousRange(r)).toEqual({ from: "2026-10-31", to: "2026-11-06" });
    expect(eachDay(r)).toHaveLength(7);
  });

  it("validates presets", () => {
    expect(isPreset("30d")).toBe(true);
    expect(isPreset("1y")).toBe(false);
    expect(isPreset(undefined)).toBe(false);
  });
});

describe("formatting & tones", () => {
  it("formats money with a leading minus", () => {
    expect(formatMoney(-915)).toMatch(/^−CHF/);
    expect(formatMoney(1234, "EGP")).toMatch(/^EGP/);
    expect(formatValue("money", 10, "EUR")).toMatch(/€|EUR/);
    expect(formatValue("ratio", 2)).toBe(formatRatio(2));
    expect(formatValue("text", undefined)).toBe("–");
  });

  it("never divides by zero", () => expect(safeDiv(1, 0)).toBe(0));

  it("colors POAS by profitability", () => {
    expect([0.5, 1.5, 3].map((v) => toneFor("poas", v))).toEqual(["bad", "warn", "good"]);
  });
});
