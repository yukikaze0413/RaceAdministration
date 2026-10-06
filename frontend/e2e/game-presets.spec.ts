import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
let platform: any, server: any, base: string, directory: string;
async function start(origins: string[], port = 0) {
  platform = createApp({
    databasePath: join(directory, "games.sqlite"),
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
  directory = mkdtempSync(join(tmpdir(), "race-game-browser-"));
  await start([]);
  base = "http://127.0.0.1:" + server.address().port;
  await stop();
  await start([base], Number(new URL(base).port));
});
test.afterEach(async () => {
  await stop();
  for (const f of readdirSync(directory)) unlinkSync(join(directory, f));
  rmdirSync(directory);
});
async function login(page: any) {
  for (const p of ["register", "login"]) {
    const r = await page.request.post(base + "/api/v1/auth/" + p, {
      headers: { Origin: base },
      data: {
        username: "gamebrowser",
        password: "x",
        ...(p === "register" ? { displayName: "游戏测试" } : {}),
      },
    });
    expect(r.ok()).toBe(true);
  }
}
for (const width of [360, 768, 1440]) {
  test(
    "TC1/TC2 preset create/restart/edit/filter at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        Object.defineProperty(crypto, "randomUUID", {
          value: undefined,
          configurable: true,
        });
      });
      await login(page);
      await page.goto(base + "/tournaments/new");
      await page.getByLabel("赛事名称").fill("街霸六公开赛事");
      await page
        .getByRole("combobox", { name: "分类", exact: true })
        .selectOption("fighting");
      await page.getByLabel("游戏预设").selectOption("street-fighter-6");
      await expect(
        page.getByRole("combobox", { name: "分类", exact: true }),
      ).toHaveValue("fighting");
      await page.getByLabel("资料可见性").selectOption("public");
      await page.screenshot({
        path: "../output/playwright/game-preset-" + width + ".png",
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByRole("button", { name: "创建", exact: true }).click();
      await expect(page).toHaveURL(/\/manage\/[^/]+\/overview$/);
      const id = page.url().split("/manage/")[1].split("/")[0];
      await expect(page.locator(".context")).toContainText("街霸六");
      await stop();
      await start([base], Number(new URL(base).port));
      await page.goto(base + "/manage/" + id + "/settings");
      await expect(page.getByLabel("游戏预设")).toHaveValue("street-fighter-6");
      await page
        .getByRole("combobox", { name: "分类", exact: true })
        .selectOption("card");
      await page.getByLabel("游戏预设").selectOption("shadowverse");
      await page.getByRole("button", { name: "保存资料" }).click();
      await expect(
        page.getByText("资料已保存。", { exact: true }),
      ).toBeVisible();
      const read = (
        await (
          await page.request.get(base + "/api/v1/tournaments/" + id)
        ).json()
      ).data;
      expect(read.gameId).toBe("shadowverse");
      expect(read.game).toBe("card");
      await page.goto(base + "/tournaments");
      await page.getByLabel("筛选游戏").selectOption("street-fighter-6");
      await expect(
        page.getByText("没有符合条件的公开赛事。", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("筛选游戏").selectOption("shadowverse");
      await expect(
        page.getByRole("link", { name: "街霸六公开赛事", exact: true }),
      ).toBeVisible();
      await page.getByLabel("赛事分类").selectOption("fighting");
      await expect(
        page.getByText("没有符合条件的公开赛事。", { exact: true }),
      ).toBeVisible();
    },
  );
}
test("GP3 directory failure and TC1 conflict preserve local game until confirmation", async ({
  page,
}) => {
  await login(page);
  const r = await page.request.post(base + "/api/v1/tournaments", {
    headers: { Origin: base, "Idempotency-Key": "event" },
    data: { name: "旧分类赛事", game: "card" },
  });
  const item = (await r.json()).data;
  await page.goto(base + "/manage/" + item.id + "/settings");
  await page
    .getByRole("combobox", { name: "分类", exact: true })
    .selectOption("fighting");
  await page.getByLabel("游戏预设").selectOption("street-fighter-6");
  await page.getByLabel("赛事名称").fill("本地草稿");
  await page.request.patch(base + "/api/v1/tournaments/" + item.id, {
    headers: { Origin: base, "Idempotency-Key": "concurrent" },
    data: { gameId: "shadowverse", expectedVersion: 1 },
  });
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(
    page.getByText("资料版本已变化，请重新读取。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByText(/本地输入保留/)).toBeVisible();
  await expect(page.getByLabel("游戏预设")).toHaveValue("street-fighter-6");
  await page.getByRole("button", { name: "确认使用服务器资料" }).click();
  await expect(page.getByLabel("游戏预设")).toHaveValue("shadowverse");
  await page.route("**/api/v1/games", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "CATALOG_UNAVAILABLE",
          message: "目录不可用",
          retryable: true,
        },
      }),
    }),
  );
  await page.reload();
  await expect(page.getByText("目录不可用", { exact: true })).toBeVisible();
  await page.getByLabel("赛事名称").fill("失败时草稿");
  await expect(page.getByLabel("游戏预设")).toHaveValue("shadowverse");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("资料已保存。", { exact: true })).toBeVisible();
  await page.unroute("**/api/v1/games");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByLabel("游戏预设")).toBeEnabled();
  await expect(page.getByLabel("赛事名称")).toHaveValue("失败时草稿");
});

test("account settings changes password, requires new login and provides logout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await login(page);
  await page.goto(base + "/me/profile");
  await page.getByRole("button", { name: "修改密码", exact: true }).click();
  await page.getByLabel("当前密码", { exact: true }).fill("x");
  await page.getByLabel("新密码", { exact: true }).fill(" 新密码 ");
  await page.getByLabel("确认新密码", { exact: true }).fill("different");
  await page.getByRole("button", { name: "修改密码并重新登录" }).click();
  await expect(
    page.getByText("两次输入的新密码不一致。", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("确认新密码", { exact: true }).fill(" 新密码 ");
  await page.getByRole("button", { name: "修改密码并重新登录" }).click();
  await expect(page).toHaveURL(/login\?passwordChanged=1/);
  await page.getByLabel("用户名").fill("gamebrowser");
  await page.getByLabel("密码", { exact: true }).fill(" 新密码 ");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/me\/tournaments/);
  await page.goto(base + "/me/profile");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await page.getByRole("button", { name: "确认退出登录", exact: true }).click();
  await expect(page.getByRole("link", { name: "登录 / 注册" })).toBeVisible();
});
