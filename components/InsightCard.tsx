import type { Insight, InsightKind, Severity } from "@/lib/domain/types";
import { formatMoney } from "@/lib/format";
import { getI18n } from "@/lib/i18n/page";
import type { Tone } from "@/lib/tone";
import { Badge } from "@/components/ui/Badge";

const SEVERITY_TONE: Record<Severity, Tone> = { critical: "bad", warning: "warn", info: "good" };

export async function InsightCard({ insight, currency, compact = false }: { insight: Insight; currency: string; compact?: boolean }) {
  const { t } = await getI18n();
  return (
    <article className="rounded-xl border border-border bg-surface p-4" data-testid="insight">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={SEVERITY_TONE[insight.severity]}>{t(`severity.${insight.severity}`)}</Badge>
        <Badge>{t(`kind.${insight.kind satisfies InsightKind}`)}</Badge>
        <span className="ml-auto text-xs font-medium text-good">{t("insights.perMonth", { amount: formatMoney(insight.impact, currency) })}</span>
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
