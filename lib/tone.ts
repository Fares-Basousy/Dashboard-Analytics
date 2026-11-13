/** Semantic coloring rules shared by tables, KPIs and badges. */
export type Tone = "good" | "bad" | "warn" | "info" | "neutral";
export type ToneRule = "signed" | "poas" | "returnRate";

export function toneFor(rule: ToneRule, v: number): Tone {
  switch (rule) {
    case "signed":
      return v < 0 ? "bad" : v > 0 ? "good" : "neutral";
    case "poas":
      return v < 1 ? "bad" : v < 2 ? "warn" : "good";
    case "returnRate":
      return v >= 0.15 ? "bad" : v >= 0.08 ? "warn" : "neutral";
  }
}

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-good",
  bad: "text-bad",
  warn: "text-warn",
  info: "text-accent",
  neutral: "",
};

export const TONE_BADGE: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  info: "bg-accent-soft text-accent",
  neutral: "bg-surface-2 text-muted",
};
