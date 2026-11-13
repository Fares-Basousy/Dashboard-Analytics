import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createNvidiaModel, NVIDIA_DEFAULT_MODEL } from "./nvidia";
import { createGateway } from "ai";
import type { Credentials } from "@/lib/credentials/fields";
import { createDemoModel } from "./demo-model";
import type { Translator } from "@/lib/i18n/translate";

type ProviderId = "nvidia" | "anthropic" | "openai" | "gateway" | "demo";

const DEFAULT_MODELS: Record<ProviderId, string> = {
  nvidia: NVIDIA_DEFAULT_MODEL,
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-6-astra",
  gateway: "anthropic/claude-sonnet-5.5",
  demo: "rule-based",
};

const FACTORIES: Record<ProviderId, (id: string, creds: Credentials, translator?: Pick<Translator, "t">) => LanguageModel> = {
  nvidia: (id, c) => createNvidiaModel(id, c.NVIDIA_API_KEY),
  anthropic: (id, c) => createAnthropic({ apiKey: c.ANTHROPIC_API_KEY })(id),
  openai: (id, c) => createOpenAI({ apiKey: c.OPENAI_API_KEY })(id),
  gateway: (id, c) => createGateway({ apiKey: c.AI_GATEWAY_API_KEY })(id),
  demo: (_id, _c, translator) => createDemoModel(translator),
};

/** Explicit AI_PROVIDER wins; otherwise the first provider that has a key. */
function detectProvider(creds: Credentials): ProviderId {
  const explicit = creds.AI_PROVIDER as ProviderId | undefined;
  if (explicit && explicit in FACTORIES) return explicit;
  if (creds.NVIDIA_API_KEY) return "nvidia";
  if (creds.ANTHROPIC_API_KEY) return "anthropic";
  if (creds.OPENAI_API_KEY) return "openai";
  if (creds.AI_GATEWAY_API_KEY) return "gateway";
  return "demo";
}

/**
 * Swap provider/model via saved keys or env vars: AI_PROVIDER=nvidia|anthropic|openai|gateway|demo, AI_MODEL=<model id>.
 * Without any key the offline demo model is used, so the app always works.
 */
/** `translator` localizes the offline demo model's answers; real models are told the language in the prompt. */
export function getModel(creds: Credentials, translator?: Pick<Translator, "t">): { model: LanguageModel; label: string; isDemo: boolean } {
  const provider = detectProvider(creds);
  const id = creds.AI_MODEL || DEFAULT_MODELS[provider];
  // Avoid "nvidia/nvidia/…" when the model id is already namespaced by its provider.
  const label = id.startsWith(`${provider}/`) ? id : `${provider}/${id}`;
  return { model: FACTORIES[provider](id, creds, translator), label, isDemo: provider === "demo" };
}
