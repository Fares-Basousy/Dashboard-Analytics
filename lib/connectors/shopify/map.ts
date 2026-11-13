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
  createdAt: string;
  totalPriceSet: Money;
  lineItems: { nodes: (ShopifyLineItem & { quantity: number; originalUnitPriceSet: Money; totalDiscountSet: Money })[] };
  refunds: {
    createdAt: string;
    refundLineItems: { nodes: { quantity: number; subtotalSet: Money; lineItem: ShopifyLineItem }[] };
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
    date: o.createdAt.slice(0, 10),
    lines: o.lineItems.nodes.map((l) => ({ sku: lineKey(l), qty: l.quantity, unitPrice: amount(l.originalUnitPriceSet), discount: amount(l.totalDiscountSet) })),
    shippingCost: cost.shippingCostPerOrder,
    // Shopify Payments exposes real fees; other gateways fall back to the configured rate.
    paymentFee: round2(realFees || total * cost.paymentFeePct + cost.paymentFeeFixed),
  };
  const refunds = o.refunds.flatMap((r) =>
    r.refundLineItems.nodes.map((l) => ({ orderId: id, date: r.createdAt.slice(0, 10), sku: lineKey(l.lineItem), qty: l.quantity, amount: amount(l.subtotalSet) })),
  );
  return { order, refunds };
}
