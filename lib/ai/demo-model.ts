/**
 * Offline "demo" language model (no API key needed). It goes through the real tool loop:
 * step 1 calls the `getInsights` tool, step 2 summarises the tool result. Used when no LLM key
 * is configured and in e2e tests, so the chat is always functional and deterministic.
 */
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import type { Insight } from "@/lib/domain/types";
import { formatMoney } from "@/lib/format";

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

type PromptMessage = { role: string; content: unknown };

function lastToolResult(prompt: PromptMessage[]): unknown {
  const last = prompt.at(-1);
  if (last?.role !== "tool" || !Array.isArray(last.content)) return undefined;
  const part = last.content.find((p: { type: string }) => p.type === "tool-result");
  return part?.output?.value;
}

/** Shape returned by the `getInsights` tool. */
export interface InsightsToolResult {
  currency: string;
  insights: Insight[];
}

export function renderInsightsAnswer({ currency, insights }: InsightsToolResult): string {
  if (!insights.length) return "No issues detected in this period – all campaigns and products are profitable.";
  const lines = insights
    .slice(0, 5)
    .map((i, n) => `${n + 1}. **${i.title}** – ${i.recommendation} _(≈ ${formatMoney(i.impact, currency)}/month)_`);
  return [
    "_Demo mode: rule-based answer (no LLM key configured)._",
    "",
    "Here is where you are losing money and what to do about it:",
    "",
    ...lines,
  ].join("\n");
}

type DemoStep =
  | { kind: "tool-call"; toolCallId: string; toolName: string; input: string }
  | { kind: "text"; text: string };

/** The demo model's only decision: fetch insights first, then answer from them. */
function nextStep(prompt: PromptMessage[]): DemoStep {
  const result = lastToolResult(prompt);
  return result === undefined
    ? { kind: "tool-call", toolCallId: `call-${Date.now()}`, toolName: "getInsights", input: "{}" }
    : { kind: "text", text: renderInsightsAnswer(result as InsightsToolResult) };
}

export function createDemoModel() {
  return new MockLanguageModelV4({
    modelId: "demo",
    doGenerate: async ({ prompt }) => {
      const step = nextStep(prompt as PromptMessage[]);
      return step.kind === "tool-call"
        ? {
            content: [{ type: "tool-call", toolCallId: step.toolCallId, toolName: step.toolName, input: step.input }],
            finishReason: { unified: "tool-calls", raw: undefined },
            usage,
            warnings: [],
          }
        : { content: [{ type: "text", text: step.text }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
    },
    doStream: async ({ prompt }) => {
      const step = nextStep(prompt as PromptMessage[]);
      if (step.kind === "tool-call") {
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: "tool-call", toolCallId: step.toolCallId, toolName: step.toolName, input: step.input },
              { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
            ],
          }),
        };
      }
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t1" },
            { type: "text-delta", id: "t1", delta: step.text },
            { type: "text-end", id: "t1" },
            { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
          ],
        }),
      };
    },
  });
}
