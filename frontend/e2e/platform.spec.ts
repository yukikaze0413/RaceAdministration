import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
let platform: any, server: any, base: string, directory: string;
test.beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "race-browser-"));
  platform = createApp({
    databasePath: join(directory, "e2e.sqlite"),
    origins: [],
    frontendPath: resolve("../frontend/dist"),
  });
  server = platform.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  // The ephemeral same-origin address must be known before configuring write protection.
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
  for (const name of readdirSync(directory)) unlinkSync(join(directory, name));
  rmdirSync(directory);
});
async function setup(page: Page, name: string) {
  const request = page.request;
  await request.post(base + "/api/v1/auth/register", {
    headers: { Origin: base },
    data: {
      username: name,
      displayName: name,
      password: "browser-test-pass-2026",
    },
  });
  await request.post(base + "/api/v1/auth/login", {
    headers: { Origin: base },
    data: { username: name, password: "browser-test-pass-2026" },
  });
  const response = await request.post(base + "/api/v1/tournaments", {
    headers: { Origin: base, "Idempotency-Key": name },
    data: { name: name + "赛事", game: "card", visibility: "public" },
  });
  return (await response.json()).data.id;
}
test("actual account → series → event → edit → validate → mapped preview → freeze → denied other owner", async ({
  page,
  browser,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  await page.goto(base + "/tournaments");
  await expect(page.getByText("没有符合条件的公开赛事。")).toBeVisible();
  await page.getByRole("link", { name: "登录 / 注册" }).click();
  await page.getByRole("link", { name: "创建账号", exact: true }).click();
  await page.getByLabel("用户名", { exact: true }).fill("browser_owner");
  await page.getByLabel("显示名").fill("办赛者");
  await page.getByLabel("密码", { exact: true }).fill("browser-test-pass-2026");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page.getByText("账号已创建，请登录。")).toBeVisible();
  await page.getByLabel("用户名", { exact: true }).fill("browser_owner");
  await page.getByLabel("密码", { exact: true }).fill("browser-test-pass-2026");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("link", { name: "我的系列", exact: true }).click();
  await page.getByRole("link", { name: "创建系列", exact: true }).click();
  await page.getByLabel("系列名称").fill("校园赛季");
  await page.getByLabel("说明", { exact: true }).fill("真实系列资料");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "校园赛季", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "我的赛事", exact: true }).click();
  await page.getByRole("link", { name: "创建赛事", exact: true }).click();
  await page.getByLabel("赛事名称").fill("秋季卡牌杯");
  await page.getByLabel("所属系列").selectOption({ label: "校园赛季" });
  await page.getByLabel("资料可见性").selectOption("public");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page.getByRole("heading", { name: "秋季卡牌杯" })).toBeVisible();
  const tid = page.url().split("/manage/")[1].split("/")[0];
  await page.getByRole("link", { name: "赛制模板", exact: true }).click();
  await page.getByRole("button", { name: "创建四组分流结构草稿" }).click();
  await expect(page.getByText("版本 1 · 可编辑草稿 · 已保存")).toBeVisible();
  const cid = page.url().split("/configurations/")[1].split("/")[0];
  await page.getByLabel("赛制意图").first().selectOption("double-elimination");
  await page.getByRole("link", { name: "晋级路由", exact: true }).click();
  await expect(
    page.getByRole("alertdialog", { name: "未保存草稿" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "继续编辑" })).toBeFocused();
  await page.getByRole("button", { name: "继续编辑" }).click();
  await expect(page.getByLabel("赛制意图").first()).toHaveValue(
    "double-elimination",
  );
  await page.getByRole("link", { name: "晋级路由", exact: true }).click();
  await page.getByRole("button", { name: "确认切换或离开" }).click();
  await expect(
    page.getByText("版本 1 · 可编辑草稿 · 有未保存修改"),
  ).toBeVisible();
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByText("草稿已保存。")).toBeVisible();
  await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
  await page.getByRole("button", { name: "校验已保存版本" }).click();
  await expect(page.getByRole("heading", { name: "计算报告" })).toBeVisible();
  await expect(
    page.locator(".readiness").getByText("通过", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "来源预演", exact: true }).click();
  await page.getByRole("button", { name: "运行预演" }).click();
  await expect(
    page.getByText("请完成全部样例来源的一对一映射，不能重复选择。"),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) {
    const select = page.getByLabel(
      "样例来源 " + String.fromCharCode(65 + i) + " 映射",
    );
    const option = select
      .locator("option")
      .filter({ hasText: "阶段 1 / 小组 " + (i + 1) + " ·" });
    await select.selectOption((await option.getAttribute("value"))!);
  }
  await page.getByRole("button", { name: "运行预演", exact: true }).click();
  await expect(
    page.locator(".readiness").getByText("当前输入通过", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
  let freezeCalls = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/freeze")) freezeCalls++;
  });
  await page.getByRole("button", { name: "冻结结构…" }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("button", { name: "冻结结构…" })).toBeFocused();
  expect(freezeCalls).toBe(0);
  await page.getByRole("button", { name: "冻结结构…" }).click();
  await page.getByRole("button", { name: "确认冻结", exact: true }).click();
  await expect(page.getByText("结构已冻结，赛事尚未启动。")).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("版本 3 · 结构已冻结，只读 · 已保存"),
  ).toBeVisible();
  await new Promise<void>((resolveClosed) =>
    server.close(() => resolveClosed()),
  );
  platform.close();
  platform = createApp({
    databasePath: join(directory, "e2e.sqlite"),
    origins: [base],
    frontendPath: resolve("../frontend/dist"),
  });
  server = platform.app.listen(Number(new URL(base).port), "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  await page.reload();
  await expect(
    page.getByText("版本 3 · 结构已冻结，只读 · 已保存"),
  ).toBeVisible();
  await page.getByRole("link", { name: "阶段与小组", exact: true }).click();
  await expect(page.getByLabel("阶段容量").first()).toBeDisabled();
  await page.goto(base + "/tournaments/" + tid + "/stages");
  await expect(
    page.getByText("以下为冻结结构摘要，赛制运行尚未实现。"),
  ).toBeVisible();
  const other = await browser.newContext();
  const b = await other.newPage();
  await setup(b, "browser_other");
  await b.goto(base + "/manage/" + tid + "/overview");
  await expect(b.getByText("没有操作权限", { exact: true })).toBeVisible();
  await other.close();
  for (const kind of [
    "registration",
    "matches",
    "results",
    "rounds",
    "sanctions",
    "collaborators",
  ]) {
    await page.goto(base + "/manage/" + tid + "/" + kind);
    await expect(page.getByText("功能尚未开放", { exact: true })).toBeVisible();
  }
  expect(failures).toEqual([]);
  const configuration = await page.request.get(
    base + "/api/v1/tournaments/" + tid + "/configurations/" + cid,
  );
  expect((await configuration.json()).data.state).toBe("structure-frozen");
});
test("360 / 768 / 1440 layouts, keyboard, deep links and API fallback isolation", async ({
  page,
}) => {
  const tid = await setup(page, "responsive_owner");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/manage/" + tid + "/overview");
    await expect(
      page.getByRole("heading", { name: "结构配置", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await page.locator(":focus").evaluate((node: HTMLElement) => node.blur());
    await page.screenshot({
      path: "../output/playwright/overview-" + width + ".png",
      fullPage: true,
    });
    await page.goto(base + "/manage/" + tid + "/registration");
    await expect(page.getByText("功能尚未开放", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "../output/playwright/unavailable-" + width + ".png",
      fullPage: true,
    });
  }
  const api = await page.request.get(base + "/api/v1/unknown");
  expect(api.status()).toBe(404);
  expect(api.headers()["content-type"]).toContain("application/json");
  const legacy = await page.request.get(base + "/api/test/hello");
  expect((await legacy.json()).message).toBe("你好，世界！");
});
test("read version conflicts recover and small-screen diagnostics focus the correct form field", async ({
  page,
}) => {
  const tid = await setup(page, "conflict_owner"),
    headers = { Origin: base, "Idempotency-Key": "conflict-template" };
  const template = await page.request.post(
    base + "/api/v1/tournaments/" + tid + "/configurations/from-template",
    { headers, data: { templateId: "four-groups", templateVersion: "1" } },
  );
  const c = (await template.json()).data,
    root = "/manage/" + tid + "/configurations/" + c.id;
  await page.goto(base + root + "/validation");
  await expect(page.getByText("版本 1 · 可编辑草稿 · 已保存")).toBeVisible();
  const { id, tournamentId, version, state, ...payload } = c;
  payload.routes[3].placement.positions = [1];
  const edited = await page.request.put(
    base + "/api/v1/tournaments/" + tid + "/configurations/" + id,
    {
      headers: { Origin: base, "Idempotency-Key": "conflict-edit" },
      data: { expectedVersion: 1, payload },
    },
  );
  expect(edited.status()).toBe(200);
  await page.getByRole("button", { name: "校验已保存版本" }).click();
  await expect(
    page.getByText("请处理版本或请求冲突", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(
    page.getByText("服务器版本 2 / draft；本地版本 1。", { exact: false }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "使用服务器结构" }).click();
  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByRole("button", { name: "校验已保存版本" }).click();
  await page
    .locator(".diagnostics li")
    .filter({ hasText: "POSITION_CONFLICT" })
    .getByRole("button", { name: "定位相关字段" })
    .click();
  await expect(
    page.locator('[data-path="/routes/3/placement/positions"]'),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../output/playwright/diagnostic-360.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "阶段与小组", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("阶段容量").first()).toBeVisible();
});
test("revoked session clears private UI, password recovery and participation stay explicit", async ({
  page,
}) => {
  const tid = await setup(page, "expired_owner");
  await page.goto(base + "/manage/" + tid + "/overview");
  await expect(
    page.getByRole("heading", { name: "结构配置", exact: true }),
  ).toBeVisible();
  await page.request.post(base + "/api/v1/auth/logout", {
    headers: { Origin: base },
  });
  await page.getByRole("link", { name: "赛制模板", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "登录", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("密码", { exact: true })).toHaveValue("");
  expect(page.url()).toContain("returnTo=");
  await page.goto(base + "/forgot-password");
  await page.getByRole("button", { name: "检查恢复服务" }).click();
  await expect(page.getByText("功能尚未开放", { exact: true })).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await page.goto(base + "/login");
  await page.getByLabel("用户名", { exact: true }).fill("expired_owner");
  await page.getByLabel("密码", { exact: true }).fill("browser-test-pass-2026");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("button", { name: "我参加的", exact: true }).click();
  await expect(
    page.getByRole("alert").getByText("当前尚未提供参赛记录服务。"),
  ).toBeVisible();
});
test("capability failure can be retried and unknown capability never enables configuration writes", async ({
  page,
}) => {
  const tid = await setup(page, "cap_browser");
  let fail = true;
  await page.route("**/api/v1/capabilities", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "STORE_UNAVAILABLE",
              message: "能力服务暂不可用",
              requestId: "test-cap",
              retryable: true,
            },
          }),
        })
      : route.continue(),
  );
  await page.goto(base + "/manage/" + tid + "/overview");
  await expect(page.getByText("能力服务暂不可用")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("button", { name: "新建空草稿" })).toBeVisible();
  await page.unroute("**/api/v1/capabilities");
  await page.route("**/api/v1/capabilities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { version: 1, capabilities: {} },
        requestId: "unknown",
      }),
    }),
  );
  await page.reload();
  await expect(
    page.getByText("服务未声明此能力，当前不能启用。"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "新建空草稿" })).toHaveCount(0);
});
test("metadata edits update context, visibility remains real, and profile saves without losing confirmation", async ({
  page,
  browser,
}) => {
  const tid = await setup(page, "metadata_owner");
  await page.goto(base + "/manage/" + tid + "/settings");
  await page.getByLabel("赛事名称").fill("修改后的真实名称");
  await page.getByLabel("资料可见性").selectOption("private");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("资料已保存。")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "修改后的真实名称", exact: true }),
  ).toBeVisible();
  const guest = await browser.newContext();
  const visitor = await guest.newPage();
  await visitor.goto(base + "/tournaments/" + tid);
  await expect(visitor.getByText("未找到资料", { exact: true })).toBeVisible();
  await guest.close();
  await page.goto(base + "/me/profile");
  await page.getByLabel("显示名").fill("更名办赛者");
  await page.getByRole("button", { name: "保存显示名" }).click();
  await expect(page.getByText("显示名已保存。")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "更名办赛者", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("显示名")).toHaveValue("更名办赛者");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "登录 / 注册", exact: true }),
  ).toBeVisible();
});
test("preview failure removes old allocations, pool sample retains DQ, and narrow tables scroll inside their region", async ({
  page,
}) => {
  const tid = await setup(page, "pool_owner");
  const response = await page.request.post(
      base + "/api/v1/tournaments/" + tid + "/configurations/from-template",
      {
        headers: { Origin: base, "Idempotency-Key": "pool-template" },
        data: { templateId: "pool", templateVersion: "1" },
      },
    ),
    c = (await response.json()).data;
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(
    base + "/manage/" + tid + "/configurations/" + c.id + "/preview",
  );
  await page.getByLabel("预演输入").selectOption("pool");
  for (const [letter, order] of [
    ["A", 1],
    ["B", 2],
  ] as const) {
    const select = page.getByLabel("样例来源 " + letter + " 映射");
    const option = select
      .locator("option")
      .filter({ hasText: "阶段 " + order + " ·" });
    await select.selectOption((await option.getAttribute("value"))!);
  }
  await page.getByRole("button", { name: "运行预演", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(
    page.locator("tbody").getByText("disqualified", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../output/playwright/preview-360.png",
    fullPage: true,
  });
  await page.getByLabel("样例来源 A 映射").selectOption("");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page.getByRole("button", { name: "运行预演", exact: true }).click();
  await expect(
    page.getByText("请完成全部样例来源的一对一映射，不能重复选择。"),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("page render errors recover, unknown pages are 404, and malformed responses never become empty data", async ({
  page,
}) => {
  let malformed = true;
  await page.route("**/api/v1/tournaments?**", (route) =>
    malformed
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { items: null },
            requestId: "render-fixture",
          }),
        })
      : route.continue(),
  );
  await page.goto(base + "/tournaments");
  await expect(page.getByText("页面显示发生异常，请重试。")).toBeVisible();
  malformed = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByText("没有符合条件的公开赛事。")).toBeVisible();
  await page.unroute("**/api/v1/tournaments?**");
  await page.route("**/api/v1/tournaments?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html>bad gateway</html>",
    }),
  );
  await page.reload();
  await expect(
    page.getByText("服务返回了无法识别的响应，请重新检查。"),
  ).toBeVisible();
  await expect(page.getByText("没有符合条件的公开赛事。")).toHaveCount(0);
  const response = await page.goto(base + "/unknown-page");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "404 页面不存在" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "返回赛事发现" })).toBeVisible();
});
