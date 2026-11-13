import { defineConfig, devices } from "@playwright/test";

const PORT = 3300;

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
    env: { AI_PROVIDER: "demo", CREDENTIALS_SECRET: "e2e-test-secret" },
  },
});
