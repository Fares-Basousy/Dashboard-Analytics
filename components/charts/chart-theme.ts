/** Shared chart styling so every chart looks the same. */
export const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"] as const;

export const axisProps = {
  stroke: "var(--muted)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const tooltipProps = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--text)",
  },
  labelStyle: { color: "var(--muted)" },
} as const;

/** Compact axis labels: 12'300 → 12k. */
export const compactNumber = (v: number) => new Intl.NumberFormat("de-CH", { notation: "compact", maximumFractionDigits: 1 }).format(v);
