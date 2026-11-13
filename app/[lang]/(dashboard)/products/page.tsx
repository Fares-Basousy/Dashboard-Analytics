import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { KpiGrid, type Kpi } from "@/components/ui/KpiGrid";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { PageData } from "@/components/PageData";
import { DataSourceNotice } from "@/components/DataSourceNotice";
import { getDataset } from "@/lib/data/dataset";
import { categoryProfits, productProfits, summarize } from "@/lib/profit/engine";
import type { ProductProfit } from "@/lib/domain/types";
import { getI18n } from "@/lib/i18n/page";
import type { Translator } from "@/lib/i18n/translate";
import type { PageContext } from "@/lib/page-context";

const CHART_ITEMS_EACH_SIDE = 7;
type T = Translator["t"];

const productColumns = (t: T): Column<ProductProfit>[] => [
  { key: "title", label: t("col.product"), subKey: "sku" },
  { key: "category", label: t("col.category") },
  { key: "unitsSold", label: t("col.units"), format: "number" },
  { key: "revenue", label: t("col.revenue"), format: "money" },
  { key: "cogs", label: t("col.cogs"), format: "money" },
  { key: "refunds", label: t("col.refunds"), format: "money" },
  { key: "adSpend", label: t("col.adSpend"), format: "money" },
  { key: "netProfit", label: t("col.netProfit"), format: "money", tone: "signed" },
  { key: "margin", label: t("col.margin"), format: "percent", tone: "signed" },
  { key: "returnRate", label: t("col.returns"), format: "percent", tone: "returnRate" },
];

type CategoryRow = ReturnType<typeof categoryProfits>[number];

const categoryColumns = (t: T): Column<CategoryRow>[] => [
  { key: "category", label: t("col.category") },
  { key: "revenue", label: t("col.revenue"), format: "money" },
  { key: "netProfit", label: t("col.netProfit"), format: "money", tone: "signed" },
  { key: "margin", label: t("col.margin"), format: "percent", tone: "signed" },
];

export default async function ProductsPage({ searchParams }: PageProps<"/[lang]/products">) {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t("products.title")} description={t("products.description")} />
      <PageData searchParams={searchParams}>{(ctx) => <Products ctx={ctx} />}</PageData>
    </>
  );
}

function productKpis(products: ProductProfit[], margin: number, t: T): Kpi[] {
  const losers = products.filter((p) => p.netProfit < 0);
  return [
    { label: t("kpi.productsSold"), value: products.length, format: "number" },
    { label: t("kpi.profitable"), value: products.length - losers.length, format: "number" },
    { label: t("kpi.lossMaking"), value: losers.length, format: "number" },
    { label: t("kpi.lostOnLossMakers"), value: losers.reduce((s, p) => s + p.netProfit, 0), format: "money" },
    { label: t("kpi.unitsSold"), value: products.reduce((s, p) => s + p.unitsSold, 0), format: "number" },
    { label: t("kpi.netMargin"), value: margin, format: "percent" },
  ];
}

async function Products({ ctx }: { ctx: PageContext }) {
  const { t } = ctx.i18n;
  const ds = await getDataset(ctx.range, ctx.creds);
  const products = productProfits(ds);
  const ranked = [...products].sort((a, b) => b.netProfit - a.netProfit);
  const chart = [...ranked.slice(0, CHART_ITEMS_EACH_SIDE), ...ranked.slice(-CHART_ITEMS_EACH_SIDE)].map((p) => ({ label: p.title, value: p.netProfit }));

  return (
    <div className="space-y-6">
      <DataSourceNotice sources={ds.sources} />
      <KpiGrid items={productKpis(products, summarize(ds, products).margin, t)} currency={ds.currency} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title={t("products.chart")} subtitle={t("products.chartHint")} className="lg:col-span-3">
          <RankedBarChart data={chart} currency={ds.currency} />
        </Card>
        <Card title={t("products.byCategory")} className="lg:col-span-2">
          <DataTable rows={categoryProfits(products)} columns={categoryColumns(t)} rowKey="category" defaultSort={{ key: "netProfit", dir: "desc" }} currency={ds.currency} />
        </Card>
      </div>
      <Card title={t("products.all")} subtitle={t("products.sortHint")}>
        <DataTable rows={products} columns={productColumns(t)} rowKey="sku" defaultSort={{ key: "netProfit", dir: "asc" }} testId="products-table" currency={ds.currency} />
      </Card>
    </div>
  );
}
