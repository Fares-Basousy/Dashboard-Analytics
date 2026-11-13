import { formatPercent, formatValue, safeDiv, type ValueFormat } from "@/lib/format";
import { TONE_TEXT } from "@/lib/tone";

export interface Kpi {
  label: string;
  value: number;
  format: ValueFormat;
  /** Same metric in the previous period → shows a delta. */
  previous?: number;
  /** For costs and return rates a decrease is good. */
  lowerIsBetter?: boolean;
  hint?: string;
}

function Delta({ kpi }: { kpi: Kpi }) {
  if (kpi.previous === undefined || kpi.previous === 0) return null;
  const change = safeDiv(kpi.value - kpi.previous, Math.abs(kpi.previous));
  const improved = kpi.lowerIsBetter ? change < 0 : change > 0;
  return (
    <span className={`text-xs font-medium ${TONE_TEXT[improved ? "good" : "bad"]}`}>
      {change > 0 ? "▲" : "▼"} {formatPercent(Math.abs(change))}
    </span>
  );
}

export function KpiGrid({ items, currency }: { items: Kpi[]; currency: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((kpi) => (
        <div key={kpi.label} className="rounded-xl border border-border bg-surface p-4" data-testid="kpi">
          <p className="text-xs font-medium text-muted">{kpi.label}</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">{formatValue(kpi.format, kpi.value, currency)}</p>
          <div className="mt-1 flex items-center gap-2">
            <Delta kpi={kpi} />
            {kpi.hint && <span className="text-xs text-muted">{kpi.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
