const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("de-CH", { style: "percent", maximumFractionDigits: 1 });

/** Leading minus ("−CHF 915") instead of the locale default "CHF-915". */
export const formatChf = (v: number) => (v < 0 ? `−${chf.format(-v)}` : chf.format(v));
export const formatNumber = (v: number) => num.format(v);
export const formatRatio = (v: number) => (Number.isFinite(v) ? `${dec.format(v)}×` : "–");
export const formatPercent = (v: number) => (Number.isFinite(v) ? pct.format(v) : "–");

export const round2 = (v: number) => Math.round(v * 100) / 100;
export const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export type ValueFormat = "chf" | "number" | "percent" | "ratio" | "text";

/** One formatter for tables, KPIs and charts (column configs reference formats by name). */
export function formatValue(format: ValueFormat, v: unknown): string {
  if (format === "text" || typeof v !== "number") return String(v ?? "–");
  return { chf: formatChf, number: formatNumber, percent: formatPercent, ratio: formatRatio }[format](v);
}
