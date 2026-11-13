import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defaultSettingsMiddleware, wrapLanguageModel, type LanguageModel } from "ai";

/**
 * NVIDIA NIM (build.nvidia.com) – OpenAI-compatible Chat Completions API.
 * Settings follow NVIDIA's reference request for nemotron-3.5-super-vl-120b-a12b:
 *   temperature 1, top_p 0.95, max_tokens 16384, seed 42, parallel_tool_calls,
 *   chat_template_kwargs.enable_thinking = true, stream = true.
 * Streamed `reasoning_content` deltas are mapped to reasoning parts by the AI SDK.
 */
export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b";

/** Name used for the provider and its `providerOptions` key. */
const PROVIDER_NAME = "nvidia";

export const NVIDIA_SETTINGS = {
  temperature: 1,
  topP: 0.95,
  maxOutputTokens: 16384,
  seed: 42,
  providerOptions: {
    // Passed through verbatim into the request body.
    [PROVIDER_NAME]: {
      parallel_tool_calls: true,
      chat_template_kwargs: { enable_thinking: true },
    },
  },
};

/** Every call (chat stream, briefing) gets NVIDIA's recommended settings via middleware. */
export function createNvidiaModel(modelId: string, apiKey: string | undefined, fetchImpl?: typeof fetch): LanguageModel {
  const provider = createOpenAICompatible({
    name: PROVIDER_NAME,
    baseURL: NVIDIA_BASE_URL,
    apiKey,
    includeUsage: true,
    fetch: fetchImpl,
  });
  return wrapLanguageModel({
    model: provider.chatModel(modelId),
    middleware: defaultSettingsMiddleware({ settings: NVIDIA_SETTINGS }),
  });
}
