import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url),
  { createApp } = require("../../backend/src/app"),
  G = require("../../backend/src/planning-canvas/graph"),
  { listenTestServer } = require("../../backend/test/helpers/http-listener");
async function fixture(
  page: any,
  run: (base: string, id: string) => Promise<void>,
  legacy = false,
) {
  const dir = mkdtempSync(join(tmpdir(), "race-wave-e2e-")),
    origins: string[] = [],
    platform = createApp({
      databasePath: join(dir, "test.sqlite"),
      frontendPath: resolve("dist"),
      origins,
    });
  let server: any;
  try {
    server = await listenTestServer(platform.app);
    const base = "http://127.0.0.1:" + server.address().port;
    origins.push(base);
    for (const action of ["register", "login"])
      expect(
        (
          await page.request.post(base + "/api/v1/auth/" + action, {
            headers: { Origin: base },
            data: {
              username: "wave_e2e",
              password: "x",
              ...(action === "register" ? { displayName: "wave" } : {}),
            },
          })
        ).ok(),
      ).toBeTruthy();
    const graph = legacy
      ? G.sample("single")
      : G.migrate(G.sample("single")).graph;
    const r = await page.request.post(base + "/api/v1/planning-canvases", {
        headers: { Origin: base, "Idempotency-Key": "initial" },
        data: { name: "新机制", graph },
      }),
      saved = (await r.json()).data;
    await page.goto(base + "/canvas-lab?canvas=" + saved.id);
    await expect(page.locator('[data-canvas-node="M1"]')).toBeAttached();
    await run(base, saved.id);
  } finally {
    if (server?.listening)
      await new Promise<void>((r) => server.close(() => r()));
    platform.close();
    if (!dir.startsWith(join(tmpdir(), "race-wave-e2e-")))
      throw Error("Unexpected path");
    rmSync(dir, { recursive: true, force: true });
  }
}
for (const width of [360, 768, 1440])
  test(`stage 与 session 完整流程 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, async (base, id) => {
      await page.getByRole("button", { name: "适应全图", exact: true }).click();
      const select = async (id: string, multi: boolean) => {
        await page
          .getByRole("button", { name: "适应全图", exact: true })
          .click();
        await page
          .locator(`[data-canvas-node="${id}"] .canvas-drag`)
          .click({ modifiers: multi ? ["Control"] : [] });
      };
      await select("M5", false);
      await select("M6", true);
      await select("M7", true);
      await page.getByRole("button", { name: "创建阶段", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "阶段转移影响" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "确认转移阶段成员", exact: true })
        .click();
      await expect(page.locator("[data-stage-id]")).toHaveCount(2);
      await page.getByRole("button", { name: "保存草稿", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("草稿已保存");
      await page
        .getByRole("button", { name: "验证保存版本", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("规划验证通过");
      await expect(page.locator(".canvas-wave-result")).toHaveCount(3);
      const response = await page.request.post(
          base + "/api/v1/planning-canvases/" + id + "/preview",
          { headers: { Origin: base }, data: { expectedVersion: 2 } },
        ),
        preview = (await response.json()).data;
      await page.goto(base + "/canvas-lab/preview?canvas=" + id);
      const editor = page.getByRole("region", { name: "Session 排期编辑" });
      await expect(editor).toBeVisible();
      await editor
        .getByRole("button", { name: "新建 session", exact: true })
        .click();
      const add = editor.getByRole("combobox", {
        name: "Session 1 添加 wave",
        exact: true,
      });
      for (const w of preview.wavePlan.waves) await add.selectOption(w.id);
      await editor
        .getByRole("textbox", { name: "时段开始（含 UTC 偏移）", exact: true })
        .fill("2026-10-14T09:00:00+08:00");
      await editor
        .getByRole("textbox", { name: "时段结束（含 UTC 偏移）", exact: true })
        .fill("2026-10-14T12:00:00+08:00");
      await editor
        .getByRole("button", { name: "保存排期", exact: true })
        .click();
      await expect(editor.getByRole("status")).toContainText("排期已保存");
      await page.reload();
      await expect(
        page
          .getByRole("region", { name: "Session 排期编辑" })
          .getByRole("textbox", { name: "时段开始（含 UTC 偏移）" }),
      ).toHaveValue("2026-10-14T09:00:00+08:00");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    });
  });
test("旧画布迁移可取消，应用后保存并验证", async ({ page }) =>
  fixture(
    page,
    async () => {
      await page
        .getByRole("button", { name: "迁移新机制", exact: true })
        .click();
      await page.getByRole("button", { name: "取消迁移", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "迁移新机制", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "迁移新机制", exact: true })
        .click();
      await page.getByRole("button", { name: "应用迁移", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "迁移新机制", exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "保存草稿", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("草稿已保存");
      await page
        .getByRole("button", { name: "验证保存版本", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("规划验证通过");
    },
    true,
  ));
test("矩形框选创建 stage 保留节点层级，取消转移不改成员", async ({ page }) =>
  fixture(page, async () => {
    await page.getByRole("button", { name: "适应全图", exact: true }).click();
    const a = await page.locator('[data-canvas-node="M1"]').boundingBox(),
      b = await page.locator('[data-canvas-node="M2"]').boundingBox();
    if (!a || !b) throw Error("Missing cards");
    await page.getByRole("button", { name: "框选模式", exact: true }).click();
    await page.mouse.move(a.x - 8, a.y - 8);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width + 8, b.y + b.height + 8, { steps: 8 });
    await page.mouse.up();
    await expect(
      page.locator('[data-canvas-node][data-selected="true"]'),
    ).toHaveCount(2);
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await page.getByRole("button", { name: "取消变更", exact: true }).click();
    await expect(page.locator("[data-stage-id]")).toHaveCount(1);
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await page
      .getByRole("button", { name: "确认转移阶段成员", exact: true })
      .click();
    await expect(page.locator("[data-stage-frame]")).toHaveCount(2);
    await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(0);
  }));
test("重分组后的失效引用可修复，排序不接受失效 wave", async ({ page }) =>
  fixture(page, async (base, id) => {
    const path = base + "/api/v1/planning-canvases/" + id,
      headers = { Origin: base };
    const v = (
      await (
        await page.request.post(path + "/validate", {
          headers,
          data: { expectedVersion: 1 },
        })
      ).json()
    ).data;
    const sessions = [
      {
        id: "session",
        name: "保留时段",
        waveIds: v.wavePlan.waves.map((w: any) => w.id),
        timeRange: {
          startAt: "2026-10-14T09:00:00+08:00",
          endAt: "2026-10-14T12:00:00+08:00",
        },
      },
    ];
    expect(
      (
        await page.request.put(path + "/schedule", {
          headers: { ...headers, "Idempotency-Key": "sessions" },
          data: {
            expectedVersion: 1,
            expectedScheduleVersion: 0,
            wavePlanDigest: v.wavePlanDigest,
            sessions,
          },
        })
      ).ok(),
    ).toBeTruthy();
    const record = (await (await page.request.get(path)).json()).data;
    const edited = (
      await (
        await page.request.post(base + "/api/v1/planning-canvas/edit", {
          headers,
          data: {
            graph: record.graph,
            action: { type: "encapsulate", selected: ["M1"], id: "nested" },
          },
        })
      ).json()
    ).data;
    expect(
      (
        await page.request.put(path, {
          headers: { ...headers, "Idempotency-Key": "changed" },
          data: { graph: edited.graph, name: record.name, expectedVersion: 1 },
        })
      ).ok(),
    ).toBeTruthy();
    await page.request.post(path + "/validate", {
      headers,
      data: { expectedVersion: 2 },
    });
    page.once("dialog", (d) => d.accept());
    await page.goto(base + "/canvas-lab/preview?canvas=" + id);
    const editor = page.getByRole("region", { name: "Session 排期编辑" });
    await expect(editor.locator(".session-stale-wave")).toHaveCount(1);
    await editor
      .getByRole("button", { name: "预览依赖排序", exact: true })
      .click();
    await expect(editor.getByRole("status")).toContainText("存在失效批次");
    await expect(
      editor.getByRole("textbox", { name: "时段开始（含 UTC 偏移）" }),
    ).toHaveValue("2026-10-14T09:00:00+08:00");
    await editor
      .locator(".session-stale-wave")
      .getByRole("button", { name: "移除 wave", exact: true })
      .click();
    const add = editor.getByRole("combobox", {
      name: "保留时段 添加 wave",
      exact: true,
    });
    const options = await add
      .locator("option")
      .evaluateAll((opts: any[]) => opts.map((o) => o.value).filter(Boolean));
    for (const value of options) await add.selectOption(value);
    await editor
      .getByRole("button", { name: "预览依赖排序", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "应用依赖排序", exact: true })
      .click();
    await editor.getByRole("button", { name: "保存排期", exact: true }).click();
    await expect(editor.getByRole("status")).toContainText("排期已保存");
    await expect(editor.locator(".session-stale-wave")).toHaveCount(0);
  }));
test("同路径项目切换保留未保存画布，确认舍弃后才切换", async ({ page }) =>
  fixture(page, async (base, id) => {
    const create = await page.request.post(base + "/api/v1/planning-canvases", {
        headers: { Origin: base, "Idempotency-Key": "other" },
        data: { name: "另一项目", graph: G.migrate(G.sample("single")).graph },
      }),
      other = (await create.json()).data;
    await page.getByRole("link", { name: "打开赛程预览", exact: true }).click();
    await page.getByRole("link", { name: "返回画布", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("新机制");
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(other.id);
    await page.getByRole("button", { name: "切换项目", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("另一项目");
    await page
      .getByRole("textbox", { name: "草稿名称", exact: true })
      .fill("未保存修改");
    await page.evaluate(() => window.history.go(-2));
    await expect(
      page.getByRole("button", { name: "留在画布", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "留在画布", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("未保存修改");
  }));
