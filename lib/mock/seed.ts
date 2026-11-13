/**
 * Deterministic demo world for a Swiss spare-parts shop. Each day is generated from a seed derived
 * from its date, so any date range always yields the same numbers (stable demos + testable).
 * It deliberately contains problems the AI should find: loss-making SKUs, POAS < 1 campaigns,
 * small-ticket orders eaten by shipping, and a category with eroding margin.
 */
import type { AdCampaign, AdSpendDaily, DateRange, ISODate, Order, Product, Refund } from "@/lib/domain/types";
import { addDays, eachDay, inRange, toISODate } from "@/lib/date-range";
import { DEFAULT_CURRENCY, round2 } from "@/lib/format";
import { costConfig } from "@/lib/config";

const REFUND_DELAY_DAYS = 6;

interface MockProduct extends Product {
  weight: number;
  returnRate: number;
}

// sku | title | category | price | unitCost | demand weight | return rate
const CATALOG = `
ETS-WM-PUMP|Laugenpumpe universal|Waschmaschine|39.9|17.5|9|0.04
ETS-WM-BELT|Antriebsriemen 1270 J5|Waschmaschine|19.9|7.2|8|0.03
ETS-WM-DOOR|Türmanschette Bosch Serie 6|Waschmaschine|59.9|26|5|0.05
ETS-WM-HEAT|Heizelement 2000W|Waschmaschine|49.9|21|4|0.06
ETS-WM-LOCK|Türverriegelung Miele|Waschmaschine|34.9|14|6|0.04
ETS-WM-CARB|Kohlebürsten Set|Waschmaschine|14.9|4.1|7|0.02
ETS-WM-SHOCK|Stossdämpfer 2er Set|Waschmaschine|29.9|12.5|4|0.03
ETS-WM-BOARD|Elektronik Steuerplatine|Waschmaschine|189|154|2|0.22
ETS-GS-PUMP|Umwälzpumpe Geschirrspüler|Geschirrspüler|89.9|41|4|0.05
ETS-GS-BASKET|Besteckkorb universal|Geschirrspüler|24.9|8.4|6|0.03
ETS-GS-SEAL|Türdichtung V-ZUG|Geschirrspüler|6.9|2.1|9|0.02
ETS-GS-ARM|Sprüharm unten|Geschirrspüler|29.9|11|5|0.04
ETS-GS-FILT|Siebkombination|Geschirrspüler|9.9|3.2|8|0.02
ETS-GS-WHEEL|Korbrollen 8 Stück|Geschirrspüler|12.9|3.9|6|0.03
ETS-KS-SEAL|Türdichtung Kühlschrank 57x102|Kühlschrank|49.9|19.5|5|0.07
ETS-KS-THERM|Thermostat Kühlschrank|Kühlschrank|44.9|18|4|0.05
ETS-KS-SHELF|Glasablage 47cm|Kühlschrank|39.9|15|4|0.06
ETS-KS-DRAWER|Gemüseschale Liebherr|Kühlschrank|54.9|22|3|0.04
ETS-KS-FAN|Lüftermotor No-Frost|Kühlschrank|69.9|29|2|0.05
ETS-KM-BREW|Brühgruppe Jura|Kaffeemaschine|129|52|5|0.04
ETS-KM-DESC|Entkalker 3er Pack|Kaffeemaschine|19.9|5.1|10|0.01
ETS-KM-FILTER|Wasserfilter Claris Smart|Kaffeemaschine|34.9|13|9|0.01
ETS-KM-SEAL|Dichtungsset Brühgruppe|Kaffeemaschine|8.9|1.9|7|0.02
ETS-KM-GRIND|Mahlwerk Keramik|Kaffeemaschine|99|46|2|0.06
ETS-KM-MILK|Milchschlauch Set|Kaffeemaschine|12.9|3.4|6|0.02
ETS-SA-BAG|Staubsaugerbeutel 10er|Staubsauger|14.9|4.3|10|0.01
ETS-SA-HEPA|HEPA Filter Dyson V8|Staubsauger|24.9|8.9|7|0.03
ETS-SA-AKKU|Akku Dyson V10 4000mAh|Staubsauger|89|71|6|0.19
ETS-SA-BRUSH|Turbobürste universal|Staubsauger|39.9|17|4|0.05
ETS-SA-HOSE|Saugschlauch 1.8m|Staubsauger|29.9|11.5|3|0.04
ETS-BO-LAMP|Backofenlampe 25W|Backofen|7.9|2.3|8|0.02
ETS-BO-FAN|Heissluftventilator|Backofen|59.9|26|3|0.05
ETS-BO-ELEM|Heizspirale Umluft|Backofen|44.9|19|4|0.05
ETS-BO-KNOB|Drehknebel Set|Backofen|19.9|7.1|5|0.03
ETS-BO-SEAL|Backofendichtung 4-seitig|Backofen|24.9|9.8|4|0.04
ETS-FB-UNI|Universal-Fernbedienung|Zubehör|19.9|16.4|7|0.24
ETS-ZB-SPRAY|Edelstahlpflege Spray|Zubehör|12.9|3.3|5|0.01
ETS-ZB-HOSE|Zulaufschlauch 2.5m|Zubehör|17.9|5.6|6|0.02
`;

