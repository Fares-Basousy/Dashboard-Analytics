/** KPI definitions shared by pages (data only – rendered by <KpiGrid>). */
import type { Kpi } from "@/components/ui/KpiGrid";
import type { CampaignPerformance } from "@/lib/domain/types";
import type { Summary } from "@/lib/profit/engine";
import { safeDiv } from "@/lib/format";
import type { Translator } from "@/lib/i18n/translate";

type T = Translator["t"];

export function profitKpis(now: Summary, prev: Summary, t: T): Kpi[] {
  return [
    { label: t("kpi.revenue"), value: now.revenue, previous: prev.revenue, format: "money" },
    { label: t("kpi.netProfit"), value: now.netProfit, previous: prev.netProfit, format: "money", hint: t("kpi.netProfitHint") },
    { label: t("kpi.netMargin"), value: now.margin, previous: prev.margin, format: "percent" },
    { label: t("kpi.adSpend"), value: now.adSpend, previous: prev.adSpend, format: "money", lowerIsBetter: true },
    { label: t("kpi.poas"), value: now.poas, previous: prev.poas, format: "ratio", hint: t("kpi.poasHint") },
    { label: t("kpi.returnRate"), value: now.returnRate, previous: prev.returnRate, format: "percent", lowerIsBetter: true },
  ];
}

export function marketingKpis(now: CampaignPerformance[], prev: CampaignPerformance[], t: T): Kpi[] {
  const agg = (rows: CampaignPerformance[]) => {
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const profit = rows.reduce((s, r) => s + r.attributedProfit, 0);
    const wasted = rows.filter((r) => r.spend > 0 && r.poas < 1).reduce((s, r) => s + r.spend, 0);
    return { spend, revenue, roas: safeDiv(revenue, spend), poas: safeDiv(profit, spend), net: profit - spend, wasted };
  };
  const a = agg(now);
  const b = agg(prev);
  return [
    { label: t("kpi.adSpend"), value: a.spend, previous: b.spend, format: "money", lowerIsBetter: true },
    { label: t("kpi.adRevenue"), value: a.revenue, previous: b.revenue, format: "money" },
    { label: t("kpi.roas"), value: a.roas, previous: b.roas, format: "ratio" },
    { label: t("kpi.poas"), value: a.poas, previous: b.poas, format: "ratio", hint: t("kpi.poasRealHint") },
    { label: t("kpi.adNetProfit"), value: a.net, previous: b.net, format: "money" },
    { label: t("kpi.wastedSpend"), value: a.wasted, previous: b.wasted, format: "money", lowerIsBetter: true },
  ];
}
