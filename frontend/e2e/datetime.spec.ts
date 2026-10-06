import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
let platform: any, server: any, base: string, directory: string;
async function start(origins: string[], port = 0) {
  platform = createApp({
    databasePath: join(directory, "e2e.sqlite"),
    origins,
    frontendPath: resolve("../frontend/dist"),
  });
  server = platform.app.listen(port, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
}
async function stop() {
  await new Promise<void>((r) => {
    server.close(() => r());
    server.closeAllConnections();
  });
  platform.close();
}
test.beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "race-datetime-browser-"));
  await start([]);
  base = "http://127.0.0.1:" + server.address().port;
  await stop();
  await start([base], Number(new URL(base).port));
});
test.afterEach(async () => {
  await stop();
  for (const name of readdirSync(directory)) unlinkSync(join(directory, name));
  rmdirSync(directory);
});
async function login(page: Page) {
  for (const path of ["register", "login"]) {
    const r = await page.request.post(base + "/api/v1/auth/" + path, {
      headers: { Origin: base },
      data: {
        username: "datetime",
        password: "x",
        ...(path === "register" ? { displayName: "日期测试" } : {}),
      },
    });
    expect(r.ok()).toBe(true);
  }
}
async function keyboardConfirm(page: Page) {
  const confirm = page.locator(".ant-picker-ok button");
  await expect(confirm).toBeEnabled();
  for (
    let n = 0;
    n < 80 && !(await confirm.evaluate((e) => e === document.activeElement));
    n++
  )
    await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("开始日期时间", { exact: true })).toBeFocused();
}
for (const timezoneId of ["UTC", "Asia/Shanghai"]) {
  for (const width of [360, 768, 1440]) {
    test(
      "DT1/DT2 calendar create/edit/clear with keyboard at " +
        width +
        " in " +
        timezoneId,
      async ({ browser }) => {
        const context = await browser.newContext({
          timezoneId,
          viewport: { width, height: 900 },
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        try {
          await login(page);
          await page.goto(base + "/tournaments/new");
          await page.getByLabel("赛事名称").fill("日历赛事");
          const input = page.getByLabel("开始日期时间", { exact: true });
          await input.focus();
          await expect(
            page.locator(".ant-picker-dropdown").filter({ visible: true }),
          ).toBeVisible();
          await expect(input).toBeFocused();
          await page.keyboard.type("2026-10-05 10:30:00.000");
          await keyboardConfirm(page);
          await expect(input).toHaveValue("2026-10-05 10:30");
          await page.keyboard.press("Enter");
          await expect(
            page.getByRole("button", { name: "取消选择" }),
          ).toBeVisible();
          await page
            .locator(".ant-picker-dropdown")
            .filter({ visible: true })
            .screenshot({
              path:
                "../output/playwright/datetime-popup-" +
                width +
                "-" +
                timezoneId.replace("/", "-") +
                ".png",
            });
          await page.screenshot({
            path:
              "../output/playwright/datetime-" +
              width +
              "-" +
              timezoneId.replace("/", "-") +
              ".png",
            fullPage: true,
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.keyboard.press("Escape");
          await expect(input).toBeFocused();
          await expect(input).toHaveValue("2026-10-05 10:30");
          await page.getByRole("button", { name: "创建", exact: true }).click();
          await expect(page).toHaveURL(/\/manage\/[^/]+\/overview$/);
          const id = page.url().split("/manage/")[1].split("/")[0];
          const read = () =>
            page.request
              .get(base + "/api/v1/tournaments/" + id)
              .then((r) => r.json());
          expect((await read()).data.startsAt).toBe("2026-10-05T02:30:00.000Z");
          await stop();
          await start([base], Number(new URL(base).port));
          await page.goto(base + "/manage/" + id + "/settings");
          await expect(input).toHaveValue("2026-10-05 10:30");
          await page.getByLabel("时区").selectOption("-240");
          await expect(input).toHaveValue("2026-10-04 22:30");
          await input.fill("2026-10-04 23:45:00.000");
          await keyboardConfirm(page);
          await page.getByRole("button", { name: "保存资料" }).click();
          await expect(
            page.getByText("资料已保存。", { exact: true }),
          ).toBeVisible();
          expect((await read()).data.startsAt).toBe("2026-10-05T03:45:00.000Z");
          await page.getByRole("button", { name: "清空开始时间" }).click();
          await page.getByRole("button", { name: "保存资料" }).click();
          await expect
            .poll(async () => (await read()).data.startsAt)
            .toBeNull();
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      },
    );
  }
}
test("DT2 invalid date blocks save; conflict preserves local time/offset until explicit replacement", async ({
  page,
}) => {
  await login(page);
  const response = await page.request.post(base + "/api/v1/tournaments", {
    headers: { Origin: base, "Idempotency-Key": "datetime-conflict" },
    data: {
      name: "旧赛事",
      game: "card",
      startsAt: "2026-10-05T02:30:47.123Z",
    },
  });
  const item = (await response.json()).data;
  await page.goto(base + "/manage/" + item.id + "/settings");
  const input = page.getByLabel("开始日期时间", { exact: true });
  await expect(input).toHaveValue("2026-10-05 10:30");
  await input.fill("2026-02-30 10:30");
  await expect(
    page.getByText("请输入有效的日期和时间。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "保存资料" })).toBeDisabled();
  await page.getByLabel("赛事名称").focus();
  await expect(input).toHaveValue("2026-02-30 10:30");
  await expect(page.getByRole("button", { name: "保存资料" })).toBeDisabled();
  await input.focus();
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("2026-10-05 10:30");
  await page.getByLabel("时区").selectOption("");
  await expect(page.getByRole("button", { name: "保存资料" })).toBeDisabled();
  await page.getByLabel("时区").selectOption("-240");
  await expect(input).toHaveValue("2026-10-04 22:30");
  await page.request.patch(base + "/api/v1/tournaments/" + item.id, {
    headers: { Origin: base, "Idempotency-Key": "concurrent-datetime" },
    data: {
      name: "服务器名称",
      startsAt: "2026-10-05T03:45:00.000Z",
      expectedVersion: 1,
    },
  });
  await page.getByLabel("赛事名称").fill("本地名称");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(
    page.getByText("资料版本已变化，请重新读取。", { exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue("2026-10-04 22:30");
  await expect(page.getByLabel("时区")).toHaveValue("-240");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByText(/本地输入保留/)).toBeVisible();
  await expect(input).toHaveValue("2026-10-04 22:30");
  await page.getByRole("button", { name: "确认使用服务器资料" }).click();
  await expect(page.getByLabel("赛事名称")).toHaveValue("服务器名称");
  await expect(input).toHaveValue("2026-10-05 11:45");
  await page.getByLabel("赛事名称").fill("只改名称");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("资料已保存。", { exact: true })).toBeVisible();
  const saved = (
    await (
      await page.request.get(base + "/api/v1/tournaments/" + item.id)
    ).json()
  ).data;
  expect(saved.startsAt).toBe("2026-10-05T03:45:00.000Z");
});

test("DT2 New York DST gap does not affect a fixed +08 wall time; calendar draft cancellation restores original", async ({
  browser,
}) => {
  const context = await browser.newContext({
    timezoneId: "America/New_York",
    viewport: { width: 768, height: 900 },
  });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto(base + "/tournaments/new");
    await page.getByLabel("赛事名称").fill("固定偏移与夏令时");
    const input = page.getByLabel("开始日期时间", { exact: true });
    await input.focus();
    await expect(
      page.locator(".ant-picker-dropdown").filter({ visible: true }),
    ).toBeVisible();
    await page.keyboard.type("2026-03-08 02:30:00.000");
    await keyboardConfirm(page);
    await expect(input).toHaveValue("2026-03-08 02:30");
    await page.keyboard.press("Enter");
    await page.locator('.ant-picker-cell[title="2026-03-09"]').click();
    await expect(
      page.getByRole("button", { name: "创建", exact: true }),
    ).toBeDisabled();
    const cancel = page.getByRole("button", { name: "取消选择" });
    for (
      let n = 0;
      n < 100 && !(await cancel.evaluate((e) => e === document.activeElement));
      n++
    )
      await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("2026-03-08 02:30");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    await expect(page).toHaveURL(/\/manage\/[^/]+\/overview$/);
    const id = page.url().split("/manage/")[1].split("/")[0];
    const saved = (
      await (await page.request.get(base + "/api/v1/tournaments/" + id)).json()
    ).data;
    expect(saved.startsAt).toBe("2026-03-07T18:30:00.000Z");
  } finally {
    await context.close();
  }
});
