import { expect, test } from "@playwright/test";

test.describe("browser language", () => {
  test.use({ locale: "de-CH" });

  test("a URL without a language follows the browser's language", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/de$/);
    await expect(page.getByRole("heading", { name: "Gewinnübersicht" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });
});

test("the nav switches language on the same page and remembers it", async ({ page, context }) => {
  await page.goto("/en/products?range=7d");
  await page.getByRole("link", { name: "sv", exact: true }).click();
  await expect(page).toHaveURL(/\/sv\/products\?range=7d$/);
  await expect(page.getByRole("heading", { name: "Produktlönsamhet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Översikt" })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe("sv");

  await page.goto("/");
  await expect(page).toHaveURL(/\/sv$/);
});

test("the AI assistant answers in the page language", async ({ page }) => {
  await page.goto("/de");
  await page.getByRole("button", { name: "✦ KI fragen" }).click();
  await page.getByRole("button", { name: "Wo verlieren wir aktuell Geld?" }).click();
  const answer = page.getByTestId("chat-messages").locator('[data-role="assistant"]');
  await expect(answer).toContainText("Demomodus");
  await expect(answer).toContainText("verliert");
  await expect(page.getByTestId("chat-messages").getByText("analysiert: erkannte Insights")).toBeVisible();
});

test("form messages from the server are translated", async ({ page }) => {
  await page.goto("/sv/settings");
  const ai = page.getByTestId("credentials-ai");
  await ai.getByRole("button", { name: "Spara" }).click();
  await expect(ai.getByRole("status")).toHaveText("Ange minst ett värde.");
});

test("unsupported languages are not found", async ({ page }) => {
  const res = await page.goto("/fr/products");
  expect(res?.status()).toBe(404);
});
