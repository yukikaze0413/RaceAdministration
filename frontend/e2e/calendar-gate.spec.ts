import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const express = require("../../backend/node_modules/express");
let server: any, base: string;
test.beforeEach(async () => {
  const app = express();
  app.use(express.static(resolve("../output/calendar-gate-dist")));
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
});
test.afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});
for (const width of [360, 768, 1440]) {
  test(
    "calendar gate: Chinese popup, keyboard commit/cancel and clear at " +
      width,
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      const input = page.getByLabel("开始日期时间");
      await input.focus();
      await page.keyboard.type("2026-10-05 10:30:00");
      await page.keyboard.press("Enter");
      await expect(
        page.locator(".ant-picker-dropdown").filter({ visible: true }),
      ).toBeVisible();
      const confirm = page.locator(".ant-picker-ok button");
      await expect(confirm).toHaveText(/^确\s*定$/);
      for (
        let n = 0;
        n < 70 &&
        !(await confirm.evaluate((e) => e === document.activeElement));
        n++
      )
        await page.keyboard.press("Tab");
      await expect(confirm).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("选择结果")).toHaveText(
        "2026-10-05 10:30:00",
      );
      await expect(input).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(
        page.getByRole("button", { name: "取消选择" }),
      ).toBeVisible();
      await page.screenshot({
        path: "../output/playwright/calendar-gate-" + width + ".png",
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(input).toBeFocused();
      await expect(page.getByLabel("选择结果")).toHaveText(
        "2026-10-05 10:30:00",
      );
      await page.locator(".ant-picker-clear").click();
      await expect(page.getByLabel("选择结果")).toHaveText("未选择日期");
      expect(errors).toEqual([]);
    },
  );
}
