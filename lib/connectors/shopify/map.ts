/** Pure mappers: Shopify Admin GraphQL nodes → domain types. */
import type { Order, Product, Refund } from "@/lib/domain/types";
import { round2 } from "@/lib/format";
import { toNumber } from "../http";
import type { CostConfig } from "@/lib/config";

type Money = { shopMoney: { amount: string } };

export interface ShopifyVariantNode {
  sku: string | null;
  price: string;
  product: { title: string; productType: string };
  inventoryItem: { unitCost: { amount: string } | null } | null;
}

export interface ShopifyOrderNode {
  id: string;
  createdAt: string;
  totalPriceSet: Money;
  lineItems: { nodes: { sku: string | null; quantity: number; originalUnitPriceSet: Money; totalDiscountSet: Money }[] };
  refunds: {
    createdAt: string;
    refundLineItems: { nodes: { quantity: number; subtotalSet: Money; lineItem: { sku: string | null } }[] };
  }[];
  transactions: { fees: { amount: { amount: string } }[] }[];
}

const amount = (m: Money) => toNumber(m.shopMoney.amount);

export function mapVariant(v: ShopifyVariantNode): Product | null {
  if (!v.sku) return null;
  return {
    sku: v.sku,
    title: v.product.title,
    category: v.product.productType || "Uncategorized",
    price: toNumber(v.price),
    unitCost: toNumber(v.inventoryItem?.unitCost?.amount),
  };
}

export function mapOrder(o: ShopifyOrderNode, cost: CostConfig): { order: Order; refunds: Refund[] } {
  const id = o.id.split("/").pop()!;
  const realFees = o.transactions.flatMap((t) => t.fees).reduce((s, f) => s + toNumber(f.amount.amount), 0);
  const total = amount(o.totalPriceSet);
  const order: Order = {
    id,
    date: o.createdAt.slice(0, 10),
    lines: o.lineItems.nodes
      .filter((l) => l.sku)
      .map((l) => ({ sku: l.sku!, qty: l.quantity, unitPrice: amount(l.originalUnitPriceSet), discount: amount(l.totalDiscountSet) })),
    shippingCost: cost.shippingCostPerOrder,
    // Shopify Payments exposes real fees; other gateways fall back to the configured rate.
    paymentFee: round2(realFees || total * cost.paymentFeePct + cost.paymentFeeFixed),
  };
  const refunds = o.refunds.flatMap((r) =>
    r.refundLineItems.nodes
      .filter((l) => l.lineItem.sku)
      .map((l) => ({ orderId: id, date: r.createdAt.slice(0, 10), sku: l.lineItem.sku!, qty: l.quantity, amount: amount(l.subtotalSet) })),
  );
  return { order, refunds };
}