export const MOCK_PRODUCTS: MockProduct[] = CATALOG.trim()
  .split("\n")
  .map((row) => {
    const [sku, title, category, price, unitCost, weight, returnRate] = row.split("|");
    return { sku, title, category, price: +price, unitCost: +unitCost, weight: +weight, returnRate: +returnRate };
  });

interface MockCampaign extends AdCampaign {
  dailySpend: number;
  platformRoas: number;
}

// Platform-reported ROAS looks fine on many of these; POAS tells the real story.
export const MOCK_CAMPAIGNS: MockCampaign[] = [
  { id: "g-101", channel: "google_ads", name: "Shopping – Waschmaschinen Ersatzteile", type: "SHOPPING", status: "active", dailySpend: 180, platformRoas: 6.5 },
  { id: "g-102", channel: "google_ads", name: "Search – Brand Ersatzteilstore", type: "SEARCH", status: "active", dailySpend: 55, platformRoas: 14 },
  { id: "g-103", channel: "google_ads", name: "PMax – Gesamtsortiment", type: "PERFORMANCE_MAX", status: "active", dailySpend: 320, platformRoas: 3.0 },
  { id: "g-104", channel: "google_ads", name: "Shopping – Fernbedienung [sku:ETS-FB-UNI]", type: "SHOPPING", status: "active", dailySpend: 85, platformRoas: 4.2, sku: "ETS-FB-UNI" },
  { id: "g-105", channel: "google_ads", name: "Search – Generic 'Ersatzteile kaufen'", type: "SEARCH", status: "active", dailySpend: 140, platformRoas: 1.7 },
  { id: "m-201", channel: "meta", name: "Advantage+ Catalog – Kaffeemaschinen", type: "CATALOG_SALES", status: "active", dailySpend: 110, platformRoas: 5.4 },
  { id: "m-202", channel: "meta", name: "Retargeting – Warenkorbabbrecher", type: "CONVERSIONS", status: "active", dailySpend: 45, platformRoas: 8.5 },
  { id: "m-203", channel: "meta", name: "Prospecting – Dyson Akkus [sku:ETS-SA-AKKU]", type: "CONVERSIONS", status: "active", dailySpend: 120, platformRoas: 2.4, sku: "ETS-SA-AKKU" },
  { id: "m-204", channel: "meta", name: "Brand Awareness – Video DIY Reparatur", type: "AWARENESS", status: "active", dailySpend: 75, platformRoas: 0.35 },
  { id: "m-205", channel: "meta", name: "Black Friday 2025", type: "CONVERSIONS", status: "paused", dailySpend: 0, platformRoas: 0 },
];

