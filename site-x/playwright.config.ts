import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/accessibility",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3012", trace: "retain-on-failure" },
  webServer: {
    command: "npm run db:migrate && npm run db:seed && npm run build && npx next start -p 3012",
    url: "http://127.0.0.1:3012/api/auth/providers",
    timeout: 180_000,
    reuseExistingServer: false,
    env: { AUTH_URL: "http://127.0.0.1:3012", NEXTAUTH_URL: "http://127.0.0.1:3012" }
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], browserName: "chromium", channel: "chrome" } }, { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", channel: "chrome" } }]
});
