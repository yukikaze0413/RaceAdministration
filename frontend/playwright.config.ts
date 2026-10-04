import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60000,
  use: {
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
