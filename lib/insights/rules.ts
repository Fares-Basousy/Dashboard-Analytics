/**
 * Proactive insight rules: pure detectors over the profit engine output.
 * Each rule returns Insights with evidence, a concrete recommendation and an estimated monthly CHF impact.
 * The AI briefing (lib/ai/briefing.ts) prioritises and explains these – it never invents them.
 */
import type { Dataset, Insight, Severity } from "@/lib/domain/types";
import { addDays, daysBetween } from "@/lib/date-range";
import { formatChf, formatPercent, formatRatio, round2 } from "@/lib/format";
import { campaignPerformance, categoryProfits, lossMakingOrders, productProfits } from "@/lib/profit/engine";

export const THRESHOLDS = {
  scalePoas: 2,
  highReturnRate: 0.15,
  smallOrderShare: 0.08,
  marginDropPts: 0.05,
  minRevenueForProductRule: 300,
  maxPerRule: 5,
};

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Restrict a dataset to a sub-range (used for trend comparisons). */
export function sliceDataset(ds: Dataset, from: string, to: string): Dataset {
  const r = { from, to };
  const inR = (d: string) => d >= from && d <= to;
  return { ...ds, range: r, orders: ds.orders.filter((o) => inR(o.date)), refunds: ds.refunds.filter((f) => inR(f.date)), adSpend: ds.adSpend.filter((s) => inR(s.date)) };
}

