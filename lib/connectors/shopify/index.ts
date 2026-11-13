import type { Connector } from "../types";
import type { Credentials } from "@/lib/credentials/fields";
import { fetchJson, requireCredential } from "../http";
import { costConfig } from "@/lib/config";
import { mockShop } from "@/lib/mock/seed";
import { mapOrder, mapVariant, type ShopifyOrderNode, type ShopifyVariantNode } from "./map";

const API_VERSION = "2025-10";
const MAX_PAGES = 40;

const VARIANTS_QUERY = `query($cursor: String) {
  productVariants(first: 250, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes { sku price product { title productType } inventoryItem { unitCost { amount } } }
  }
}`;

const ORDERS_QUERY = `query($cursor: String, $q: String) {
  orders(first: 100, after: $cursor, query: $q) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id createdAt
      totalPriceSet { shopMoney { amount } }
      lineItems(first: 50) { nodes { sku quantity originalUnitPriceSet { shopMoney { amount } } totalDiscountSet { shopMoney { amount } } } }
      refunds { createdAt refundLineItems(first: 50) { nodes { quantity subtotalSet { shopMoney { amount } } lineItem { sku } } } }
      transactions(first: 5) { fees { amount { amount } } }
    }
  }
}`;

type Page<T> = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] };
type GraphQLResponse<T> = { data?: Record<string, Page<T>>; errors?: unknown };

/** Follow Shopify cursor pagination for one top-level connection. */
async function paginate<T>(creds: Credentials, query: string, key: string, variables: Record<string, unknown> = {}): Promise<T[]> {
  const url = `https://${requireCredential(creds, "SHOPIFY_STORE_DOMAIN")}/admin/api/${API_VERSION}/graphql.json`;
  const headers = { "Content-Type": "application/json", "X-Shopify-Access-Token": requireCredential(creds, "SHOPIFY_ADMIN_TOKEN") };
  const out: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res: GraphQLResponse<T> = await fetchJson(url, { method: "POST", headers, body: JSON.stringify({ query, variables: { ...variables, cursor } }) });
    if (res.errors || !res.data) throw new Error(`Shopify GraphQL: ${JSON.stringify(res.errors).slice(0, 300)}`);
    const page = res.data[key];
    out.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return out;
}

export const shopify: Connector = {
  id: "shopify",
  name: "Shopify",
  provides: "Orders, products, unit costs, refunds",
  credentialGroup: "shopify",
  async fetch(range, creds) {
    const [variants, orderNodes] = await Promise.all([
      paginate<ShopifyVariantNode>(creds, VARIANTS_QUERY, "productVariants"),
      paginate<ShopifyOrderNode>(creds, ORDERS_QUERY, "orders", { q: `created_at:>=${range.from} created_at:<=${range.to}T23:59:59` }),
    ]);
    const cost = costConfig();
    const mapped = orderNodes.map((o) => mapOrder(o, cost));
    return {
      products: variants.map(mapVariant).filter((p) => p !== null),
      orders: mapped.map((m) => m.order),
      // Refunds of orders created in the range (Shopify ties refunds to orders).
      refunds: mapped.flatMap((m) => m.refunds),
    };
  },
  mock: (range) => mockShop(range),
};
