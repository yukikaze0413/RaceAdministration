import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
let platform: any, server: any, base: string, tid: string;
test.beforeEach(async ({ page }) => {
  platform = createApp({ origins: [], frontendPath: resolve("dist") });
  server = platform.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  await new Promise<void>((r) => server.close(() => r()));
  platform.close();
  platform = createApp({ origins: [base], frontendPath: resolve("dist") });
  server = platform.app.listen(Number(new URL(base).port), "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  for (const path of ["register", "login"]) {
    const r = await page.request.post(base + "/api/v1/auth/" + path, {
      headers: { Origin: base },
      data: {
        username: "browser_owner",
        password: "p",
        ...(path === "register" ? { displayName: "浏览器主办" } : {}),
      },
    });
    expect(r.ok()).toBeTruthy();
  }
  const r = await page.request.post(base + "/api/v1/tournaments", {
    headers: { Origin: base, "Idempotency-Key": "event" },
    data: { name: "浏览器赛事", game: "card", visibility: "public" },
  });
  tid = (await r.json()).data.id;
});
test.afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  platform.close();
});
test("报名页面真实发布自定义收集表", async ({ page }) => {
  await page.goto(base + "/manage/" + tid + "/registration");
  await expect(page.getByRole("heading", { name: "报名收集表" })).toBeVisible();
  await page.getByRole("button", { name: "添加字段" }).click();
  await page.getByLabel("字段名称").fill("参赛昵称");
  await page.getByLabel("必填", { exact: true }).check();
  await page.getByRole("button", { name: "保存字段" }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
  await page.getByRole("button", { name: "发布并开放报名" }).click();
  await expect(page.getByText("已发布版本 1")).toBeVisible();
});
test("可运行预设创建后可通过具名端口重连并保存画布", async ({ page }) => {
  await page.goto(base + "/manage/" + tid + "/templates");
  await page
    .getByRole("button", { name: "使用8人两组循环 → 四强淘汰预设" })
    .click();
  await expect(page.getByRole("heading", { name: "赛制画布" })).toBeVisible();
  await expect(page.locator(".graph-edge")).toHaveCount(4);
  await page.getByLabel("画布缩放").fill("1.25");
  await page.getByRole("button", { name: "保存画布布局" }).click();
  await expect(page.getByRole("status")).toContainText("布局已保存");
  await page.reload();
  await expect(page.getByLabel("画布缩放")).toHaveValue("1.25");
});
test("整轮推进页面提供真实开赛与规则操作", async ({ page }) => {
  await page.goto(base + "/manage/" + tid + "/rounds");
  await expect(
    page.getByRole("heading", { name: "赛事运行与整轮推进" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "开始赛事" })).toBeVisible();
  await expect(page.getByText("请先审批并锁定名单")).toBeVisible();
});
for (const width of [360, 768, 1440])
  test("真实两人赛事从报名到冠军 " + width, async ({ page, browser }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/manage/" + tid + "/templates");
    await page.getByRole("button", { name: "使用8人单败淘汰预设" }).click();
    await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
    await page.getByRole("button", { name: "冻结结构…" }).click();
    await page.getByRole("button", { name: "确认冻结", exact: true }).click();
    await expect(page.getByText("结构已冻结，赛事尚未启动。")).toBeVisible();
    await page.goto(base + "/manage/" + tid + "/registration");
    await page.getByRole("button", { name: "发布并开放报名" }).click();
    await expect(page.getByText("已发布版本 1")).toBeVisible();
    for (let i = 1; i <= 2; i++) {
      const context = await browser.newContext({
          viewport: { width, height: 900 },
        }),
        p = await context.newPage();
      for (const path of ["register", "login"])
        expect(
          (
            await context.request.post(base + "/api/v1/auth/" + path, {
              headers: { Origin: base },
              data: {
                username: "entrant_" + i,
                password: "p",
                ...(path === "register" ? { displayName: "参赛者" + i } : {}),
              },
            })
          ).ok(),
        ).toBeTruthy();
      await p.goto(base + "/tournaments/" + tid + "/registration");
      await p.getByRole("button", { name: "提交个人报名" }).click();
      await expect(p.getByRole("status")).toContainText("报名已提交");
      await context.close();
    }
    await page.reload();
    for (let i = 1; i <= 2; i++) {
      const row = page.locator("article").filter({
        has: page.getByRole("heading", { name: "参赛者" + i, exact: true }),
      });
      await row.getByRole("button", { name: "审批并分配" }).click();
      await expect(row.getByText("已审批", { exact: false })).toBeVisible();
    }
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "锁定参赛名单" }).click();
    await expect(
      page.getByText("已锁定名单，前往整轮推进选择冻结配置并开赛。"),
    ).toBeVisible();
    await page.goto(base + "/manage/" + tid + "/rounds");
    await page.getByLabel("开赛配置").selectOption({ index: 1 });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "开始赛事" }).click();
    await page.getByLabel("左方比分").fill("2");
    await page.getByLabel("右方比分").fill("0");
    await page.getByLabel("裁定原因").fill("浏览器完整赛事验收");
    await page.getByRole("button", { name: "裁定赛果" }).click();
    await expect(
      page.getByText("已裁定，等待整轮确认", { exact: false }),
    ).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "确认整轮并推进" }).click();
    await expect(page.getByText("冠军：参赛者1")).toBeVisible();
    await page.reload();
    await expect(page.getByText("冠军：参赛者1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: "../output/playwright/tournament-completed-" + width + ".png",
      fullPage: true,
    });
  });

