import type { ReactNode } from "react";
import { TONE_BADGE, type Tone } from "@/lib/tone";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_BADGE[tone]}`}>{children}</span>;
}
