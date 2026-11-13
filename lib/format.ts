/** Formatting shared by server and client. Money is always formatted in the dataset's currency. */

export const DEFAULT_CURRENCY = "CHF";
const LOCALE = "de-CH";

const num = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 1 });

/** Intl formatters are expensive to create – keep one per currency. */
const moneyFormatters = new Map<string, Intl.NumberFormat>();
function moneyFormatter(currency: string): Intl.NumberFormat {
  let f = moneyFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { style: "currency", currency, maximumFractionDigits: 0 });
    moneyFormatters.set(currency, f);
  }
  return f;
}

/** "CHF 1'234", "EGP 1'234", with a leading minus ("−CHF 915") instead of the locale default "CHF-915". */
export function formatMoney(v: number, currency: string = DEFAULT_CURRENCY): string {
  const f = moneyFormatter(currency);
  return v < 0 ? `−${f.format(-v)}` : f.format(v);
}

export const formatNumber = (v: number) => num.format(v);
export const formatRatio = (v: number) => (Number.isFinite(v) ? `${dec.format(v)}×` : "–");
export const formatPercent = (v: number) => (Number.isFinite(v) ? pct.format(v) : "–");

export const round2 = (v: number) => Math.round(v * 100) / 100;
export const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export type ValueFormat = "money" | "number" | "percent" | "ratio" | "text";

/** One formatter for tables, KPIs and charts (column configs reference formats by name). */
export function formatValue(format: ValueFormat, v: unknown, currency: string = DEFAULT_CURRENCY): string {
  if (format === "text" || typeof v !== "number") return String(v ?? "–");
  if (format === "money") return formatMoney(v, currency);
  return { number: formatNumber, percent: formatPercent, ratio: formatRatio }[format](v);
}
