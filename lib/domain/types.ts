/** Single shared schema. Every connector maps into these types; every consumer reads them. */

export type ISODate = string; // YYYY-MM-DD

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

export interface Product {
  sku: string;
  title: string;
  category: string;
  price: number;
  unitCost: number;
}

export interface OrderLine {
  sku: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface Order {
  id: string;
  date: ISODate;
  lines: OrderLine[];
  /** Shipping our store pays to the carrier. */
  shippingCost: number;
  paymentFee: number;
}

export interface Refund {
  orderId: string;
  date: ISODate;
  sku: string;
  qty: number;
  amount: number;
}

export type AdChannel = "google_ads" | "meta" | "tiktok";

export interface AdCampaign {
  id: string;
  channel: AdChannel;
  name: string;
  type: string;
  status: "active" | "paused";
  /** Set when the campaign promotes a single product (Shopping / catalog ads). */
  sku?: string;
}

export interface AdSpendDaily {
  campaignId: string;
  date: ISODate;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

export type SourceStatus = "live" | "mock" | "planned" | "error";

export interface SourceInfo {
  id: string;
  name: string;
  provides: string;
  status: SourceStatus;
  message?: string;
}

export interface Dataset {
  range: DateRange;
  products: Product[];
  orders: Order[];
  refunds: Refund[];
  campaigns: AdCampaign[];
  adSpend: AdSpendDaily[];
  sources: SourceInfo[];
}

export interface ProfitBreakdown {
  revenue: number;
  cogs: number;
  refunds: number;
  shippingCost: number;
  paymentFees: number;
  adSpend: number;
  grossProfit: number;
  netProfit: number;
  /** netProfit / revenue */
  margin: number;
}

export interface ProductProfit extends ProfitBreakdown {
  sku: string;
  title: string;
  category: string;
  unitsSold: number;
  unitsReturned: number;
  returnRate: number;
}

export interface CampaignPerformance {
  id: string;
  name: string;
  channel: AdChannel;
  type: string;
  status: AdCampaign["status"];
  spend: number;
  clicks: number;
  conversions: number;
  revenue: number;
  /** Gross profit (after COGS, refunds, fees) attributed to the campaign's conversions. */
  attributedProfit: number;
  roas: number;
  /** Profit on ad spend: attributedProfit / spend. < 1 means the campaign loses money. */
  poas: number;
  netProfit: number;
}

export interface ChannelPerformance {
  channel: AdChannel;
  spend: number;
  revenue: number;
  attributedProfit: number;
  roas: number;
  poas: number;
  netProfit: number;
  campaigns: number;
}

export interface DailyPoint {
  date: ISODate;
  revenue: number;
  netProfit: number;
  adSpend: number;
}

export type InsightKind = "loss" | "opportunity" | "budget" | "trend";
export type Severity = "critical" | "warning" | "info";

export interface Insight {
  id: string;
  kind: InsightKind;
  severity: Severity;
  title: string;
  evidence: string;
  recommendation: string;
  /** Estimated monthly profit impact in CHF if the recommendation is applied. */
  impactChf: number;
}
