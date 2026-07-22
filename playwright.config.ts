import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"] }
    }
  ],
  webServer: {
    command: "DEMO_MODE=true ALLOW_PRODUCTION_DEMO=true AUTH_SECRET='e2e-secret-at-least-32-characters-long-for-tests' CRON_SECRET='e2e-cron-secret-at-least-32-characters' AUTH_COOKIE_SECURE=false NEXT_PUBLIC_APP_URL='http://localhost:3100' MOBILE_MIN_VERSION='1.15.7' MOBILE_APK_URL='https://download.example.test/ClinicNova-1.15.7.apk' MOBILE_APK_SHA256='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' npm run start -- --hostname 127.0.0.1 --port 3100",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
