import { describe, expect, it } from "vitest";
import { generateText, isStepCount } from "ai";
import { createTools } from "@/lib/ai/tools";
import { createDemoModel, renderInsightsAnswer } from "@/lib/ai/demo-model";
import { getModel } from "@/lib/ai/provider";
import { loadDataset } from "@/lib/connectors/registry";
import { detectInsights } from "@/lib/insights/rules";
import { productProfits } from "@/lib/profit/engine";
import { presetRange } from "@/lib/date-range";

const TODAY = "2026-11-13";
const ctx = { load: (r: Parameters<typeof loadDataset>[0]) => loadDataset(r, {}), today: TODAY, defaultPreset: "30d" as const };
const toolOpts = { toolCallId: "t", messages: [], context: {} };

describe("AI tools", () => {
  const tools = createTools(ctx);

  it("return the same numbers as the profit engine (no invented figures)", async () => {
    const res = await tools.getProductProfitability.execute!({ sortBy: "netProfit", order: "asc", limit: 3 }, toolOpts);
    const engine = productProfits(await ctx.load(presetRange("30d", TODAY))).sort((a, b) => a.netProfit - b.netProfit);
    expect((res as { products: { sku: string; netProfit: number }[] }).products.map((p) => p.sku)).toEqual(engine.slice(0, 3).map((p) => p.sku));
  });

  it("respects the requested period", async () => {
    const res = (await tools.getProfitSummary.execute!({ period: "7d" }, toolOpts)) as { range: { from: string; to: string } };
    expect(res.range).toEqual({ from: "2026-11-07", to: TODAY });
  });

  it("filters marketing performance by channel", async () => {
    const res = (await tools.getMarketingPerformance.execute!({ channel: "meta" }, toolOpts)) as { campaigns: { channel: string }[] };
    expect(res.campaigns.every((c) => c.channel === "meta")).toBe(true);
  });
});

describe("demo model", () => {
  it("runs the real tool loop and answers from the tool result", async () => {
    const { text, steps } = await generateText({ model: createDemoModel(), prompt: "Where are we losing money?", tools: createTools(ctx), stopWhen: isStepCount(3) });
    expect(steps[0].toolCalls[0].toolName).toBe("getInsights");
    const top = detectInsights(await ctx.load(presetRange("30d", TODAY)))[0];
    expect(text).toContain(top.title);
  });

  it("handles a period without findings", () => {
    expect(renderInsightsAnswer([])).toMatch(/No issues/);
  });
});

describe("provider selection", () => {
  it.each([
    [{}, "demo"],
    [{ OPENAI_API_KEY: "sk" }, "openai"],
    [{ OPENAI_API_KEY: "sk", ANTHROPIC_API_KEY: "a" }, "anthropic"],
    [{ ANTHROPIC_API_KEY: "a", AI_PROVIDER: "openai", AI_MODEL: "gpt-x" }, "openai/gpt-x"],
    [{ NVIDIA_API_KEY: "nvapi-x", ANTHROPIC_API_KEY: "a" }, "nvidia/nemotron-3.5-super-vl-120b-a12b"],
  ])("%j → %s", (creds, expected) => {
    expect(getModel(creds).label.startsWith(expected)).toBe(true);
  });
});
