import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGateway } from "ai";
import type { Credentials } from "@/lib/credentials/fields";
import { createDemoModel } from "./demo-model";

type ProviderId = "anthropic" | "openai" | "gateway" | "demo";

const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-6-astra",
  gateway: "anthropic/claude-sonnet-5.5",
  demo: "rule-based",
};

const FACTORIES: Record<ProviderId, (id: string, creds: Credentials) => LanguageModel> = {
  anthropic: (id, c) => createAnthropic({ apiKey: c.ANTHROPIC_API_KEY })(id),
  openai: (id, c) => createOpenAI({ apiKey: c.OPENAI_API_KEY })(id),
  gateway: (id, c) => createGateway({ apiKey: c.AI_GATEWAY_API_KEY })(id),
  demo: () => createDemoModel(),
};

/** Explicit AI_PROVIDER wins; otherwise the first provider that has a key. */
function detectProvider(creds: Credentials): ProviderId {
  const explicit = creds.AI_PROVIDER as ProviderId | undefined;
  if (explicit && explicit in FACTORIES) return explicit;
  if (creds.ANTHROPIC_API_KEY) return "anthropic";
  if (creds.OPENAI_API_KEY) return "openai";
  if (creds.AI_GATEWAY_API_KEY) return "gateway";
  return "demo";
}

/**
 * Swap provider/model via saved keys or env vars: AI_PROVIDER=anthropic|openai|gateway|demo, AI_MODEL=<model id>.
 * Without any key the offline demo model is used, so the app always works.
 */
export function getModel(creds: Credentials): { model: LanguageModel; label: string; isDemo: boolean } {
  const provider = detectProvider(creds);
  const id = creds.AI_MODEL || DEFAULT_MODELS[provider];
  return { model: FACTORIES[provider](id, creds), label: `${provider}/${id}`, isDemo: provider === "demo" };
}
