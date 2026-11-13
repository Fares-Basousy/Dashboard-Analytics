import type { ProfitBreakdown as Breakdown } from "@/lib/domain/types";
import { formatMoney, formatPercent, safeDiv } from "@/lib/format";

/** "Where the money goes": every cost line as a share of revenue. */
export function ProfitBreakdown({ data, currency }: { data: Breakdown; currency: string }) {
  const rows = [
    { label: "Product cost (COGS)", value: data.cogs },
    { label: "Ad spend", value: data.adSpend },
    { label: "Shipping", value: data.shippingCost },
    { label: "Refunds", value: data.refunds },
    { label: "Payment fees", value: data.paymentFees },
  ];
  return (
    <div className="space-y-3">
      <Row label="Revenue" value={data.revenue} share={1} tone="bg-accent" currency={currency} />
      {rows.map((r) => (
        <Row key={r.label} label={`− ${r.label}`} value={r.value} share={safeDiv(r.value, data.revenue)} tone="bg-bad/70" currency={currency} />
      ))}
      <div className="border-t border-border pt-3">
        <Row label="= Net profit" value={data.netProfit} share={Math.max(0, data.margin)} tone="bg-good" currency={currency} bold />
      </div>
    </div>
  );
}

function Row({ label, value, share, tone, currency, bold }: { label: string; value: number; share: number; tone: string; currency: string; bold?: boolean }) {
  return (
    <div>
      <div className={`flex justify-between text-sm ${bold ? "font-semibold" : ""}`}>
        <span>{label}</span>
        <span className="tabular-nums">
          {formatMoney(value, currency)} <span className="text-xs text-muted">({formatPercent(share)})</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-surface-2">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
      </div>
    </div>
  );
}
