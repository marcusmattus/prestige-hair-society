import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * These need a running app with a reachable database, so they are separate
 * from `npm test` (which runs everywhere). Point BASE_URL at a deployment, or
 * leave it unset and Playwright will build and start the app itself.
 *
 *   npm run db:demo          # local database with fixtures
 *   npm run test:e2e
 *
 * The mobile project is not decoration: the booking flow is the thing most
 * customers will use on a phone, and a 390px viewport is where a drawer or a
 * date strip breaks first.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // The salon runs on London time; pinning it keeps date assertions stable
    // wherever CI happens to be.
    timezoneId: "Europe/London",
    locale: "en-GB",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  // Only start a server when pointing at localhost; a BASE_URL override means
  // the app is already running somewhere.
  webServer: BASE_URL.includes("localhost")
    ? {
        command: "npm run build && npm run start",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
