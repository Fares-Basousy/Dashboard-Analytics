/** Pure mappers: Shopify Admin GraphQL nodes → domain types. */
import type { Order, Product, Refund } from "@/lib/domain/types";
import { round2 } from "@/lib/format";
import { toNumber } from "../http";
import type { CostConfig } from "@/lib/config";

type Money = { shopMoney: { amount: string } };
type VariantRef = { id: string } | null;

export interface ShopifyVariantNode {
  id: string;
  sku: string | null;
  title: string;
  price: string;
  product: { title: string; productType: string };
  inventoryItem: { unitCost: { amount: string } | null } | null;
}

interface ShopifyLineItem {
  name: string;
  sku: string | null;
  variant: VariantRef;
}

export interface ShopifyOrderNode {
  id: string;
  /** Business date of the order (equals createdAt unless the order was imported/backdated). */
  processedAt: string;
  /** When true, line item prices include tax. */
  taxesIncluded: boolean;
  totalPriceSet: Money;
  lineItems: { nodes: (ShopifyLineItem & { quantity: number; originalUnitPriceSet: Money; totalDiscountSet: Money; taxLines: { priceSet: Money }[] })[] };
  refunds: {
    createdAt: string;
    refundLineItems: { nodes: { quantity: number; subtotalSet: Money; totalTaxSet: Money; lineItem: ShopifyLineItem }[] };
  }[];
  transactions: { fees: { amount: { amount: string } }[] }[];
}

const amount = (m: Money) => toNumber(m.shopMoney.amount);
const legacyId = (gid: string) => gid.split("/").pop()!;

/**
 * Stable product key: the SKU when the shop maintains one, otherwise the variant ID
 * (many shops have products without SKUs). Custom line items without a variant fall back to their name.
 */
export function productKey(sku: string | null, variant: VariantRef, name?: string): string {
  if (sku?.trim()) return sku.trim();
  if (variant) return `variant-${legacyId(variant.id)}`;
  return `custom-${name ?? "item"}`;
}

export function mapVariant(v: ShopifyVariantNode): Product {
  const hasOptions = v.title && v.title !== "Default Title";
  return {
    sku: productKey(v.sku, { id: v.id }),
    title: hasOptions ? `${v.product.title} – ${v.title}` : v.product.title,
    category: v.product.productType || "Uncategorized",
    price: toNumber(v.price),
    unitCost: toNumber(v.inventoryItem?.unitCost?.amount),
  };
}

const lineKey = (l: ShopifyLineItem) => productKey(l.sku, l.variant, l.name);

export function mapOrder(o: ShopifyOrderNode, cost: CostConfig): { order: Order; refunds: Refund[] } {
  const id = legacyId(o.id);
  const realFees = o.transactions.flatMap((t) => t.fees).reduce((s, f) => s + toNumber(f.amount.amount), 0);
  const total = amount(o.totalPriceSet);
  const order: Order = {
    id,
    date: o.processedAt.slice(0, 10),
    lines: o.lineItems.nodes.map((l) => ({
      sku: lineKey(l),
      qty: l.quantity,
      unitPrice: amount(l.originalUnitPriceSet),
      discount: amount(l.totalDiscountSet),
      includedTax: o.taxesIncluded ? l.taxLines.reduce((s, t) => s + amount(t.priceSet), 0) : 0,
    })),
    shippingCost: cost.shippingCostPerOrder,
    // Shopify Payments exposes real fees; other gateways fall back to the configured rate.
    paymentFee: round2(realFees || total * cost.paymentFeePct + cost.paymentFeeFixed),
  };
  // Verified on a live store: in tax-inclusive shops the refund subtotal is gross (VAT inside),
  // so the refunded VAT is removed like on the sale – otherwise refunds would be overstated.
  const refunds = o.refunds.flatMap((r) =>
    r.refundLineItems.nodes.map((l) => ({
      orderId: id,
      date: r.createdAt.slice(0, 10),
      sku: lineKey(l.lineItem),
      qty: l.quantity,
      amount: round2(amount(l.subtotalSet) - (o.taxesIncluded ? amount(l.totalTaxSet) : 0)),
    })),
  );
  return { order, refunds };
}
