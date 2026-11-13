import { describe, expect, it, vi } from "vitest";
import { en, type MessageKey } from "@/lib/i18n/messages/en";
import { de } from "@/lib/i18n/messages/de";
import { sv } from "@/lib/i18n/messages/sv";
import { resolveMessages, type TranslateBatch } from "@/lib/i18n/resolve";
import { createTranslator, interpolate, placeholders } from "@/lib/i18n/translate";
import { localeHref, preferredLocale, stripLocale } from "@/lib/i18n/config";
import { parseJsonObject } from "@/lib/i18n/ai-translate";
import { detectInsights } from "@/lib/insights/rules";
import { tinyDataset } from "../fixtures/dataset";
import type { ReactElement } from "react";

describe.each([
  ["Swedish", sv],
  ["German", de],
])("%s dictionary", (_name, dict) => {
  it("only uses keys that exist in English", () => {
    expect(Object.keys(dict).filter((k) => !(k in en))).toEqual([]);
  });

  it("keeps exactly the same {placeholders} as English", () => {
    const broken = (Object.entries(dict) as [MessageKey, string][]).filter(([k, v]) => placeholders(v).join() !== placeholders(en[k]).join());
    expect(broken.map(([k]) => k)).toEqual([]);
  });
});

describe("AI fallback for missing translations", () => {
  const partial = { "nav.overview": "Översikt" };

  it("translates missing texts with the AI and keeps hand-written ones", async () => {
    const translate = vi.fn<TranslateBatch>(async (texts) =>
      Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, `SV:${v}`])),
    );
    const { messages, aiTranslated } = await resolveMessages("sv", partial, translate);
    expect(messages["nav.overview"]).toBe("Översikt");
    expect(messages["nav.products"]).toBe("SV:Products");
    expect(aiTranslated).toContain("nav.products");
    expect(Object.keys(translate.mock.calls[0][0])).not.toContain("nav.overview"); // only missing keys are sent
    expect(translate.mock.calls[0][1]).toBe("Swedish");
  });

  it("rejects AI output that drops or renames a {placeholder} (names must stay untouched)", async () => {
    const translate = async () => ({ "range.last": "Senaste dagarna", "chat.analysed": "↳ analyserade {verktyg}" });
    const { messages } = await resolveMessages("sv", {}, translate);
    expect(messages["range.last"]).toBe(en["range.last"]);
    expect(messages["chat.analysed"]).toBe(en["chat.analysed"]);
  });

  it("falls back to English when the AI fails or there is no AI", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = await resolveMessages("de", {}, async () => Promise.reject(new Error("rate limited")));
    expect(failing.messages["nav.products"]).toBe("Products");
    const none = await resolveMessages("de", {});
    expect(none.messages["nav.products"]).toBe("Products");
  });

  it("never calls the AI for English", async () => {
    const translate = vi.fn();
    await resolveMessages("en", {}, translate);
    expect(translate).not.toHaveBeenCalled();
  });

  it("reads JSON even when the model wraps it in prose or fences", () => {
    expect(parseJsonObject('Here you go:\n```json\n{"a":"b"}\n```')).toEqual({ a: "b" });
    expect(parseJsonObject("no json")).toEqual({});
    expect(parseJsonObject("[1,2]")).toEqual({});
  });
});

describe("translator", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(interpolate("Last {days} days", { days: 7 })).toBe("Last 7 days");
    expect(interpolate("Hi {name}", {})).toBe("Hi {name}");
  });

  it("puts React elements into rich texts", () => {
    const { rich } = createTranslator("en", en);
    const parts = rich("insights.briefingMissing", { link: "LINK" }) as ReactElement<{ children: unknown }>[];
    expect(parts.map((p) => p.props.children).join("")).toBe(en["insights.briefingMissing"].replace("{link}", "LINK"));
  });

  it("shows the key instead of crashing for unknown keys", () => {
    expect(createTranslator("en", en).t("tool.someNewTool" as MessageKey)).toBe("tool.someNewTool");
  });
});

describe("language selection", () => {
  it.each([
    [undefined, "de-CH,de;q=0.9,en;q=0.8", "de"],
    [undefined, "sv-SE,sv;q=0.9", "sv"],
    [undefined, "fr-FR,fr;q=0.9", "en"],
    [undefined, "en;q=0.5, sv", "sv"],
    [undefined, null, "en"],
    ["de", "sv-SE", "de"], // a saved choice beats the browser
    ["xx", "sv-SE", "sv"], // an invalid cookie is ignored
  ] as const)("cookie %s + Accept-Language %s → %s", (cookie, header, expected) => {
    expect(preferredLocale(cookie, header)).toBe(expected);
  });

  it("builds and strips language prefixes", () => {
    expect(localeHref("de", "/")).toBe("/de");
    expect(localeHref("sv", "/products")).toBe("/sv/products");
    expect(stripLocale("/de/products")).toBe("/products");
    expect(stripLocale("/de")).toBe("/");
    expect(stripLocale("/products")).toBe("/products");
  });
});

describe("insights in another language", () => {
  it("translates the sentences but never the names", async () => {
    const { messages } = await resolveMessages("de", de);
    const loss = detectInsights(tinyDataset(), createTranslator("de", messages)).find((i) => i.id === "campaign-loss:m-1")!;
    expect(loss.title).toBe("„Prospecting“ verliert Geld");
    expect(loss.evidence).toContain("Rohgewinn");
  });
});
