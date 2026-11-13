/**
 * Proactive insight rules: pure detectors over the profit engine output.
 * Each rule returns Insights with evidence, a concrete recommendation and an estimated monthly impact (dataset currency).
 * The AI briefing (lib/ai/briefing.ts) prioritises and explains these – it never invents them.
 */
import type { Dataset, Insight, Severity } from "@/lib/domain/types";
import { addDays, daysBetween } from "@/lib/date-range";
import { formatMoney, formatPercent, formatRatio, round2 } from "@/lib/format";
import { campaignPerformance, categoryProfits, lossMakingOrders, productProfits } from "@/lib/profit/engine";
import { english } from "@/lib/i18n/english";
import type { Translator } from "@/lib/i18n/translate";

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

/** Texts come from the i18n dictionary; names and numbers are passed as parameters, never translated. */
export function detectInsights(ds: Dataset, { t }: Pick<Translator, "t"> = english): Insight[] {
  const days = daysBetween(ds.range);
  const monthly = (v: number) => round2((v * 30) / days);
  const money = (v: number) => formatMoney(v, ds.currency);
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
      title: t("rule.campaignLoss.title", { name: c.name }),
      evidence: t("rule.campaignLoss.evidence", {
        poas: formatRatio(c.poas),
        roas: formatRatio(c.roas),
        health: t(c.roas >= 3 ? "rule.health.healthy" : "rule.health.weak"),
        spend: money(c.spend),
        profit: money(c.attributedProfit),
        net: money(c.netProfit),
      }),
      recommendation:
        product && product.grossProfit < 0
          ? t("rule.campaignLoss.fixProduct", { product: product.title })
          : c.poas < 0.5
            ? t("rule.campaignLoss.rebuild", { target: THRESHOLDS.scalePoas })
            : t("rule.campaignLoss.cut"),
      impact: impact,
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
      title: t("rule.scale.title", { name: c.name }),
      evidence: t("rule.scale.evidence", { poas: formatRatio(c.poas), currency: ds.currency, ratio: c.poas.toFixed(2), net: money(c.netProfit) }),
      recommendation: t("rule.scale.recommendation", { target: formatRatio(THRESHOLDS.scalePoas) }),
      impact: Math.max(impact, 0),
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
      title: t("rule.shift.title", { amount: money(monthly(wasted)) }),
      evidence: t("rule.shift.evidence", { count: losers.length, spend: money(wasted), best: best.name, poas: formatRatio(best.poas) }),
      recommendation: t("rule.shift.recommendation", { from: losers.map((c) => c.name).join(", "), to: winners.map((c) => c.name).join(", ") }),
      // Losses avoided + half the freed budget redeployed at ~50% of the median winner's efficiency.
      impact: monthly(
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
      title: t("rule.product.title", { product: p.title, sku: p.sku }),
      evidence: t("rule.product.evidence", {
        revenue: money(p.revenue),
        net: money(p.netProfit),
        margin: formatPercent(p.margin),
        returns: formatPercent(p.returnRate),
        cogs: money(p.cogs),
        adSpend: money(p.adSpend),
      }),
      recommendation: highReturns
        ? t("rule.product.returns", { returns: formatPercent(p.returnRate) })
        : t("rule.product.price", { uplift: formatPercent(priceUplift) }),
      impact: monthly(-p.netProfit),
    });
  }

  // 5. Small-ticket orders eaten by shipping & fees
  const small = lossMakingOrders(ds);
  if (small.share >= THRESHOLDS.smallOrderShare) {
    out.push({
      id: "small-orders",
      kind: "loss",
      severity: "warning",
      title: t("rule.small.title", { share: formatPercent(small.share) }),
      evidence: t("rule.small.evidence", { count: small.count, aov: money(small.avgOrderValue), loss: money(small.loss) }),
      recommendation: t("rule.small.recommendation"),
      impact: monthly(-small.loss * 0.6),
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
        title: t("rule.erosion.title", { category: now.category }),
        evidence: t("rule.erosion.evidence", {
          before: formatPercent(prev.margin),
          after: formatPercent(now.margin),
          revenueBefore: money(prev.revenue),
          revenueAfter: money(now.revenue),
        }),
        recommendation: t("rule.erosion.recommendation", { category: now.category }),
        impact: monthly((prev.margin - now.margin) * now.revenue * 2),
      });
    }
  }

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.impact - a.impact);
}
