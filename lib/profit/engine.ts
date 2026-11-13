/**
 * Profit engine: pure functions over a Dataset. The UI and the AI tools both call these,
 * so every number the assistant quotes is the number on screen.
 *
 * net profit = revenue − COGS − refunds − shipping cost − payment fees − ad spend
 * - Order-level costs (shipping, payment fee) are allocated to lines by revenue share.
 * - Ad spend of single-product campaigns goes to that SKU; the rest is spread by revenue share.
 * - Refunded items are assumed not resellable (COGS is kept) – conservative for spare parts.
 */
import type {
  AdChannel,
  CampaignPerformance,
  ChannelPerformance,
  DailyPoint,
  Dataset,
  ProductProfit,
  ProfitBreakdown,
} from "@/lib/domain/types";
import { eachDay } from "@/lib/date-range";
import { round2, safeDiv } from "@/lib/format";

type Totals = Omit<ProfitBreakdown, "grossProfit" | "netProfit" | "margin">;
const ZERO: Totals = { revenue: 0, cogs: 0, refunds: 0, shippingCost: 0, paymentFees: 0, adSpend: 0 };

function finish<T extends Totals>(t: T): T & ProfitBreakdown {
  const grossProfit = t.revenue - t.cogs - t.refunds - t.shippingCost - t.paymentFees;
  const netProfit = grossProfit - t.adSpend;
  return {
    ...t,
    ...Object.fromEntries(Object.entries(ZERO).map(([k]) => [k, round2(t[k as keyof Totals])])),
    grossProfit: round2(grossProfit),
    netProfit: round2(netProfit),
    margin: safeDiv(netProfit, t.revenue),
  } as T & ProfitBreakdown;
}

const lineRevenue = (l: { unitPrice: number; qty: number; discount: number }) => l.unitPrice * l.qty - l.discount;

export function productProfits(ds: Dataset): ProductProfit[] {
  const catalog = new Map(ds.products.map((p) => [p.sku, p]));
  const rows = new Map<string, Totals & { unitsSold: number; unitsReturned: number }>();
  const row = (sku: string) => {
    let r = rows.get(sku);
    if (!r) rows.set(sku, (r = { ...ZERO, unitsSold: 0, unitsReturned: 0 }));
    return r;
  };

  for (const o of ds.orders) {
    const orderRevenue = o.lines.reduce((s, l) => s + lineRevenue(l), 0);
    for (const l of o.lines) {
      const r = row(l.sku);
      const rev = lineRevenue(l);
      // Order-level costs follow revenue share; free orders split them evenly.
      const share = orderRevenue === 0 ? 1 / o.lines.length : rev / orderRevenue;
      r.revenue += rev;
      r.unitsSold += l.qty;
      r.cogs += (catalog.get(l.sku)?.unitCost ?? 0) * l.qty;
      r.shippingCost += o.shippingCost * share;
      r.paymentFees += o.paymentFee * share;
    }
  }
  for (const f of ds.refunds) {
    const r = row(f.sku);
    r.refunds += f.amount;
    r.unitsReturned += f.qty;
  }

  // Ad spend: direct for single-SKU campaigns, revenue-share for everything else.
  // A campaign tagged with a SKU the catalog doesn't know (typo, deleted product, or demo ads next to
  // a live shop) is treated as a generic campaign instead of creating a phantom product.
  const skuOf = new Map(ds.campaigns.map((c) => [c.id, c.sku && catalog.has(c.sku) ? c.sku : undefined]));
  let shared = 0;
  for (const s of ds.adSpend) {
    const sku = skuOf.get(s.campaignId);
    if (sku) row(sku).adSpend += s.spend;
    else shared += s.spend;
  }
  const totalRevenue = [...rows.values()].reduce((s, r) => s + r.revenue, 0);
  for (const r of rows.values()) r.adSpend += shared * safeDiv(r.revenue, totalRevenue);

  return [...rows.entries()].map(([sku, r]) => {
    const p = catalog.get(sku);
    return {
      sku,
      title: p?.title ?? sku,
      category: p?.category ?? "Unknown",
      ...finish(r),
      returnRate: safeDiv(r.unitsReturned, r.unitsSold),
    };
  });
}

/** Sum any profit rows into one breakdown (store total, a category, …). */
export function sumProfit(rows: ProfitBreakdown[]): ProfitBreakdown {
  const t = { ...ZERO };
  for (const r of rows) for (const k of Object.keys(ZERO) as (keyof Totals)[]) t[k] += r[k];
  return finish(t);
}

export interface Summary extends ProfitBreakdown {
  orders: number;
  aov: number;
  returnRate: number;
  roas: number;
  poas: number;
}

