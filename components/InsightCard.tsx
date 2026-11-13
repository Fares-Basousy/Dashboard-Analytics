import type { Insight, InsightKind, Severity } from "@/lib/domain/types";
import { formatMoney } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { Badge } from "@/components/ui/Badge";

const SEVERITY_TONE: Record<Severity, Tone> = { critical: "bad", warning: "warn", info: "good" };
const KIND_LABEL: Record<InsightKind, string> = { loss: "Losing money", opportunity: "Opportunity", budget: "Budget", trend: "Trend" };

export function InsightCard({ insight, currency, compact = false }: { insight: Insight; currency: string; compact?: boolean }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4" data-testid="insight">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={SEVERITY_TONE[insight.severity]}>{insight.severity}</Badge>
        <Badge>{KIND_LABEL[insight.kind]}</Badge>
        <span className="ml-auto text-xs font-medium text-good">≈ {formatMoney(insight.impact, currency)}/month</span>
      </div>
      <h3 className="mt-2 text-sm font-semibold">{insight.title}</h3>
      {!compact && <p className="mt-1 text-sm text-muted">{insight.evidence}</p>}
      <p className="mt-2 text-sm">
        <span className="font-medium">→ </span>
        {insight.recommendation}
      </p>
    </article>
  );
}
