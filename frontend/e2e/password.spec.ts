import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
let platform: any, server: any, base: string, directory: string;
test.beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "race-password-browser-"));
  platform = createApp({
    databasePath: join(directory, "e2e.sqlite"),
    origins: [],
    frontendPath: resolve("../frontend/dist"),
  });
  server = platform.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  // Edge rejects port 6666; allocate another local test port before navigation.
  while (server.address().port === 6666) {
    await new Promise<void>((r) => server.close(() => r()));
    server = platform.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
  }
  base = "http://127.0.0.1:" + server.address().port;
  await new Promise<void>((r) => server.close(() => r()));
  platform.close();
  platform = createApp({
    databasePath: join(directory, "e2e.sqlite"),
    origins: [base],
    frontendPath: resolve("../frontend/dist"),
  });
  server = platform.app.listen(Number(new URL(base).port), "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
});
test.afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  platform.close();
  rmSync(directory, { recursive: true, force: true });
});
for (const [length, width] of [
  [1, 360],
  [1025, 1440],
]) {
  test(
    "AC1 feedback: actual " +
      length +
      "-character registration and login at " +
      width +
      "px",
    async ({ page }) => {
      const password = "p".repeat(length);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/register");
      await page
        .getByLabel("用户名", { exact: true })
        .fill("browser_password_" + length);
      await page.getByLabel("显示名").fill("密码切片测试");
      await page.getByLabel("密码", { exact: true }).fill(password);
      await expect(page.getByLabel("密码", { exact: true })).toHaveValue(
        password,
      );
      await page.getByRole("button", { name: "创建账号", exact: true }).click();
      await expect(page).toHaveURL(base + "/login?registered=1");
      await expect(page.getByLabel("密码", { exact: true })).toHaveValue("");
      await page
        .getByLabel("用户名", { exact: true })
        .fill("browser_password_" + length);
      await page.getByLabel("密码", { exact: true }).fill(password);
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await expect(page).toHaveURL(base + "/me/tournaments");
      await expect(
        page.getByRole("link", { name: "密码切片测试", exact: true }),
      ).toBeVisible();
      const session = await page.request.get(base + "/api/v1/auth/session");
      expect((await session.json()).data.user.username).toBe(
        "browser_password_" + length,
      );
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "../output/playwright/password-" + length + "-" + width + ".png",
        fullPage: true,
      });
    },
  );
}
