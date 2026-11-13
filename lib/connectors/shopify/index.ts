import type { Connector } from "../types";
import type { Credentials } from "@/lib/credentials/fields";
import { fetchJson, requireCredential } from "../http";
import { costConfig } from "@/lib/config";
import { mockShop } from "@/lib/mock/seed";
import { mapOrder, mapVariant, type ShopifyOrderNode, type ShopifyVariantNode } from "./map";
import { getShopifyAccessToken } from "./auth";

const API_VERSION = "2026-10";
const MAX_PAGES = 40;

const VARIANTS_QUERY = `query($cursor: String) {
  productVariants(first: 250, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes { id sku title price product { title productType } inventoryItem { unitCost { amount } } }
  }
}`;

const SHOP_QUERY = `{ shop { currencyCode } }`;

const ORDERS_QUERY = `query($cursor: String, $q: String) {
  orders(first: 100, after: $cursor, query: $q) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id processedAt taxesIncluded
      totalPriceSet { shopMoney { amount } }
      lineItems(first: 50) { nodes { name sku variant { id } quantity originalUnitPriceSet { shopMoney { amount } } totalDiscountSet { shopMoney { amount } } taxLines { priceSet { shopMoney { amount } } } } }
      refunds { createdAt refundLineItems(first: 50) { nodes { quantity subtotalSet { shopMoney { amount } } lineItem { name sku variant { id } } } } }
      transactions(first: 5) { fees { amount { amount } } }
    }
  }
}`;

type Page<T> = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] };
type GraphQLResponse<T> = { data?: Record<string, Page<T>>; errors?: unknown };

const graphqlUrl = (creds: Credentials) => `https://${requireCredential(creds, "SHOPIFY_STORE_DOMAIN")}/admin/api/${API_VERSION}/graphql.json`;

/** Follow Shopify cursor pagination for one top-level connection. */
async function paginate<T>(creds: Credentials, token: string, query: string, key: string, variables: Record<string, unknown> = {}): Promise<T[]> {
  const url = graphqlUrl(creds);
  const headers = { "Content-Type": "application/json", "X-Shopify-Access-Token": token };
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

/** The store's currency (all `shopMoney` amounts are in it). */
async function shopCurrency(creds: Credentials, token: string): Promise<string> {
  const res: { data?: { shop: { currencyCode: string } }; errors?: unknown } = await fetchJson(graphqlUrl(creds), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: SHOP_QUERY }),
  });
  if (res.errors || !res.data) throw new Error(`Shopify GraphQL: ${JSON.stringify(res.errors).slice(0, 300)}`);
  return res.data.shop.currencyCode;
}

export const shopify: Connector = {
  id: "shopify",
  name: "Shopify",
  provides: "Orders, products, unit costs, refunds",
  credentialGroup: "shopify",
  async fetch(range, creds) {
    const token = await getShopifyAccessToken(creds);
    const [currency, variants, orderNodes] = await Promise.all([
      shopCurrency(creds, token),
      paginate<ShopifyVariantNode>(creds, token, VARIANTS_QUERY, "productVariants"),
      paginate<ShopifyOrderNode>(creds, token, ORDERS_QUERY, "orders", { q: `processed_at:>=${range.from} processed_at:<=${range.to}T23:59:59` }),
    ]);
    const cost = costConfig();
    const mapped = orderNodes.map((o) => mapOrder(o, cost));
    return {
      currency,
      products: variants.map(mapVariant),
      orders: mapped.map((m) => m.order),
      // Refunds of orders created in the range (Shopify ties refunds to orders).
      refunds: mapped.flatMap((m) => m.refunds),
    };
  },
  mock: (range) => mockShop(range),
};
