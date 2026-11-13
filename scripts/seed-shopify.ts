/**
 * Seed a Shopify DEVELOPMENT store with the demo spare-parts world, so the dashboard can be shown
 * on live Shopify data: the catalogue (SKUs + cost per item), VAT-inclusive orders spread over the
 * last N days, and refunds (high-return products are refunded more often).
 *
 *   pnpm seed:shopify                 # 40 orders over the last 30 days
 *   pnpm seed:shopify --orders 20 --days 14
 *
 * Needs the app scopes write_products and write_orders (in addition to the read scopes) and the
 * SHOPIFY_* variables in .env.local. Refuses to run against a store that is not a dev store.
 * Dev stores accept at most 5 new orders per minute, so orders are paced (~13 s each).
 */
import { getShopifyAccessToken } from "@/lib/connectors/shopify/auth";
import { fetchJson } from "@/lib/connectors/http";
import { ALL_FIELDS, normalizeCredential, type Credentials } from "@/lib/credentials/fields";
import { MOCK_PRODUCTS } from "@/lib/mock/seed";
import { addDays, toISODate } from "@/lib/date-range";
import { round2 } from "@/lib/format";

const API_VERSION = "2026-10";
const SEED_TAG = "profit-pilot-seed";
const VAT_RATE = 0.081; // Swiss standard rate; prices are tax-inclusive like on a Swiss shop
const ORDER_INTERVAL_MS = 13_000; // dev stores: max 5 new orders per minute
const REFUND_BOOST = 1.5; // small samples need a few more returns to show the effect
const REQUIRED_SCOPES = ["write_products", "write_orders"];

type Product = (typeof MOCK_PRODUCTS)[number];

// ── setup ────────────────────────────────────────────────────────────────────

function readArgs() {
  const arg = (name: string, fallback: number) => {
    const i = process.argv.indexOf(`--${name}`);
    const v = i >= 0 ? Number(process.argv[i + 1]) : fallback;
    if (!Number.isInteger(v) || v <= 0) throw new Error(`--${name} must be a positive integer`);
    return v;
  };
  return { orders: arg("orders", 40), days: arg("days", 30) };
}

