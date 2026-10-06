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
    "account avatar rename persistence and permanent deletion at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await login(page);
      const me = (
        await (await page.request.get(base + "/api/v1/auth/session")).json()
      ).data.user;
      const event = await page.request.post(base + "/api/v1/tournaments", {
        headers: { Origin: base, "Idempotency-Key": "owned" },
        data: { name: "注销范围赛事", game: "card" },
      });
      expect(event.ok()).toBe(true);
      await page.goto(base + "/me/profile");
      await expect(page.getByText(me.id, { exact: true })).toBeVisible();
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await page.getByRole("button", { name: "修改名称", exact: true }).click();
      await page.getByLabel("显示名", { exact: true }).fill("头像测试");
      await page.getByRole("button", { name: "保存个人资料" }).click();
      await expect(
        page.getByText("个人资料已保存。", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "修改用户名", exact: true })
        .click();
      await page.getByLabel("用户名", { exact: true }).fill("changed_browser");
      await page.getByLabel("修改用户名的当前密码").fill("x");
      await page.getByRole("button", { name: "保存个人资料" }).click();
      await expect(
        page.getByText("个人资料已保存。", { exact: true }),
      ).toBeVisible();
      const png = await require("../../backend/node_modules/sharp")(
        require("node:crypto").randomBytes(256 * 256 * 4),
        { raw: { width: 256, height: 256, channels: 4 } },
      )
        .png({ compressionLevel: 0 })
        .toBuffer();
      expect(png.length).toBeGreaterThan(256 * 1024);
      await page.getByRole("button", { name: "点击头像修改" }).click();
      await page.getByLabel("选择头像图片", { exact: true }).setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: png,
      });
      await expect(
        page.getByRole("button", { name: "保存头像" }),
      ).toBeEnabled();
      const avatarRequest = page.waitForRequest(
        (r) => r.method() === "PATCH" && r.url().endsWith("/me"),
      );
      await page.getByRole("button", { name: "保存头像" }).click();
      expect(
        Buffer.from(
          (await avatarRequest).postDataJSON().avatar.split(",")[1],
          "base64",
        ).length,
      ).toBeLessThanOrEqual(256 * 1024);
      await expect(
        page.getByText("头像已保存。", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByText("changed_browser", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await expect(page.getByRole("img", { name: "用户头像" })).toHaveAttribute(
        "src",
        /^data:image\/webp;base64,/,
      );
      await expect(page.getByText(me.id, { exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "../output/playwright/account-profile-" + width + ".png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "删除账号", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      for (let i = 0; i < 7; i++) {
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(
            () => !!document.activeElement?.closest("dialog"),
          ),
        ).toBe(true);
      }
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await expect(
        dialog.getByText("当前拥有的赛事", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: "../output/playwright/account-delete-" + width + ".png",
        fullPage: true,
      });
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "删除账号", exact: true }),
      ).toBeFocused();
      await page.getByRole("button", { name: "删除账号", exact: true }).click();
      await page.getByLabel("注销验证密码").fill("wrong");
      await page.getByLabel("输入当前用户名确认").fill("changed_browser");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "永久删除账号及数据" }).click();
      await expect(
        dialog.getByText("当前密码不正确。", { exact: true }),
      ).toBeVisible();
      expect(
        platform.db
          .prepare("SELECT count(*) n FROM users WHERE id=?")
          .get(me.id).n,
      ).toBe(1);
      await page.getByLabel("注销验证密码").fill("x");
      await page.getByRole("button", { name: "永久删除账号及数据" }).click();
      await expect(page).toHaveURL(/login\?accountDeleted=1/);
      await expect(
        page.getByText("账号及相关数据已永久删除。", { exact: true }),
      ).toBeVisible();
      for (const [table, column] of [
        ["users", "id"],
        ["sessions", "userId"],
        ["tournaments", "ownerId"],
        ["catalog_requests", "actorId"],
      ])
        expect(
          platform.db
            .prepare(
              "SELECT count(*) n FROM " + table + " WHERE " + column + "=?",
            )
            .get(me.id).n,
        ).toBe(0);
      await stop();
      await start([base], Number(new URL(base).port));
      expect(
        platform.db
          .prepare("SELECT count(*) n FROM users WHERE id=?")
          .get(me.id).n,
      ).toBe(0);
      expect(
        (await (await page.request.get(base + "/api/v1/auth/session")).json())
          .data.user,
      ).toBeNull();
    },
  );
}

test("overview cancels pending preview, retries failure and confirms logout separately", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await login(page);
  await page.goto(base + "/me/profile");
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/me/deletion-preview", async (route) => {
    await wait;
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { token: "late", counts: { tournaments: 99 } },
          requestId: "late",
        }),
      })
      .catch(() => {});
  });
  await page.getByRole("button", { name: "删除账号", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("处理中…", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "修改名称", exact: true }).click();
  release();
  await expect(page.getByLabel("显示名")).toHaveValue("游戏测试");
  await expect(
    page.getByRole("button", { name: "保存个人资料" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.unroute("**/api/v1/me/deletion-preview");
  await page.route("**/api/v1/me/deletion-preview", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "TEMPORARY", message: "预览暂不可用", retryable: true },
      }),
    }),
  );
  await page.getByRole("button", { name: "删除账号", exact: true }).click();
  await expect(dialog.getByText("预览暂不可用", { exact: true })).toBeVisible();
  await page.unroute("**/api/v1/me/deletion-preview");
  await dialog.getByRole("button", { name: "重新读取删除范围" }).click();
  await expect(page.getByLabel("注销验证密码")).toBeVisible();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    dialog.getByText("确认退出当前设备？您的账号、个人资料和赛事会保留。"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByText("gamebrowser", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "退出登录", exact: true }),
  ).toBeFocused();
});
