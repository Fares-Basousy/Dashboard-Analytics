import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { KpiGrid } from "@/components/ui/KpiGrid";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { PageData } from "@/components/PageData";
import { DataSourceNotice } from "@/components/DataSourceNotice";
import { getDataset } from "@/lib/data/dataset";
import { campaignPerformance, channelPerformance } from "@/lib/profit/engine";
import { marketingKpis } from "@/lib/kpis";
import { withChannelLabel } from "@/lib/labels";
import type { CampaignPerformance, ChannelPerformance } from "@/lib/domain/types";
import { getI18n } from "@/lib/i18n/page";
import type { Translator } from "@/lib/i18n/translate";
import type { PageContext } from "@/lib/page-context";

type T = Translator["t"];
type CampaignRow = CampaignPerformance & { channelLabel: string };
type ChannelRow = ChannelPerformance & { channelLabel: string };

const campaignColumns = (t: T): Column<CampaignRow>[] => [
  { key: "name", label: t("col.campaign"), subKey: "channelLabel" },
  { key: "type", label: t("col.type") },
  { key: "spend", label: t("col.spend"), format: "money" },
  { key: "revenue", label: t("col.convValue"), format: "money" },
  { key: "roas", label: t("col.roas"), format: "ratio" },
  { key: "attributedProfit", label: t("col.grossProfit"), format: "money" },
  { key: "poas", label: t("col.poas"), format: "ratio", tone: "poas" },
  { key: "netProfit", label: t("col.netProfit"), format: "money", tone: "signed" },
];

const channelColumns = (t: T): Column<ChannelRow>[] => [
  { key: "channelLabel", label: t("col.channel") },
  { key: "campaigns", label: t("col.campaigns"), format: "number" },
  { key: "spend", label: t("col.spend"), format: "money" },
  { key: "revenue", label: t("col.convValue"), format: "money" },
  { key: "roas", label: t("col.roas"), format: "ratio" },
  { key: "poas", label: t("col.poas"), format: "ratio", tone: "poas" },
  { key: "netProfit", label: t("col.netProfit"), format: "money", tone: "signed" },
];

export default async function MarketingPage({ searchParams }: PageProps<"/[lang]/marketing">) {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t("marketing.title")} description={t("marketing.description")} />
      <PageData searchParams={searchParams}>{(ctx) => <Marketing ctx={ctx} />}</PageData>
    </>
  );
}

async function Marketing({ ctx }: { ctx: PageContext }) {
  const { t } = ctx.i18n;
  const [ds, prev] = await Promise.all([getDataset(ctx.range, ctx.creds), getDataset(ctx.previous, ctx.creds)]);
  const campaigns = campaignPerformance(ds);
  const active = campaigns.filter((c) => c.spend > 0);
  const chart = [...active].sort((a, b) => b.netProfit - a.netProfit).map((c) => ({ label: c.name, value: c.netProfit }));

  return (
    <div className="space-y-6">
      <DataSourceNotice sources={ds.sources} />
      <KpiGrid items={marketingKpis(campaigns, campaignPerformance(prev), t)} currency={ds.currency} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title={t("marketing.chart")} subtitle={t("marketing.chartHint")} className="lg:col-span-3">
          <RankedBarChart data={chart} currency={ds.currency} />
        </Card>
        <Card title={t("marketing.channels")} className="lg:col-span-2">
          <DataTable rows={channelPerformance(campaigns).map(withChannelLabel)} columns={channelColumns(t)} rowKey="channel" defaultSort={{ key: "spend", dir: "desc" }} currency={ds.currency} />
        </Card>
      </div>
      <Card title={t("marketing.campaigns")} subtitle={t("marketing.campaignsHint")}>
        <DataTable rows={campaigns.map(withChannelLabel)} columns={campaignColumns(t)} rowKey="id" defaultSort={{ key: "poas", dir: "asc" }} testId="campaigns-table" currency={ds.currency} />
      </Card>
    </div>
  );
}
