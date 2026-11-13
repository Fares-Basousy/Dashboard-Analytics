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
import type { PageContext } from "@/lib/page-context";

const CHART_ITEMS_EACH_SIDE = 7;

const PRODUCT_COLUMNS: Column<ProductProfit>[] = [
  { key: "title", label: "Product", subKey: "sku" },
  { key: "category", label: "Category" },
  { key: "unitsSold", label: "Units", format: "number" },
  { key: "revenue", label: "Revenue", format: "money" },
  { key: "cogs", label: "COGS", format: "money" },
  { key: "refunds", label: "Refunds", format: "money" },
  { key: "adSpend", label: "Ad spend", format: "money" },
  { key: "netProfit", label: "Net profit", format: "money", tone: "signed" },
  { key: "margin", label: "Margin", format: "percent", tone: "signed" },
  { key: "returnRate", label: "Returns", format: "percent", tone: "returnRate" },
];

type CategoryRow = ReturnType<typeof categoryProfits>[number];

const CATEGORY_COLUMNS: Column<CategoryRow>[] = [
  { key: "category", label: "Category" },
  { key: "revenue", label: "Revenue", format: "money" },
  { key: "netProfit", label: "Net profit", format: "money", tone: "signed" },
  { key: "margin", label: "Margin", format: "percent", tone: "signed" },
];

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <>
      <PageHeader title="Product profitability" description="Every product after COGS, refunds, its share of shipping & payment fees, and allocated ad spend." />
      <PageData searchParams={searchParams}>{(ctx) => <Products ctx={ctx} />}</PageData>
    </>
  );
}

function productKpis(products: ProductProfit[], margin: number): Kpi[] {
  const losers = products.filter((p) => p.netProfit < 0);
  return [
    { label: "Products sold", value: products.length, format: "number" },
    { label: "Profitable", value: products.length - losers.length, format: "number" },
    { label: "Loss-making", value: losers.length, format: "number" },
    { label: "Lost on loss-makers", value: losers.reduce((s, p) => s + p.netProfit, 0), format: "money" },
    { label: "Units sold", value: products.reduce((s, p) => s + p.unitsSold, 0), format: "number" },
    { label: "Net margin", value: margin, format: "percent" },
  ];
}

async function Products({ ctx }: { ctx: PageContext }) {
  const ds = await getDataset(ctx.range, ctx.creds);
  const products = productProfits(ds);
  const ranked = [...products].sort((a, b) => b.netProfit - a.netProfit);
  const chart = [...ranked.slice(0, CHART_ITEMS_EACH_SIDE), ...ranked.slice(-CHART_ITEMS_EACH_SIDE)].map((p) => ({ label: p.title, value: p.netProfit }));

  return (
    <div className="space-y-6">
      <DataSourceNotice sources={ds.sources} />
      <KpiGrid items={productKpis(products, summarize(ds, products).margin)} currency={ds.currency} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Most & least profitable" subtitle="Net profit after all costs" className="lg:col-span-3">
          <RankedBarChart data={chart} currency={ds.currency} />
        </Card>
        <Card title="By category" className="lg:col-span-2">
          <DataTable rows={categoryProfits(products)} columns={CATEGORY_COLUMNS} rowKey="category" defaultSort={{ key: "netProfit", dir: "desc" }} currency={ds.currency} />
        </Card>
      </div>
      <Card title="All products" subtitle="Click a column to sort">
        <DataTable rows={products} columns={PRODUCT_COLUMNS} rowKey="sku" defaultSort={{ key: "netProfit", dir: "asc" }} testId="products-table" currency={ds.currency} />
      </Card>
    </div>
  );
}