test("布局409重读保留本地缩放，明确确认后覆盖新版本", async ({ page }) => {
  await page.goto(base + "/manage/" + tid + "/templates");
  await page.getByRole("button", { name: "使用8人单败淘汰预设" }).click();
  await page.getByLabel("画布缩放").fill("1.5");
  const cid = page.url().split("/").at(-2)!;
  const remote = await page.request.put(
    base + "/api/v1/tournaments/" + tid + "/configurations/" + cid + "/layout",
    {
      headers: { Origin: base, "Idempotency-Key": "remote" },
      data: {
        expectedVersion: 0,
        positions: {},
        zoom: 0.75,
        pan: { x: 0, y: 0 },
      },
    },
  );
  expect(remote.ok()).toBeTruthy();
  await page.getByRole("button", { name: "保存画布布局" }).click();
  await expect(page.getByRole("alert")).toContainText("画布布局已变化");
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "GET" && r.url().endsWith("/layout"),
    ),
    page.getByRole("button", { name: "重试", exact: true }).click(),
  ]);
  await expect(
    page.getByRole("button", { name: "保存画布布局" }),
  ).toBeEnabled();
  await expect(page.getByLabel("画布缩放")).toHaveValue("1.5");
});
test("报名字段409重读保留本地字段", async ({ page }) => {
  await page.goto(base + "/manage/" + tid + "/registration");
  await page.getByRole("button", { name: "添加字段" }).click();
  await page.getByLabel("字段名称").fill("保留我的字段");
  const remote = await page.request.put(
    base + "/api/v1/tournaments/" + tid + "/registration-form",
    {
      headers: { Origin: base, "Idempotency-Key": "remote-form" },
      data: { expectedVersion: 0, fields: [] },
    },
  );
  expect(remote.ok()).toBeTruthy();
  await page.getByRole("button", { name: "保存字段" }).click();
  await expect(page.getByRole("alert")).toContainText("赛事状态已变化");
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === "GET" &&
        r.url().endsWith("/registration-form"),
      { timeout: 3000 },
    ),
    page.getByRole("button", { name: "重试", exact: true }).click(),
  ]);
  await expect(page.getByLabel("字段名称")).toHaveValue("保留我的字段");
});
test("画布连接限制容量且键盘表单保存真实晋级路径", async ({ page }) => {
  await page.goto(base + "/manage/" + tid + "/templates");
  await page
    .getByRole("button", { name: "使用8人两组循环 → 四强淘汰预设" })
    .click();
  await expect(page.getByRole("heading", { name: "赛制画布" })).toBeVisible();
  await page.getByLabel("连接来源").selectOption({ index: 1 });
  await page.getByLabel("连接目标").selectOption({ index: 3 });
  await page.getByLabel("来源名次").fill("64");
  await page.getByLabel("目标席位").fill("64");
  await page.getByRole("button", { name: "添加晋级连接" }).click();
  await expect(page.getByRole("status")).toContainText("超出容量");
  await page.getByLabel("来源名次").fill("3");
  await page.getByLabel("目标席位").fill("4");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "添加晋级连接" }).click();
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByText("草稿已保存。")).toBeVisible();
  const cid = page.url().split("/").at(-2),
    r = await page.request.get(
      base + "/api/v1/tournaments/" + tid + "/configurations/" + cid,
    ),
    data = (await r.json()).data;
  expect(
    data.routes.some(
      (r: any) => r.selector.from === 3 && r.placement.positions[0] === 4,
    ),
  ).toBeTruthy();
});

test("协作者编辑授权与撤权，报分权限不显示推进入口", async ({
  page,
  browser,
}) => {
  const reg = await page.request.post(base + "/api/v1/auth/register", {
    headers: { Origin: base },
    data: { username: "score_staff", password: "p", displayName: "报分管理员" },
  });
  expect(reg.ok()).toBeTruthy();
  await page.goto(base + "/manage/" + tid + "/collaborators");
  await page.getByLabel("注册用户名").fill("score_staff");
  await page.getByLabel("裁定赛果", { exact: true }).check();
  await page.getByRole("button", { name: "保存管理员权限" }).click();
  await expect(
    page.getByRole("heading", { name: "报分管理员", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext(),
    staff = await context.newPage();
  await context.request.post(base + "/api/v1/auth/login", {
    headers: { Origin: base },
    data: { username: "score_staff", password: "p" },
  });
  await staff.goto(base + "/manage/" + tid);
  await expect(
    staff.getByRole("heading", { name: "赛果与裁定" }),
  ).toBeVisible();
  await expect(
    staff.getByRole("link", { name: "整轮推进", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "编辑权限" }).click();
  await page.getByLabel("开赛、确认整轮与同分裁定", { exact: true }).check();
  await page.getByRole("button", { name: "保存管理员权限" }).click();
  await expect(
    page.getByText("裁定赛果、开赛、确认整轮与同分裁定", { exact: true }),
  ).toBeVisible();
  await staff.reload();
  await expect(
    staff.getByRole("link", { name: "整轮推进", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "撤销授权" }).click();
  await expect(page.getByText("尚无协作者。")).toBeVisible();
  await staff.reload();
  await expect(staff.getByText("没有操作权限", { exact: true })).toBeVisible();
  await context.close();
});
test("画布卡片键盘移动与三宽度布局", async ({ page }) => {
  await page.goto(base + "/manage/" + tid + "/templates");
  await page
    .getByRole("button", { name: "使用8人两组循环 → 四强淘汰预设" })
    .click();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: "赛制画布" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: "../output/playwright/tournament-graph-" + width + ".png",
      fullPage: true,
    });
  }
  const node = page.locator(".graph-node").first(),
    before = await node.boundingBox();
  await page
    .getByRole("button", { name: "移动阶段1 · 小组1", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  const after = await node.boundingBox();
  expect(after!.x).toBe(before!.x + 20);
  await page.getByRole("button", { name: "保存画布布局" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "赛制画布" })).toBeVisible();
});
