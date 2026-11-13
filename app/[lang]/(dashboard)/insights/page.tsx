import Link from "next/link";
import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageData } from "@/components/PageData";
import { InsightCard } from "@/components/InsightCard";
import { getBriefing, getInsights } from "@/lib/insights/report";
import { formatMoney } from "@/lib/format";
import { localeHref } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/page";
import type { PageContext } from "@/lib/page-context";

export default async function InsightsPage({ searchParams }: PageProps<"/[lang]/insights">) {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t("insights.title")} description={t("insights.description")} />
      <PageData searchParams={searchParams}>{(ctx) => <Insights ctx={ctx} />}</PageData>
    </>
  );
}

async function Insights({ ctx }: { ctx: PageContext }) {
  const { t, rich } = ctx.i18n;
  const { currency, insights } = await getInsights(ctx.preset, ctx.today, ctx.creds, ctx.locale);
  const totalImpact = insights.reduce((s, i) => s + i.impact, 0);

  return (
    <div className="space-y-6">
      {/* The LLM briefing is slower – stream it independently of the rule-based findings. */}
      <Suspense fallback={<Skeleton className="h-48" />}>
        <Briefing ctx={ctx} />
      </Suspense>

      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{t("insights.count", { count: insights.length })}</h2>
        <p className="text-sm text-muted">
          {rich("insights.potential", { amount: <span className="font-semibold text-good">≈ {formatMoney(totalImpact, currency)}</span> })}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {insights.map((i) => (
          <InsightCard key={i.id} insight={i} currency={currency} />
        ))}
      </div>
    </div>
  );
}

async function Briefing({ ctx }: { ctx: PageContext }) {
  const { t, rich } = ctx.i18n;
  const briefing = await getBriefing(ctx.preset, ctx.today, ctx.creds, ctx.locale);
  if (!briefing) {
    return (
      <Card title={t("insights.briefing")}>
        <p className="text-sm text-muted">
          {rich("insights.briefingMissing", {
            link: (
              <Link href={localeHref(ctx.locale, "/settings")} className="font-medium text-accent underline">
                {t("nav.settings")}
              </Link>
            ),
          })}
        </p>
      </Card>
    );
  }
  return (
    <Card title={t("insights.briefing")} subtitle={t("insights.briefingBy", { model: briefing.model })}>
      <div className="prose-chat text-sm">
        <ReactMarkdown>{briefing.text}</ReactMarkdown>
      </div>
    </Card>
  );
}
