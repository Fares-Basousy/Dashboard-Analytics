import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runShopifySeed, type SeedEvent } from "@/lib/seed/shopify-seed";
import { clearShopifyTokenCache } from "@/lib/connectors/shopify/auth";
import { MOCK_PRODUCTS } from "@/lib/mock/seed";

const CREDS = { SHOPIFY_STORE_DOMAIN: "dev-shop.myshopify.com", SHOPIFY_ADMIN_TOKEN: "shpat_test" };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

interface FakeOptions {
  devStore?: boolean;
  scopes?: string[];
  existingSkus?: string[];
}

/** Minimal fake of the Shopify Admin GraphQL API, recording every mutation. */
function fakeShopify({ devStore = true, scopes = ["read_orders", "write_products", "write_orders"], existingSkus = [] }: FakeOptions = {}) {
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  let orderNo = 1000;
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const { query, variables } = JSON.parse(String(init?.body));
    calls.push({ query, variables });
    if (query.includes("partnerDevelopment")) {
      return json({ data: { shop: { name: "Dev Shop", currencyCode: "CHF", plan: { partnerDevelopment: devStore } }, currentAppInstallation: { accessScopes: scopes.map((handle) => ({ handle })) } } });
    }
    if (query.includes("productVariants")) {
      const sku = String(variables.q).replace("sku:", "");
      return json({ data: { productVariants: { nodes: existingSkus.includes(sku) ? [{ id: `gid://shopify/ProductVariant/existing-${sku}` }] : [] } } });
    }
    if (query.includes("productSet")) {
      return json({ data: { productSet: { product: { variants: { nodes: [{ id: `gid://shopify/ProductVariant/new-${variables.input.variants[0].sku}` }] } }, userErrors: [] } } });
    }
    if (query.includes("orderCreate")) {
      orderNo += 1;
      const lines = variables.order.lineItems.map((l: { variantId: string }, i: number) => ({ id: `gid://shopify/LineItem/${orderNo}${i}`, sku: l.variantId.split("-").slice(1).join("-") }));
      return json({ data: { orderCreate: { order: { id: `gid://shopify/Order/${orderNo}`, name: `#${orderNo}`, lineItems: { nodes: lines } }, userErrors: [] } } });
    }
    if (query.includes("refundCreate")) return json({ data: { refundCreate: { userErrors: [] } } });
    throw new Error(`unexpected query ${query.slice(0, 60)}`);
  });
  return { fetchMock, calls, mutations: (name: string) => calls.filter((c) => c.query.includes(name)) };
}

async function seed(orders: number, opts?: FakeOptions) {
  const fake = fakeShopify(opts);
  vi.stubGlobal("fetch", fake.fetchMock);
  const events: SeedEvent[] = [];
  const result = runShopifySeed(CREDS, { orders, days: 30, orderIntervalMs: 0, onEvent: (e) => events.push(e) });
  return { fake, events, result };
}

describe("Shopify seed", () => {
  beforeEach(() => clearShopifyTokenCache());
  afterEach(() => vi.unstubAllGlobals());

  it("refuses stores that are not development stores, before writing anything", async () => {
    const { fake, result } = await seed(3, { devStore: false });
    await expect(result).rejects.toThrow(/not a development store/);
    expect(fake.mutations("mutation")).toHaveLength(0);
  });

  it("explains missing write scopes", async () => {
    const { result } = await seed(3, { scopes: ["read_orders"] });
    await expect(result).rejects.toThrow(/write_products, write_orders/);
  });

  it("reports pending → seeding → done and creates the requested orders", async () => {
    const { fake, events, result } = await seed(3);
    await result;
    expect(events[0]).toMatchObject({ type: "status" });
    expect(events.filter((e) => e.type === "progress").map((e) => (e as { done: number }).done)).toEqual([1, 2, 3]);
    expect(events.at(-1)).toMatchObject({ type: "done", orders: 3, products: MOCK_PRODUCTS.length });
    expect(fake.mutations("orderCreate")).toHaveLength(3);
  });

  it("creates VAT-inclusive, backdated, tagged orders", async () => {
    const { fake, result } = await seed(1);
    await result;
    const order = fake.mutations("orderCreate")[0].variables.order as {
      taxesIncluded: boolean;
      processedAt: string;
      tags: string[];
      lineItems: { priceSet: { shopMoney: { amount: number } }; quantity: number; taxLines: { rate: number; priceSet: { shopMoney: { amount: number } } }[] }[];
    };
    expect(order.taxesIncluded).toBe(true);
    expect(order.tags).toContain("profit-pilot-seed");
    expect(order.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
    const line = order.lineItems[0];
    const gross = line.priceSet.shopMoney.amount * line.quantity;
    expect(line.taxLines[0].rate).toBe(0.081);
    expect(line.taxLines[0].priceSet.shopMoney.amount).toBeCloseTo((gross * 0.081) / 1.081, 2);
  });

  it("reuses products that already exist (safe to run again)", async () => {
    const { fake, result } = await seed(1, { existingSkus: MOCK_PRODUCTS.map((p) => p.sku) });
    await result;
    expect(fake.mutations("productSet")).toHaveLength(0);
  });

  it("stops creating orders when the caller aborts", async () => {
    const fake = fakeShopify();
    vi.stubGlobal("fetch", fake.fetchMock);
    const controller = new AbortController();
    const events: SeedEvent[] = [];
    await runShopifySeed(CREDS, {
      orders: 5,
      days: 30,
      orderIntervalMs: 0,
      signal: controller.signal,
      onEvent: (e) => {
        events.push(e);
        if (e.type === "progress" && e.done === 2) controller.abort();
      },
    });
    expect(fake.mutations("orderCreate")).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ type: "done", orders: 2 });
  });
});
