import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { getDataset } from "@/lib/data/dataset";
import { getCredentials } from "@/lib/credentials/store";
import { DEFAULT_PRESET, isPreset, presetRange, toISODate } from "@/lib/date-range";
import { getModel } from "@/lib/ai/provider";
import { createTools, systemPrompt } from "@/lib/ai/tools";
import { DEFAULT_LOCALE, isLocale, LANGUAGE_NAMES } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";

// Thinking models (Nemotron, enable_thinking, up to 16k tokens) need headroom beyond 60s.
export const maxDuration = 300;

const MAX_TOOL_STEPS = 6;

export async function POST(req: Request) {
  const { messages, preset, locale: requested }: { messages: UIMessage[]; preset?: string; locale?: string } = await req.json();
  // Route Handlers can't read the URL language (next/root-params), so the chat sends it.
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const translator = await getTranslator(locale);
  // Keys come from the encrypted httpOnly cookie (or server env) – never from the request body.
  const creds = await getCredentials();
  const ctx = {
    load: (range: Parameters<typeof getDataset>[0]) => getDataset(range, creds),
    today: toISODate(new Date()),
    defaultPreset: isPreset(preset) ? preset : DEFAULT_PRESET,
    translator,
    language: LANGUAGE_NAMES[locale],
  };

  // Cached – also warms the data the tools will read.
  const { currency } = await ctx.load(presetRange(ctx.defaultPreset, ctx.today));

  const result = streamText({
    model: getModel(creds, translator).model,
    system: systemPrompt(ctx, currency),
    messages: await convertToModelMessages(messages),
    tools: createTools(ctx),
    stopWhen: isStepCount(MAX_TOOL_STEPS),
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
