import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { KpiGrid } from "@/components/ui/KpiGrid";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { TrendChart } from "@/components/charts/TrendChart";
import { PageData } from "@/components/PageData";
import { InsightCard } from "@/components/InsightCard";
import { DataSourceNotice } from "@/components/DataSourceNotice";
import { ProfitBreakdown } from "@/components/ProfitBreakdown";
import { getDataset } from "@/lib/data/dataset";
import { getInsights } from "@/lib/insights/report";
import { campaignPerformance, channelPerformance, dailySeries, summarize } from "@/lib/profit/engine";
import { profitKpis } from "@/lib/kpis";
import { withChannelLabel } from "@/lib/labels";
import { localeHref } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/page";
import type { Translator } from "@/lib/i18n/translate";
import type { PageContext } from "@/lib/page-context";
import type { ChannelPerformance } from "@/lib/domain/types";

type ChannelRow = ChannelPerformance & { channelLabel: string };

const channelColumns = (t: Translator["t"]): Column<ChannelRow>[] => [
  { key: "channelLabel", label: t("col.channel") },
  { key: "spend", label: t("col.spend"), format: "money" },
  { key: "roas", label: t("col.roas"), format: "ratio" },
  { key: "poas", label: t("col.poas"), format: "ratio", tone: "poas" },
  { key: "netProfit", label: t("col.netProfit"), format: "money", tone: "signed" },
];

export default async function OverviewPage({ searchParams }: PageProps<"/[lang]">) {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t("overview.title")} description={t("overview.description")} />
      <PageData searchParams={searchParams}>{(ctx) => <Overview ctx={ctx} />}</PageData>
    </>
  );
}

async function Overview({ ctx }: { ctx: PageContext }) {
  const { t } = ctx.i18n;
  const [ds, prev, { insights }] = await Promise.all([
    getDataset(ctx.range, ctx.creds),
    getDataset(ctx.previous, ctx.creds),
    getInsights(ctx.preset, ctx.today, ctx.creds, ctx.locale),
  ]);
  const summary = summarize(ds);
  const channels = channelPerformance(campaignPerformance(ds)).map(withChannelLabel);

  return (
    <div className="space-y-6">
      <DataSourceNotice sources={ds.sources} />
      <KpiGrid items={profitKpis(summary, summarize(prev), t)} currency={ds.currency} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t("overview.trend")} subtitle={t("overview.daily")} className="lg:col-span-2">
          <TrendChart
            data={dailySeries(ds)}
            xKey="date"
            series={[
              { key: "revenue", label: t("series.revenue") },
              { key: "netProfit", label: t("series.netProfit") },
              { key: "adSpend", label: t("series.adSpend") },
            ]}
            currency={ds.currency}
          />
        </Card>
        <Card title={t("overview.moneyGoes")}>
          <ProfitBreakdown data={summary} currency={ds.currency} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title={t("overview.topFindings")}
          subtitle={t("overview.findingsCount", { count: insights.length })}
          action={
            <Link href={`${localeHref(ctx.locale, "/insights")}?range=${ctx.preset}`} className="text-xs font-medium text-accent hover:underline">
              {t("overview.allInsights")}
            </Link>
          }
        >
          <div className="space-y-3">
            {insights.slice(0, 3).map((i) => (
              <InsightCard key={i.id} insight={i} currency={ds.currency} compact />
            ))}
          </div>
        </Card>
        <Card title={t("overview.channels")} subtitle={t("overview.channelsHint")}>
          <DataTable rows={channels} columns={channelColumns(t)} rowKey="channel" defaultSort={{ key: "spend", dir: "desc" }} currency={ds.currency} />
        </Card>
      </div>
    </div>
  );
}
