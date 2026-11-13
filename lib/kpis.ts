/** KPI definitions shared by pages (data only – rendered by <KpiGrid>). */
import type { Kpi } from "@/components/ui/KpiGrid";
import type { CampaignPerformance } from "@/lib/domain/types";
import type { Summary } from "@/lib/profit/engine";
import { safeDiv } from "@/lib/format";

export function profitKpis(now: Summary, prev: Summary): Kpi[] {
  return [
    { label: "Revenue", value: now.revenue, previous: prev.revenue, format: "chf" },
    { label: "Net profit", value: now.netProfit, previous: prev.netProfit, format: "chf", hint: "after all costs" },
    { label: "Net margin", value: now.margin, previous: prev.margin, format: "percent" },
    { label: "Ad spend", value: now.adSpend, previous: prev.adSpend, format: "chf", lowerIsBetter: true },
    { label: "POAS", value: now.poas, previous: prev.poas, format: "ratio", hint: "profit / ad spend" },
    { label: "Return rate", value: now.returnRate, previous: prev.returnRate, format: "percent", lowerIsBetter: true },
  ];
}

export function marketingKpis(now: CampaignPerformance[], prev: CampaignPerformance[]): Kpi[] {
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
    { label: "Ad spend", value: a.spend, previous: b.spend, format: "chf", lowerIsBetter: true },
    { label: "Ad revenue (platform)", value: a.revenue, previous: b.revenue, format: "chf" },
    { label: "ROAS", value: a.roas, previous: b.roas, format: "ratio" },
    { label: "POAS", value: a.poas, previous: b.poas, format: "ratio", hint: "the real one" },
    { label: "Net profit from ads", value: a.net, previous: b.net, format: "chf" },
    { label: "Spend with POAS < 1", value: a.wasted, previous: b.wasted, format: "chf", lowerIsBetter: true },
  ];
}
