import { defineConfig, devices } from "@playwright/test";
import { ALL_CREDENTIAL_KEYS } from "./lib/credentials/fields";

const PORT = 3300;

/**
 * Hermetic tests: blank every credential so a developer's .env.local (real Shopify, AI keys…)
 * can't leak into the run. Next keeps variables already present in the process env, even empty ones.
 */
const NO_CREDENTIALS = Object.fromEntries(ALL_CREDENTIAL_KEYS.map((k) => [k, ""]));

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    // Deterministic: demo data + rule-based demo model, no external API calls.
    env: { ...NO_CREDENTIALS, AI_PROVIDER: "demo", CREDENTIALS_SECRET: "e2e-test-secret" },
  },
});
