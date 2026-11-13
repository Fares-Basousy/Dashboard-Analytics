import type { DateRange, ISODate } from "./domain/types";

export const PRESETS = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type Preset = keyof typeof PRESETS;
export const DEFAULT_PRESET: Preset = "30d";

const DAY = 86_400_000;

export const toISODate = (d: Date): ISODate => d.toISOString().slice(0, 10);
export const addDays = (date: ISODate, days: number): ISODate =>
  toISODate(new Date(Date.parse(date) + days * DAY));
export const daysBetween = (r: DateRange) => Math.round((Date.parse(r.to) - Date.parse(r.from)) / DAY) + 1;
export const inRange = (date: ISODate, r: DateRange) => date >= r.from && date <= r.to;

export function eachDay(r: DateRange): ISODate[] {
  const out: ISODate[] = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isPreset(v: unknown): v is Preset {
  return typeof v === "string" && v in PRESETS;
}

/** Range ending "today" (UTC). `today` is injectable for tests and cache keys. */
export function presetRange(preset: Preset, today: ISODate): DateRange {
  return { from: addDays(today, -(PRESETS[preset] - 1)), to: today };
}

/** The equally long period directly before `r` (for period-over-period deltas). */
export function previousRange(r: DateRange): DateRange {
  const len = daysBetween(r);
  return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
}
