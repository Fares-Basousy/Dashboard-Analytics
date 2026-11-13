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
import { CHANNEL_LABEL } from "@/lib/labels";
import type { CampaignPerformance } from "@/lib/domain/types";
import type { PageContext } from "@/lib/page-context";

type CampaignRow = CampaignPerformance & { channelLabel: string };
type ChannelRow = ReturnType<typeof channelPerformance>[number] & { channelLabel: string };

const CAMPAIGN_COLUMNS: Column<CampaignRow>[] = [
  { key: "name", label: "Campaign", subKey: "channelLabel" },
  { key: "type", label: "Type" },
  { key: "spend", label: "Spend", format: "chf" },
  { key: "revenue", label: "Conv. value", format: "chf" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "attributedProfit", label: "Gross profit", format: "chf" },
  { key: "poas", label: "POAS", format: "ratio", tone: "poas" },
  { key: "netProfit", label: "Net profit", format: "chf", tone: "signed" },
];

const CHANNEL_COLUMNS: Column<ChannelRow>[] = [
  { key: "channelLabel", label: "Channel" },
  { key: "campaigns", label: "Campaigns", format: "number" },
  { key: "spend", label: "Spend", format: "chf" },
  { key: "revenue", label: "Conv. value", format: "chf" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "poas", label: "POAS", format: "ratio", tone: "poas" },
  { key: "netProfit", label: "Net profit", format: "chf", tone: "signed" },
];

export default function MarketingPage({ searchParams }: PageProps<"/marketing">) {
  return (
    <>
      <PageHeader
        title="Marketing performance"
        description="ROAS shows revenue per CHF spent; POAS shows profit per CHF spent after product cost, refunds, shipping and fees. POAS < 1 means the campaign loses money."
      />
      <PageData searchParams={searchParams}>{(ctx) => <Marketing ctx={ctx} />}</PageData>
    </>
  );
}

const withChannelLabel = <T extends { channel: CampaignPerformance["channel"] }>(r: T) => ({ ...r, channelLabel: CHANNEL_LABEL[r.channel] });

async function Marketing({ ctx }: { ctx: PageContext }) {
  const [ds, prev] = await Promise.all([getDataset(ctx.range, ctx.creds), getDataset(ctx.previous, ctx.creds)]);
  const campaigns = campaignPerformance(ds);
  const active = campaigns.filter((c) => c.spend > 0);
  const chart = [...active].sort((a, b) => b.netProfit - a.netProfit).map((c) => ({ label: c.name, value: c.netProfit }));

  return (
    <div className="space-y-6">
      <DataSourceNotice sources={ds.sources} />
      <KpiGrid items={marketingKpis(campaigns, campaignPerformance(prev))} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Net profit per campaign" subtitle="Gross profit from conversions minus spend" className="lg:col-span-3">
          <RankedBarChart data={chart} />
        </Card>
        <Card title="Channels" className="lg:col-span-2">
          <DataTable rows={channelPerformance(campaigns).map(withChannelLabel)} columns={CHANNEL_COLUMNS} rowKey="channel" defaultSort={{ key: "spend", dir: "desc" }} />
        </Card>
      </div>
      <Card title="Campaigns" subtitle="Sorted by POAS – worst first">
        <DataTable rows={campaigns.map(withChannelLabel)} columns={CAMPAIGN_COLUMNS} rowKey="id" defaultSort={{ key: "poas", dir: "asc" }} testId="campaigns-table" />
      </Card>
    </div>
  );
}