export function summarize(ds: Dataset, products = productProfits(ds)): Summary {
  const total = sumProfit(products);
  const sold = products.reduce((s, p) => s + p.unitsSold, 0);
  const returned = products.reduce((s, p) => s + p.unitsReturned, 0);
  return {
    ...total,
    orders: ds.orders.length,
    aov: safeDiv(total.revenue, ds.orders.length),
    returnRate: safeDiv(returned, sold),
    roas: safeDiv(total.revenue, total.adSpend),
    poas: safeDiv(total.grossProfit, total.adSpend),
  };
}

export function categoryProfits(products: ProductProfit[]): (ProfitBreakdown & { category: string })[] {
  const groups = Map.groupBy(products, (p) => p.category);
  return [...groups].map(([category, rows]) => ({ category, ...sumProfit(rows) }));
}

export function campaignPerformance(ds: Dataset, products = productProfits(ds)): CampaignPerformance[] {
  const store = sumProfit(products);
  const storeGrossRatio = safeDiv(store.grossProfit, store.revenue);
  const skuGrossRatio = new Map(products.map((p) => [p.sku, safeDiv(p.grossProfit, p.revenue)]));
  const bySpend = Map.groupBy(ds.adSpend, (s) => s.campaignId);

  return ds.campaigns.map((c) => {
    const days = bySpend.get(c.id) ?? [];
    const spend = days.reduce((s, d) => s + d.spend, 0);
    const revenue = days.reduce((s, d) => s + d.conversionValue, 0);
    const ratio = c.sku ? (skuGrossRatio.get(c.sku) ?? storeGrossRatio) : storeGrossRatio;
    const attributedProfit = revenue * ratio;
    return {
      id: c.id,
      name: c.name,
      channel: c.channel,
      type: c.type,
      status: c.status,
      spend: round2(spend),
      clicks: days.reduce((s, d) => s + d.clicks, 0),
      conversions: round2(days.reduce((s, d) => s + d.conversions, 0)),
      revenue: round2(revenue),
      attributedProfit: round2(attributedProfit),
      roas: safeDiv(revenue, spend),
      poas: safeDiv(attributedProfit, spend),
      netProfit: round2(attributedProfit - spend),
    };
  });
}

export function channelPerformance(campaigns: CampaignPerformance[]): ChannelPerformance[] {
  return [...Map.groupBy(campaigns, (c) => c.channel)].map(([channel, rows]: [AdChannel, CampaignPerformance[]]) => {
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const attributedProfit = rows.reduce((s, r) => s + r.attributedProfit, 0);
    return {
      channel,
      spend: round2(spend),
      revenue: round2(revenue),
      attributedProfit: round2(attributedProfit),
      roas: safeDiv(revenue, spend),
      poas: safeDiv(attributedProfit, spend),
      netProfit: round2(attributedProfit - spend),
      campaigns: rows.length,
    };
  });
}

export function dailySeries(ds: Dataset): DailyPoint[] {
  const cost = new Map(ds.products.map((p) => [p.sku, p.unitCost]));
  const days = new Map(eachDay(ds.range).map((d) => [d, { date: d, revenue: 0, netProfit: 0, adSpend: 0 }]));
  for (const o of ds.orders) {
    const d = days.get(o.date);
    if (!d) continue;
    for (const l of o.lines) {
      d.revenue += lineRevenue(l);
      d.netProfit += lineRevenue(l) - (cost.get(l.sku) ?? 0) * l.qty;
    }
    d.netProfit -= o.shippingCost + o.paymentFee;
  }
  for (const f of ds.refunds) {
    const d = days.get(f.date);
    if (d) d.netProfit -= f.amount;
  }
  for (const s of ds.adSpend) {
    const d = days.get(s.date);
    if (!d) continue;
    d.adSpend += s.spend;
    d.netProfit -= s.spend;
  }
  return [...days.values()].map((d) => ({ date: d.date, revenue: round2(d.revenue), netProfit: round2(d.netProfit), adSpend: round2(d.adSpend) }));
}

/** Small-ticket orders: count and total profit of orders whose contribution after shipping & fees is negative. */
export function lossMakingOrders(ds: Dataset) {
  const cost = new Map(ds.products.map((p) => [p.sku, p.unitCost]));
  let count = 0;
  let loss = 0;
  let revenue = 0;
  for (const o of ds.orders) {
    const rev = o.lines.reduce((s, l) => s + lineRevenue(l), 0);
    const contribution = rev - o.lines.reduce((s, l) => s + (cost.get(l.sku) ?? 0) * l.qty, 0) - o.shippingCost - o.paymentFee;
    if (contribution >= 0) continue;
    count += 1;
    loss += contribution;
    revenue += rev;
  }
  return { count, share: safeDiv(count, ds.orders.length), loss: round2(loss), avgOrderValue: safeDiv(revenue, count) };
}
