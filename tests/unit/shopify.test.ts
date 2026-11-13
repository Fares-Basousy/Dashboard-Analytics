import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearShopifyTokenCache, getShopifyAccessToken } from "@/lib/connectors/shopify/auth";
import { shopify } from "@/lib/connectors/shopify";
import { isGroupConfigured } from "@/lib/credentials/fields";

const DOMAIN = "ersatzteil-test.myshopify.com";
const CLIENT = { SHOPIFY_STORE_DOMAIN: DOMAIN, SHOPIFY_CLIENT_ID: "abc123", SHOPIFY_CLIENT_SECRET: "shpss_secret" };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

/** Minimal fake of Shopify: OAuth token endpoint + GraphQL with two order pages. */
function fakeShopify() {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/admin/oauth/access_token")) return json({ access_token: "tok-1", scope: "read_orders,read_products,read_inventory", expires_in: 86399 });
    const { query, variables } = JSON.parse(String(init?.body));
    if (query.includes("shop {")) return json({ data: { shop: { currencyCode: "EGP" } } });
    if (query.includes("productVariants")) {
      return json({ data: { productVariants: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ id: "gid://shopify/ProductVariant/1", sku: "P-1", title: "Default Title", price: "50.00", product: { title: "Pump", productType: "Washer" }, inventoryItem: { unitCost: { amount: "20.00" } } }] } } });
    }
    const page = variables.cursor ? 2 : 1;
    const order = { id: `gid://shopify/Order/${page}`, createdAt: "2026-11-02T10:00:00Z", totalPriceSet: { shopMoney: { amount: "50.00" } }, lineItems: { nodes: [{ name: "Pump", sku: "P-1", variant: { id: "gid://shopify/ProductVariant/1" }, quantity: 1, originalUnitPriceSet: { shopMoney: { amount: "50.00" } }, totalDiscountSet: { shopMoney: { amount: "0" } } }] }, refunds: [], transactions: [] };
    return json({ data: { orders: { pageInfo: { hasNextPage: page === 1, endCursor: page === 1 ? "c1" : null }, nodes: [order] } } });
  });
  return { fetchMock, calls };
}

describe("Shopify credentials", () => {
  it("accept client credentials (current) or a legacy token", () => {
    expect(isGroupConfigured("shopify", CLIENT)).toBe(true);
    expect(isGroupConfigured("shopify", { SHOPIFY_STORE_DOMAIN: DOMAIN, SHOPIFY_ADMIN_TOKEN: "shpat_x" })).toBe(true);
    expect(isGroupConfigured("shopify", { SHOPIFY_STORE_DOMAIN: DOMAIN, SHOPIFY_CLIENT_ID: "abc" })).toBe(false);
  });
});

describe("Shopify access token", () => {
  let fake: ReturnType<typeof fakeShopify>;
  beforeEach(() => {
    clearShopifyTokenCache();
    fake = fakeShopify();
    vi.stubGlobal("fetch", fake.fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses a legacy static token without any request", async () => {
    expect(await getShopifyAccessToken({ SHOPIFY_STORE_DOMAIN: DOMAIN, SHOPIFY_ADMIN_TOKEN: "shpat_x" })).toBe("shpat_x");
    expect(fake.fetchMock).not.toHaveBeenCalled();
  });

  it("exchanges client credentials as documented by Shopify", async () => {
    expect(await getShopifyAccessToken(CLIENT)).toBe("tok-1");
    const { url, init } = fake.calls[0];
    expect(url).toBe(`https://${DOMAIN}/admin/oauth/access_token`);
    expect(new Headers(init?.headers).get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({ grant_type: "client_credentials", client_id: "abc123", client_secret: "shpss_secret" });
  });

  it("reuses the token until shortly before it expires (24 h)", async () => {
    const t0 = 1_000_000;
    await getShopifyAccessToken(CLIENT, t0);
    await getShopifyAccessToken(CLIENT, t0 + 23 * 3600_000);
    expect(fake.fetchMock).toHaveBeenCalledTimes(1);
    await getShopifyAccessToken(CLIENT, t0 + 86_399_000 - 60_000); // inside the refresh margin
    expect(fake.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches products and all order pages with the exchanged token", async () => {
    const slice = await shopify.fetch({ from: "2026-11-01", to: "2026-11-02" }, CLIENT);
    expect(slice.products).toEqual([{ sku: "P-1", title: "Pump", category: "Washer", price: 50, unitCost: 20 }]);
    expect(slice.orders?.map((o) => o.id)).toEqual(["1", "2"]);
    expect(slice.currency).toBe("EGP");

    const graphql = fake.calls.filter((c) => c.url.endsWith("/graphql.json"));
    expect(graphql[0].url).toBe(`https://${DOMAIN}/admin/api/2026-10/graphql.json`);
    expect(graphql.every((c) => new Headers(c.init?.headers).get("x-shopify-access-token") === "tok-1")).toBe(true);
    const orderQuery = JSON.parse(String(graphql.find((c) => String(c.init?.body).includes("orders("))!.init?.body));
    expect(orderQuery.variables.q).toBe("created_at:>=2026-11-01 created_at:<=2026-11-02T23:59:59");
  });
});
