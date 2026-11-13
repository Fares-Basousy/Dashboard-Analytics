/**
 * Seed a Shopify DEVELOPMENT store with the demo spare-parts world, so the dashboard can be shown on
 * live Shopify data: the catalogue (SKUs + cost per item), VAT-inclusive orders spread over the last
 * N days, and refunds (high-return products are refunded more often).
 *
 * Used by the "Generate test data" button (app/api/seed) and the CLI (scripts/seed-shopify.ts).
 * Never runs on install or deploy. Needs the app scopes write_products + write_orders and refuses any
 * store that is not a development store. Dev stores accept at most 5 new orders per minute.
 */
import { getShopifyAccessToken } from "@/lib/connectors/shopify/auth";
import { fetchJson } from "@/lib/connectors/http";
import type { Credentials } from "@/lib/credentials/fields";
import { MOCK_PRODUCTS } from "@/lib/mock/seed";
import { addDays, toISODate } from "@/lib/date-range";
import { round2 } from "@/lib/format";

const API_VERSION = "2026-10";
const SEED_TAG = "profit-pilot-seed";
const VAT_RATE = 0.081; // Swiss standard rate; prices are tax-inclusive like on a Swiss shop
const ORDER_INTERVAL_MS = 13_000; // dev stores: max 5 new orders per minute
const REFUND_BOOST = 1.5; // small samples need a few more returns to show the effect
const REQUIRED_SCOPES = ["write_products", "write_orders"];

/** Fits one serverless invocation (300 s): ~15 × 13 s for orders + time for the catalogue. */
export const MAX_ORDERS_PER_RUN = 15;

/** Progress events carry data, not sentences, so every UI can word them in its own language (lib/seed/messages.ts). */
export type SeedEvent =
  | { type: "status"; step: "checking" }
  | { type: "status"; step: "preparing"; products: number; shop: string }
  | { type: "progress"; done: number; total: number; order: string; day: string; items: string; refunded: number }
  | { type: "done"; orders: number; refunds: number; products: number; shop: string }
  | { type: "error"; message: string };

export interface SeedOptions {
  orders: number;
  days: number;
  onEvent: (event: SeedEvent) => void;
  /** Stop between orders when the caller goes away (e.g. the browser tab is closed). */
  signal?: AbortSignal;
  /** Pacing between orders; override in tests. */
  orderIntervalMs?: number;
}

type Product = (typeof MOCK_PRODUCTS)[number];
type UserErrors = { field?: string[] | null; message: string }[];
type GraphQL = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/** Deterministic PRNG (same idea as the demo data). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createClient(domain: string, token: string): GraphQL {
  const url = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;
  return async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const res = await fetchJson<{ data?: T; errors?: { message: string; extensions?: { code?: string } }[] }>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query, variables }),
      });
      if (res.errors?.some((e) => e.extensions?.code === "THROTTLED") && attempt < 5) {
        await sleep(2000 * attempt);
        continue;
      }
      if (res.errors?.length || !res.data) throw new Error(`Shopify: ${res.errors?.map((e) => e.message).join("; ") ?? "empty response"}`);
      return res.data;
    }
  };
}

/** Shopify reports validation problems in userErrors, not as HTTP errors. */
function check(userErrors: UserErrors, what: string) {
  if (userErrors.length) throw new Error(`${what}: ${userErrors.map((e) => `${e.field?.join(".") ?? ""} ${e.message}`.trim()).join("; ")}`);
}

async function preflight(graphql: GraphQL) {
  const data = await graphql<{
    shop: { name: string; currencyCode: string; plan: { partnerDevelopment: boolean } };
    currentAppInstallation: { accessScopes: { handle: string }[] };
  }>(`{ shop { name currencyCode plan { partnerDevelopment } } currentAppInstallation { accessScopes { handle } } }`);

  if (!data.shop.plan.partnerDevelopment) {
    throw new Error(`"${data.shop.name}" is not a development store – test data is only written to dev stores.`);
  }
  const granted = new Set(data.currentAppInstallation.accessScopes.map((s) => s.handle));
  const missing = REQUIRED_SCOPES.filter((s) => !granted.has(s));
  if (missing.length) {
    throw new Error(`The Shopify app is missing the scopes ${missing.join(", ")}. Add them in the Dev Dashboard (new version → Release → approve on the store).`);
  }
  return data.shop;
}

/** Create the catalogue; products whose SKU already exists are reused (safe to rerun). */
async function ensureProducts(graphql: GraphQL): Promise<Map<string, string>> {
  const variantBySku = new Map<string, string>();
  for (const p of MOCK_PRODUCTS) {
    const existing = await graphql<{ productVariants: { nodes: { id: string }[] } }>(
      `query($q: String!) { productVariants(first: 1, query: $q) { nodes { id } } }`,
      { q: `sku:${p.sku}` },
    );
    const found = existing.productVariants.nodes[0];
    if (found) {
      variantBySku.set(p.sku, found.id);
      continue;
    }
    const created = await graphql<{ productSet: { product: { variants: { nodes: { id: string }[] } } | null; userErrors: UserErrors } }>(
      `mutation($input: ProductSetInput!) {
        productSet(synchronous: true, input: $input) {
          product { variants(first: 1) { nodes { id } } }
          userErrors { field message }
        }
      }`,
      {
        input: {
          title: p.title,
          productType: p.category,
          vendor: "Profit Pilot Demo",
          status: "ACTIVE",
          productOptions: [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }],
          variants: [
            {
              optionValues: [{ optionName: "Title", name: "Default Title" }],
              price: p.price,
              sku: p.sku,
              inventoryItem: { cost: p.unitCost, tracked: false },
            },
          ],
        },
      },
    );
    check(created.productSet.userErrors, `Creating ${p.sku}`);
    variantBySku.set(p.sku, created.productSet.product!.variants.nodes[0].id);
  }
  return variantBySku;
}

