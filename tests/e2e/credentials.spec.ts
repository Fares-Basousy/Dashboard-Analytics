import { expect, test } from "@playwright/test";

test("API keys are stored in an encrypted httpOnly cookie and can be removed", async ({ page, context }) => {
  await page.goto("/settings");
  const meta = page.getByTestId("credentials-meta");
  await meta.getByLabel("Access token").fill("EAAB-test-token-123");
  await meta.getByRole("button", { name: "Save" }).click();
  await expect(meta.getByRole("status")).toHaveText("Saved securely in this browser.");
  await expect(meta.getByText("saved in browser")).toBeVisible();

  const cookie = (await context.cookies()).find((c) => c.name === "pd_credentials");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.value).not.toContain("EAAB-test-token-123"); // encrypted
  expect(await page.evaluate(() => document.cookie)).not.toContain("pd_credentials"); // invisible to JS

  // The secret never comes back to the browser.
  await page.reload();
  expect(await page.content()).not.toContain("EAAB-test-token-123");

  await meta.getByRole("button", { name: "Remove" }).click();
  await expect(meta.getByRole("status")).toHaveText("Removed from this browser.");
  await expect(meta.getByText("not set").first()).toBeVisible();
});

test("rejects invalid input without saving", async ({ page, context }) => {
  await page.goto("/settings");
  const ai = page.getByTestId("credentials-ai");
  await ai.getByRole("button", { name: "Save" }).click();
  await expect(ai.getByRole("status")).toHaveText("Enter at least one value.");
  expect((await context.cookies()).some((c) => c.name === "pd_credentials")).toBe(false);
});