function shopifyCredentials(): Credentials {
  process.loadEnvFile(".env.local");
  const keys = ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET", "SHOPIFY_ADMIN_TOKEN"] as const;
  return Object.fromEntries(keys.map((k) => [k, normalizeCredential(ALL_FIELDS[k], process.env[k] ?? "")]).filter(([, v]) => v));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Same deterministic PRNG idea as the demo data: reruns produce the same sample. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── GraphQL ──────────────────────────────────────────────────────────────────

type GraphQL = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

function createClient(creds: Credentials, token: string): GraphQL {
  const url = `https://${creds.SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
  return async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const res = await fetchJson<{ data?: T; errors?: { message: string; extensions?: { code?: string } }[] }>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query, variables }),
      });
      const throttled = res.errors?.some((e) => e.extensions?.code === "THROTTLED");
      if (throttled && attempt < 5) {
        await sleep(2000 * attempt);
        continue;
      }
      if (res.errors?.length || !res.data) throw new Error(`GraphQL: ${JSON.stringify(res.errors)}`);
      return res.data;
    }
  };
}

/** Throw on mutation userErrors (Shopify reports validation problems there, not as HTTP errors). */
function check(userErrors: { field?: string[] | null; message: string }[], what: string) {
  if (userErrors.length) throw new Error(`${what}: ${userErrors.map((e) => `${e.field?.join(".") ?? ""} ${e.message}`).join("; ")}`);
}

// ── steps ────────────────────────────────────────────────────────────────────

async function preflight(graphql: GraphQL) {
  const data = await graphql<{
    shop: { name: string; currencyCode: string; plan: { partnerDevelopment: boolean } };
    currentAppInstallation: { accessScopes: { handle: string }[] };
  }>(`{ shop { name currencyCode plan { partnerDevelopment } } currentAppInstallation { accessScopes { handle } } }`);

  if (!data.shop.plan.partnerDevelopment) {
    throw new Error(`"${data.shop.name}" is not a development store. Seeding test orders into a real shop is not allowed.`);
  }
  const granted = new Set(data.currentAppInstallation.accessScopes.map((s) => s.handle));
  const missing = REQUIRED_SCOPES.filter((s) => !granted.has(s));
  if (missing.length) {
    throw new Error(
      `Missing app scopes: ${missing.join(", ")}.\n` +
        `Dev Dashboard → your app → create a new version with these scopes added → Release → approve the update on the store.`,
    );
  }
  return data.shop;
}

/** Create the catalogue (idempotent: products whose SKU already exists are reused). */
async function ensureProducts(graphql: GraphQL): Promise<Map<string, string>> {
  const variantBySku = new Map<string, string>();
  for (const p of MOCK_PRODUCTS) {
    const existing = await graphql<{ productVariants: { nodes: { id: string }[] } }>(
      `query($q: String!) { productVariants(first: 1, query: $q) { nodes { id } } }`,
      { q: `sku:${p.sku}` },
    );
    if (existing.productVariants.nodes[0]) {
      variantBySku.set(p.sku, existing.productVariants.nodes[0].id);
      continue;
    }
    const created = await graphql<{
      productSet: { product: { variants: { nodes: { id: string }[] } } | null; userErrors: { field: string[]; message: string }[] };
    }>(
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
    check(created.productSet.userErrors, `productSet ${p.sku}`);
    variantBySku.set(p.sku, created.productSet.product!.variants.nodes[0].id);
    console.log(`  + ${p.sku}  ${p.title}`);
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
    orderCreate: { order: { id: string; name: string; lineItems: { nodes: { id: string; sku: string | null }[] } } | null; userErrors: { field: string[]; message: string }[] };
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
  check(res.orderCreate.userErrors, "orderCreate");
  return res.orderCreate.order!;
}

async function refundLine(graphql: GraphQL, orderId: string, lineItemId: string) {
  // Since API 2026-04 refundCreate requires an idempotency key; one per order line makes reruns safe.
  const res = await graphql<{ refundCreate: { userErrors: { field: string[]; message: string }[] } }>(
    `mutation($input: RefundInput!, $key: String!) {
      refundCreate(input: $input) @idempotent(key: $key) { userErrors { field message } }
    }`,
    {
      key: `seed-${lineItemId.split("/").pop()}`,
      input: { orderId, refundLineItems: [{ lineItemId, quantity: 1, restockType: "NO_RESTOCK" }], transactions: [], note: "Customer return (seed)" },
    },
  );
  check(res.refundCreate.userErrors, "refundCreate");
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { orders: orderCount, days } = readArgs();
  const creds = shopifyCredentials();
  const graphql = createClient(creds, await getShopifyAccessToken(creds));

  const shop = await preflight(graphql);
  console.log(`Seeding "${shop.name}" (${shop.currencyCode}, dev store) – ${orderCount} orders over ${days} days\n`);

  console.log("Products");
  const variantBySku = await ensureProducts(graphql);
  console.log(`  ${variantBySku.size} products ready\n`);

  console.log(`Orders (paced for the dev-store limit, ~${Math.ceil((orderCount * ORDER_INTERVAL_MS) / 60_000)} min)`);
  const r = rng(Date.now() % 1_000_000);
  const today = toISODate(new Date());
  let refunds = 0;

  for (let i = 0; i < orderCount; i++) {
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
    refunds += returned.length;
    console.log(`  ${order.name}  ${day}  ${lines.map((l) => `${l.qty}× ${l.product.sku}`).join(", ")}${returned.length ? `  ↩ ${returned.length} refunded` : ""}`);

    const wait = ORDER_INTERVAL_MS - (Date.now() - startedAt);
    if (i < orderCount - 1 && wait > 0) await sleep(wait);
  }

  console.log(`\nDone: ${orderCount} orders, ${refunds} refunded lines (tag "${SEED_TAG}"). Restart the dashboard to bypass the cache.`);
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
