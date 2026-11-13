import { expect, test } from "@playwright/test";

test("test-data button is disabled until Shopify is connected", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Generate test data" })).toBeDisabled();
  await expect(page.getByText("Connect Shopify first.")).toBeVisible();
});

test("seed API validates input and never runs without a Shopify connection", async ({ request }) => {
  const invalid = await request.post("/api/seed", { data: { orders: 999 } });
  expect(invalid.status()).toBe(400);

  const res = await request.post("/api/seed", { data: { orders: 1 } });
  expect(res.headers()["content-type"]).toContain("application/x-ndjson");
  const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
  expect(events.at(-1)).toEqual({ type: "error", message: "Shopify is not connected." });
});