/** mulberry32 PRNG seeded from a string. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const totalWeight = MOCK_PRODUCTS.reduce((s, p) => s + p.weight, 0);
function pickProduct(r: () => number): MockProduct {
  let x = r() * totalWeight;
  for (const p of MOCK_PRODUCTS) if ((x -= p.weight) <= 0) return p;
  return MOCK_PRODUCTS[MOCK_PRODUCTS.length - 1];
}

/** Recent fridge-parts promo: discounting ramps up over the last 21 days → margin erosion. */
function promoDiscount(category: string, date: ISODate, today: ISODate): number {
  if (category !== "Kühlschrank" || date < addDays(today, -21)) return 0;
  return date >= addDays(today, -10) ? 0.25 : 0.12;
}

function generateDay(date: ISODate, today: ISODate) {
  const cost = costConfig();
  const r = rng(`orders:${date}`);
  const weekday = new Date(date).getUTCDay();
  const base = weekday === 0 || weekday === 6 ? 85 : 120;
  const count = Math.round(base * (0.85 + r() * 0.3));
  const orders: Order[] = [];
  const refunds: Refund[] = [];

  for (let i = 0; i < count; i++) {
    const id = `${date.replaceAll("-", "")}-${i}`;
    const lineCount = r() < 0.55 ? 1 : r() < 0.7 ? 2 : 3;
    const lines = Array.from({ length: lineCount }, () => {
      const p = pickProduct(r);
      const qty = r() < 0.85 ? 1 : 2;
      const discount = round2(p.price * qty * promoDiscount(p.category, date, today));
      if (r() < p.returnRate) {
        refunds.push({ orderId: id, date: addDays(date, REFUND_DELAY_DAYS), sku: p.sku, qty, amount: round2(p.price * qty - discount) });
      }
      return { sku: p.sku, qty, unitPrice: p.price, discount };
    });
    const total = lines.reduce((s, l) => s + l.unitPrice * l.qty - l.discount, 0);
    orders.push({ id, date, lines, shippingCost: cost.shippingCostPerOrder, paymentFee: round2(total * cost.paymentFeePct + cost.paymentFeeFixed) });
  }
  return { orders, refunds };
}

const todayUTC = () => toISODate(new Date());

export function mockShop(range: DateRange, today = todayUTC()) {
  const orders: Order[] = [];
  const refunds: Refund[] = [];
  // Start earlier so refunds of orders placed just before the range still land inside it.
  for (const date of eachDay({ from: addDays(range.from, -REFUND_DELAY_DAYS), to: range.to })) {
    const day = generateDay(date, today);
    if (inRange(date, range)) orders.push(...day.orders);
    refunds.push(...day.refunds.filter((x) => inRange(x.date, range)));
  }
  const products: Product[] = MOCK_PRODUCTS.map(({ sku, title, category, price, unitCost }) => ({ sku, title, category, price, unitCost }));
  return { currency: DEFAULT_CURRENCY, products, orders, refunds };
}

export function mockAds(channel: AdCampaign["channel"], range: DateRange) {
  const list = MOCK_CAMPAIGNS.filter((c) => c.channel === channel);
  const campaigns: AdCampaign[] = list.map(({ id, channel, name, type, status, sku }) => ({ id, channel, name, type, status, sku }));
  const adSpend: AdSpendDaily[] = [];
  for (const date of eachDay(range)) {
    for (const c of list) {
      if (c.status !== "active") continue;
      const r = rng(`ads:${c.id}:${date}`);
      const spend = round2(c.dailySpend * (0.8 + r() * 0.4));
      const conversionValue = round2(spend * c.platformRoas * (0.75 + r() * 0.5));
      const clicks = Math.round(spend / (0.6 + r() * 0.6));
      adSpend.push({
        campaignId: c.id,
        date,
        spend,
        impressions: clicks * Math.round(25 + r() * 40),
        clicks,
        conversions: round2(conversionValue / 75),
        conversionValue,
      });
    }
  }
  return { campaigns, adSpend };
}