export function detectInsights(ds: Dataset): Insight[] {
  const days = daysBetween(ds.range);
  const monthly = (v: number) => round2((v * 30) / days);
  const products = productProfits(ds);
  const campaigns = campaignPerformance(ds, products).filter((c) => c.spend > 0);
  const productBySku = new Map(products.map((p) => [p.sku, p]));
  const sku = new Map(ds.campaigns.map((c) => [c.id, c.sku]));
  const out: Insight[] = [];

  // 1. Campaigns that lose money (POAS < 1)
  const losers = campaigns.filter((c) => c.poas < 1).sort((a, b) => a.netProfit - b.netProfit);
  for (const c of losers.slice(0, THRESHOLDS.maxPerRule)) {
    const product = sku.get(c.id) ? productBySku.get(sku.get(c.id)!) : undefined;
    const impact = monthly(-c.netProfit);
    out.push({
      id: `campaign-loss:${c.id}`,
      kind: "loss",
      severity: impact > 1500 ? "critical" : "warning",
      title: `“${c.name}” loses money`,
      evidence: `POAS ${formatRatio(c.poas)} (ROAS ${formatRatio(c.roas)} looks ${c.roas >= 3 ? "healthy" : "weak"}): ${formatChf(c.spend)} spend generated only ${formatChf(c.attributedProfit)} gross profit → ${formatChf(c.netProfit)}.`,
      recommendation:
        product && product.grossProfit < 0
          ? `Pause immediately – the advertised product (${product.title}) is unprofitable even before ads. Fix price/cost first.`
          : c.poas < 0.5
            ? `Pause or rebuild the campaign; reallocate the budget to campaigns with POAS > ${THRESHOLDS.scalePoas}.`
            : `Cut the budget by ~50% and switch bidding to target POAS/margin (feed profit as conversion value).`,
      impactChf: impact,
    });
  }

  // 2. Scale candidates (POAS ≥ 2)
  const winners = campaigns.filter((c) => c.poas >= THRESHOLDS.scalePoas && c.status === "active").sort((a, b) => b.poas - a.poas);
  for (const c of winners.slice(0, THRESHOLDS.maxPerRule)) {
    // +25% budget at ~70% marginal efficiency
    const impact = monthly(c.spend * 0.25 * (c.poas * 0.7 - 1));
    out.push({
      id: `campaign-scale:${c.id}`,
      kind: "opportunity",
      severity: "info",
      title: `Scale “${c.name}”`,
      evidence: `POAS ${formatRatio(c.poas)}: every CHF 1 spent returns ${formatChf(c.poas)} gross profit (${formatChf(c.netProfit)} net in period).`,
      recommendation: `Increase the daily budget by 20–30% and monitor POAS weekly; stop increasing once POAS falls below ${formatRatio(THRESHOLDS.scalePoas)}.`,
      impactChf: Math.max(impact, 0),
    });
  }

  // 3. Budget shift from losers to winners
  if (losers.length && winners.length) {
    const wasted = losers.reduce((s, c) => s + c.spend, 0);
    const best = winners[0];
    out.push({
      id: "budget-shift",
      kind: "budget",
      severity: "warning",
      title: `Shift ${formatChf(monthly(wasted))}/month from loss-making to profitable campaigns`,
      evidence: `${losers.length} campaign(s) with POAS < 1 spent ${formatChf(wasted)}; best campaign “${best.name}” runs at POAS ${formatRatio(best.poas)}.`,
      recommendation: `Move budget stepwise (25% per week) from: ${losers.map((c) => c.name).join(", ")} → to: ${winners.map((c) => c.name).join(", ")}.`,
      // Losses avoided + half the freed budget redeployed at ~50% of the median winner's efficiency.
      impactChf: monthly(
        losers.reduce((s, c) => s - c.netProfit, 0) + Math.max(0, wasted * 0.5 * (winners[Math.floor(winners.length / 2)].poas * 0.5 - 1)),
      ),
    });
  }

  // 4. Unprofitable products (after all costs)
  const lossProducts = products
    .filter((p) => p.netProfit < 0 && p.revenue >= THRESHOLDS.minRevenueForProductRule)
    .sort((a, b) => a.netProfit - b.netProfit);
  for (const p of lossProducts.slice(0, THRESHOLDS.maxPerRule)) {
    const highReturns = p.returnRate >= THRESHOLDS.highReturnRate;
    const priceUplift = (-p.netProfit + 0.1 * p.revenue) / p.revenue;
    out.push({
      id: `product-loss:${p.sku}`,
      kind: "loss",
      severity: p.netProfit < -1000 ? "critical" : "warning",
      title: `${p.title} (${p.sku}) loses money after all costs`,
      evidence: `Revenue ${formatChf(p.revenue)}, net ${formatChf(p.netProfit)} (margin ${formatPercent(p.margin)}). Returns ${formatPercent(p.returnRate)}, COGS ${formatChf(p.cogs)}, ad spend ${formatChf(p.adSpend)}.`,
      recommendation: highReturns
        ? `Return rate of ${formatPercent(p.returnRate)} is the driver: check supplier quality and compatibility info on the product page; stop advertising until fixed.`
        : `Raise the price by ~${formatPercent(priceUplift)} or renegotiate purchase cost; exclude it from broad ad campaigns.`,
      impactChf: monthly(-p.netProfit),
    });
  }

  // 5. Small-ticket orders eaten by shipping & fees
  const small = lossMakingOrders(ds);
  if (small.share >= THRESHOLDS.smallOrderShare) {
    out.push({
      id: "small-orders",
      kind: "loss",
      severity: "warning",
      title: `${formatPercent(small.share)} of orders lose money before ads`,
      evidence: `${small.count} orders (avg. ${formatChf(small.avgOrderValue)}) don't cover product cost + shipping + payment fees: ${formatChf(small.loss)} in the period.`,
      recommendation: `Introduce a small-order surcharge (e.g. CHF 4.90 below CHF 30) or a minimum order value, and show “add a CHF 10 item for free shipping” bundles in the cart.`,
      impactChf: monthly(-small.loss * 0.6),
    });
  }

  // 6. Category margin erosion (second half vs first half of the period)
  if (days >= 14) {
    const mid = addDays(ds.range.from, Math.floor(days / 2) - 1);
    const before = new Map(categoryProfits(productProfits(sliceDataset(ds, ds.range.from, mid))).map((c) => [c.category, c]));
    for (const now of categoryProfits(productProfits(sliceDataset(ds, addDays(mid, 1), ds.range.to)))) {
      const prev = before.get(now.category);
      if (!prev || prev.margin - now.margin < THRESHOLDS.marginDropPts) continue;
      out.push({
        id: `margin-erosion:${now.category}`,
        kind: "trend",
        severity: "warning",
        title: `Margin erosion in ${now.category}`,
        evidence: `Net margin fell from ${formatPercent(prev.margin)} to ${formatPercent(now.margin)} (revenue ${formatChf(prev.revenue)} → ${formatChf(now.revenue)}).`,
        recommendation: `Check recent discounts/promotions and purchase prices in ${now.category}; end promotions that don't lift volume enough to compensate.`,
        impactChf: monthly((prev.margin - now.margin) * now.revenue * 2),
      });
    }
  }

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.impactChf - a.impactChf);
}
