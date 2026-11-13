import { describe, expect, it } from "vitest";
import { streamText, tool } from "ai";
import { z } from "zod";
import { createNvidiaModel, NVIDIA_BASE_URL, NVIDIA_DEFAULT_MODEL } from "@/lib/ai/nvidia";

/** SSE stream shaped like NVIDIA NIM's: reasoning first, then the answer. */
function nimStream(): Response {
  const chunk = (delta: object, finish: string | null = null) =>
    `data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", created: 0, model: NVIDIA_DEFAULT_MODEL, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
  const body =
    chunk({ role: "assistant", reasoning_content: "Checking POAS per campaign. " }) +
    chunk({ content: "PMax loses money." }) +
    chunk({}, "stop") +
    "data: [DONE]\n\n";
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

describe("NVIDIA Nemotron model", () => {
  it("sends the request exactly as in NVIDIA's guide and streams reasoning + text", async () => {
    let url = "";
    let request: Record<string, unknown> = {};
    let auth: string | null = null;
    const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      url = String(input);
      request = JSON.parse(String(init?.body));
      auth = new Headers(init?.headers).get("authorization");
      return nimStream();
    }) as typeof fetch;

    const result = streamText({
      model: createNvidiaModel(NVIDIA_DEFAULT_MODEL, "nvapi-test", fakeFetch),
      prompt: "Where are we losing money?",
      tools: { getInsights: tool({ description: "insights", inputSchema: z.object({}), execute: async () => [] }) },
    });

    expect(await result.text).toBe("PMax loses money.");
    expect(await result.reasoningText).toBe("Checking POAS per campaign. ");

    expect(url).toBe(`${NVIDIA_BASE_URL}/chat/completions`);
    expect(auth).toBe("Bearer nvapi-test");
    expect(request).toMatchObject({
      model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      seed: 42,
      parallel_tool_calls: true,
      chat_template_kwargs: { enable_thinking: true },
      stream: true,
    });
    expect((request.tools as { function: { name: string } }[])[0].function.name).toBe("getInsights");
  });
});
