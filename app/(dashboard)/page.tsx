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
import { CHANNEL_LABEL } from "@/lib/labels";
import type { PageContext } from "@/lib/page-context";

type ChannelRow = ReturnType<typeof channelPerformance>[number] & { label: string };

const CHANNEL_COLUMNS: Column<ChannelRow>[] = [
  { key: "label", label: "Channel" },
  { key: "spend", label: "Spend", format: "chf" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "poas", label: "POAS", format: "ratio", tone: "poas" },
  { key: "netProfit", label: "Net profit", format: "chf", tone: "signed" },
];

export default function OverviewPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader title="Profit overview" description="Real profit after product cost, refunds, shipping, payment fees and ad spend – across Shopify, Google Ads and Meta." />
      <PageData searchParams={searchParams}>{(ctx) => <Overview ctx={ctx} />}</PageData>
    </>
  );
}

async function Overview({ ctx }: { ctx: PageContext }) {
  const [ds, prev, insights] = await Promise.all([
    getDataset(ctx.range, ctx.creds),
    getDataset(ctx.previous, ctx.creds),
    getInsights(ctx.preset, ctx.today, ctx.creds),
  ]);
  const summary = summarize(ds);
  const channels = channelPerformance(campaignPerformance(ds)).map((c) => ({ ...c, label: CHANNEL_LABEL[c.channel] }));

  return (
    <div className="space-y-6">
      <DataSourceNotice sources={ds.sources} />
      <KpiGrid items={profitKpis(summary, summarize(prev))} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Revenue, net profit & ad spend" subtitle="Daily" className="lg:col-span-2">
          <TrendChart
            data={dailySeries(ds)}
            xKey="date"
            series={[
              { key: "revenue", label: "Revenue" },
              { key: "netProfit", label: "Net profit" },
              { key: "adSpend", label: "Ad spend" },
            ]}
          />
        </Card>
        <Card title="Where the money goes">
          <ProfitBreakdown data={summary} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Top AI findings"
          subtitle={`${insights.length} issues & opportunities detected`}
          action={
            <Link href={`/insights?range=${ctx.preset}`} className="text-xs font-medium text-accent hover:underline">
              All insights →
            </Link>
          }
        >
          <div className="space-y-3">
            {insights.slice(0, 3).map((i) => (
              <InsightCard key={i.id} insight={i} compact />
            ))}
          </div>
        </Card>
        <Card title="Marketing channels" subtitle="POAS < 1 means the channel loses money">
          <DataTable rows={channels} columns={CHANNEL_COLUMNS} rowKey="channel" defaultSort={{ key: "spend", dir: "desc" }} />
        </Card>
      </div>
    </div>
  );
}
