import { expect, test } from "@playwright/test";

const kpiValue = (page: import("@playwright/test").Page, label: string) =>
  page.getByTestId("kpi").filter({ hasText: label }).locator("p").nth(1);

test("overview shows the P&L, trend and AI findings", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Profit overview" })).toBeVisible();
  await expect(page.getByTestId("kpi")).toHaveCount(6);
  await expect(kpiValue(page, "Net profit")).toContainText("CHF");
  await expect(page.getByText("Where the money goes")).toBeVisible();
  await expect(page.getByTestId("insight").first()).toBeVisible();
  await expect(page.getByText(/Demo data for/)).toBeVisible();
});

test("navigation keeps the selected period", async ({ page }) => {
  await page.goto("/?range=7d");
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Products" }).click();
  await expect(page).toHaveURL(/\/products\?range=7d/);
  await expect(page.getByRole("heading", { name: "Product profitability" })).toBeVisible();
  for (const [link, heading] of [["Marketing", "Marketing performance"], ["AI Insights", "AI insights"], ["Connections & Keys", "Connections & keys"]]) {
    await nav.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("changing the period recalculates the numbers", async ({ page }) => {
  await page.goto("/");
  const revenue30 = await kpiValue(page, "Revenue").innerText();
  await page.getByRole("link", { name: "Last 7 days" }).click();
  await expect(page).toHaveURL(/range=7d/);
  await expect(kpiValue(page, "Revenue")).not.toHaveText(revenue30);
});

test("product table sorts by column", async ({ page }) => {
  await page.goto("/products");
  const table = page.getByTestId("products-table");
  const firstProfit = () => table.locator("tbody tr").first().locator("td").nth(7).innerText();
  const worst = await firstProfit();
  expect(worst.startsWith("−")).toBe(true); // default: biggest loss first
  await table.getByRole("button", { name: /Net profit/ }).click();
  await expect.poll(firstProfit).not.toBe(worst);
});

test("marketing flags campaigns that lose money", async ({ page }) => {
  await page.goto("/marketing");
  const firstRow = page.getByTestId("campaigns-table").locator("tbody tr").first();
  await expect(firstRow.locator("td").nth(6)).toHaveClass(/text-bad/); // POAS < 1, sorted worst first
});

test("AI assistant answers a question from the email", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "✦ Ask AI" }).click();
  await page.getByRole("button", { name: "Where are we currently losing money?" }).click();
  const messages = page.getByTestId("chat-messages");
  await expect(messages.locator('[data-role="user"]')).toContainText("losing money");
  await expect(messages.getByText("analysed detected insights")).toBeVisible();
  await expect(messages.locator('[data-role="assistant"]')).toContainText("CHF");
});

test("insights page lists findings with impact", async ({ page }) => {
  await page.goto("/insights");
  await expect(page.getByTestId("insight").first()).toBeVisible();
  await expect(page.getByText(/Combined potential/)).toBeVisible();
});