function pickProduct(r: () => number): Product {
  const total = MOCK_PRODUCTS.reduce((s, p) => s + p.weight, 0);
  let x = r() * total;
  for (const p of MOCK_PRODUCTS) if ((x -= p.weight) <= 0) return p;
  return MOCK_PRODUCTS[MOCK_PRODUCTS.length - 1];
}

/** VAT contained in a tax-inclusive amount. */
const includedVat = (gross: number) => round2((gross * VAT_RATE) / (1 + VAT_RATE));

async function createOrder(graphql: GraphQL, currency: string, processedAt: string, lines: { product: Product; variantId: string; qty: number }[]) {
  const money = (amount: number) => ({ shopMoney: { amount: round2(amount), currencyCode: currency } });
  const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const res = await graphql<{
    orderCreate: { order: { id: string; name: string; lineItems: { nodes: { id: string; sku: string | null }[] } } | null; userErrors: UserErrors };
  }>(
    `mutation($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
      orderCreate(order: $order, options: $options) {
        order { id name lineItems(first: 10) { nodes { id sku } } }
        userErrors { field message }
      }
    }`,
    {
      order: {
        processedAt,
        taxesIncluded: true,
        tags: [SEED_TAG],
        lineItems: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.qty,
          priceSet: money(l.product.price),
          taxLines: [{ title: "MWST", rate: VAT_RATE, priceSet: money(includedVat(l.product.price * l.qty)) }],
        })),
        transactions: [{ kind: "SALE", status: "SUCCESS", gateway: "manual", amountSet: money(total) }],
      },
      options: { inventoryBehaviour: "BYPASS", sendReceipt: false, sendFulfillmentReceipt: false },
    },
  );
  check(res.orderCreate.userErrors, "Creating order");
  return res.orderCreate.order!;
}

async function refundLine(graphql: GraphQL, orderId: string, lineItemId: string) {
  // Since API 2026-04 refundCreate requires an idempotency key; one per order line makes reruns safe.
  const res = await graphql<{ refundCreate: { userErrors: UserErrors } }>(
    `mutation($input: RefundInput!, $key: String!) {
      refundCreate(input: $input) @idempotent(key: $key) { userErrors { field message } }
    }`,
    {
      key: `seed-${lineItemId.split("/").pop()}`,
      input: { orderId, refundLineItems: [{ lineItemId, quantity: 1, restockType: "NO_RESTOCK" }], transactions: [], note: "Customer return (seed)" },
    },
  );
  check(res.refundCreate.userErrors, "Refund");
}

/** Run the whole seed, reporting progress through `onEvent`. Throws on failure. */
export async function runShopifySeed(creds: Credentials, opts: SeedOptions): Promise<void> {
  const { orders: orderCount, days, onEvent, signal, orderIntervalMs = ORDER_INTERVAL_MS } = opts;
  if (!creds.SHOPIFY_STORE_DOMAIN) throw new Error("Shopify is not connected.");

  onEvent({ type: "status", step: "checking" });
  const graphql = createClient(creds.SHOPIFY_STORE_DOMAIN, await getShopifyAccessToken(creds));
  const shop = await preflight(graphql);

  onEvent({ type: "status", step: "preparing", products: MOCK_PRODUCTS.length, shop: shop.name });
  const variantBySku = await ensureProducts(graphql);

  const r = rng(Date.now() % 1_000_000);
  const today = toISODate(new Date());
  let created = 0;
  let refunds = 0;

  for (let i = 0; i < orderCount && !signal?.aborted; i++) {
    const startedAt = Date.now();
    const day = addDays(today, -Math.floor(r() * days));
    const processedAt = `${day}T${String(7 + Math.floor(r() * 14)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00Z`;
    const lineCount = r() < 0.55 ? 1 : r() < 0.7 ? 2 : 3;
    const products = [...new Map(Array.from({ length: lineCount }, () => pickProduct(r)).map((p) => [p.sku, p])).values()];
    const lines = products.map((p) => ({ product: p, variantId: variantBySku.get(p.sku)!, qty: r() < 0.85 ? 1 : 2 }));

    const order = await createOrder(graphql, shop.currencyCode, processedAt, lines);
    const returned = order.lineItems.nodes.filter((li) => {
      const p = products.find((x) => x.sku === li.sku);
      return p && r() < p.returnRate * REFUND_BOOST;
    });
    for (const li of returned) await refundLine(graphql, order.id, li.id);
    created += 1;
    refunds += returned.length;

    const items = lines.map((l) => `${l.qty}× ${l.product.sku}`).join(", ");
    onEvent({ type: "progress", done: created, total: orderCount, order: order.name, day, items, refunded: returned.length });

    const wait = orderIntervalMs - (Date.now() - startedAt);
    if (i < orderCount - 1 && wait > 0) await sleep(wait, signal);
  }

  onEvent({ type: "done", orders: created, refunds, products: variantBySku.size, shop: shop.name });
}
