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
  unassigned: string[] = [],
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
    const graph = G.sample("single");
    graph.stages[0].nodeIds = graph.stages[0].nodeIds.filter(
      (id: string) => !unassigned.includes(id),
    );
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
test("stage subset splits out and selecting the original stage joins back", async ({
  page,
}) => {
  await fixture(page, async () => {
    await page.getByRole("button", { name: "适应全图", exact: true }).click();
    await page.locator('[data-canvas-node="M1"] .canvas-drag').click();
    await page.keyboard.press("Control+Shift+G");
    await expect(page.locator("[data-stage-id]")).toHaveCount(2);
    await expect(
      page
        .getByRole("button", { name: "选择阶段 2 · 阶段 2", exact: true })
        .first(),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "移除 M1", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
      .first()
      .click();
    await page
      .locator('[data-canvas-node="M1"] .canvas-drag')
      .click({ modifiers: ["Control"] });
    await page.keyboard.press("Control+Shift+G");
    await expect(page.getByRole("status")).toContainText(
      "所选组件已加入 Stage 1",
    );
    await expect(page.locator("[data-stage-id]")).toHaveCount(1);
    await expect(page.locator(".canvas-stage-members li")).toHaveCount(7);
    await page
      .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
      .first()
      .click();
    await page.keyboard.press("Control+Shift+G");
    await expect(page.locator("[data-stage-id]")).toHaveCount(1);
    await expect(page.locator(".canvas-stage-members li")).toHaveCount(7);
  });
});

test("grouping a newly added component replaces stale stage selection and numbers survive reload", async ({
  page,
}) => {
  await fixture(page, async () => {
    await page
      .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
      .first()
      .click();
    await page
      .locator(".canvas-component-category")
      .getByRole("button", { name: "随机排序", exact: true })
      .click();
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.locator("[data-stage-id]")).toHaveCount(2);
    await expect(
      page
        .getByRole("button", { name: "选择阶段 2 · 阶段 2", exact: true })
        .first(),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".canvas-stage-members li")).toHaveCount(1);
    await page.getByRole("button", { name: "删除阶段 2", exact: true }).click();
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("已保存");
    await page.reload();
    await page
      .locator(".canvas-component-category")
      .getByRole("button", { name: "随机排序", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "创建阶段", exact: true }),
    ).toBeEnabled();
    await page.keyboard.press("Control+Shift+G");
    await expect(
      page
        .getByRole("button", { name: "选择阶段 2 · 阶段 2", exact: true })
        .first(),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "新建空 Stage", exact: true }),
    ).toHaveCount(0);
  });
});

test("port matching preserves selection on blank and pan, switches invalid targets, reconnects and disconnects on self", async ({
  page,
}) => {
  await fixture(page, async () => {
    await page.getByRole("button", { name: "适应全图", exact: true }).click();
    const count = await page.locator("[data-canvas-edge]").count();
    const source = page.getByRole("button", {
      name: "参赛来源 初始席位集合 输出",
      exact: true,
    });
    const a = page.locator('[data-canvas-node="M1"] .port-input').first();
    const slot = page.getByRole("button", {
      name: "展开器 Seed 1 输出",
      exact: true,
    });
    await page.getByRole("button", { name: "多选模式", exact: true }).click();
    await source.click();
    await expect(source).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "多选模式", exact: true }).click();
    await a.click();
    await expect(a).toBeEnabled();
    await expect(a).toHaveAttribute("aria-pressed", "true");
    await expect(source).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".canvas-port-selected")).toHaveCount(1);
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(count);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page
      .getByLabel("赛程规划画布区域", { exact: true })
      .click({ position: { x: 8, y: 8 } });
    await expect(a).toHaveAttribute("aria-pressed", "true");
    const viewport = page.getByLabel("赛程规划画布区域", { exact: true });
    const box = (await viewport.boundingBox())!;
    await page.mouse.move(box.x + 8, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + 28, box.y + 28);
    await page.mouse.up();
    await expect(a).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(count);
    await a.click();
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(count - 1);
    await expect(page.locator(".canvas-port-selected")).toHaveCount(0);
    await slot.click();
    await a.click();
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(count);
    await expect(page.locator(".canvas-port-selected")).toHaveCount(0);
    await source.click();
    const terminal = page
      .locator('[data-canvas-node="M7"] .port-output')
      .first();
    await terminal.click();
    await expect(terminal).toHaveAttribute("aria-pressed", "true");
    await expect(source).toHaveAttribute("aria-pressed", "false");
    await a.click();
    await expect(a).toBeEnabled();
    await expect(terminal).toHaveAttribute("aria-pressed", "false");
    await expect(a).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(count);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await source.click();
    await expect(source).toBeEnabled();
    await source.click();
    await expect(
      page.getByRole("heading", { name: "连接影响", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "确认处理受影响连接", exact: true })
      .click();
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(count - 9);
    await expect(page.locator(".canvas-port-selected")).toHaveCount(0);
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(count);
  });
});

test("direct port selection ignores illegal edges and stages combine mixed selections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fixture(page, async () => {
    await page.getByRole("button", { name: "适应全图", exact: true }).click();
    const originalEdges = await page.locator("[data-canvas-edge]").count();
    const output = page.getByRole("button", {
      name: "参赛来源 初始席位集合 输出",
      exact: true,
    });
    const input = page.locator('[data-canvas-node="M1"] .port-input').first();
    await output.click();
    await input.click();
    await expect(output).toHaveAttribute("aria-pressed", "false");
    await expect(input).toHaveAttribute("aria-pressed", "true");
    await expect(output).not.toHaveClass(/canvas-port-selected/);
    await expect(input).toHaveCSS("outline-width", "2px");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(originalEdges);
    await expect(
      page.getByRole("heading", { name: "连接表单", exact: true }),
    ).toHaveCount(0);
    await page.locator('[data-canvas-node="M7"] .port-output').first().click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(originalEdges);
    await page.getByRole("button", { name: "Pool", exact: true }).click();
    await page.getByRole("button", { name: "适应全图", exact: true }).click();
    const pool = page.locator('[data-node-kind="pool"]');
    await pool.locator(".port-input").first().click();
    await output.click();
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(
      originalEdges + 1,
    );
    await page.locator("[data-canvas-edge-hit]").last().focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: "删除所选连接", exact: true })
      .click();
    await expect(page.locator("[data-canvas-edge]")).toHaveCount(originalEdges);
    await page
      .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
      .first()
      .click();
    await page
      .locator('[data-canvas-node="source"] .canvas-drag')
      .click({ modifiers: ["Control"] });
    await pool.locator(".canvas-drag").click({ modifiers: ["Control"] });
    await expect(
      page
        .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
        .first(),
    ).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Control+Shift+G");
    await expect(page.locator("[data-stage-id]")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "确认转移阶段成员" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
      .first()
      .click();
    await expect(page.locator(".canvas-stage-members")).toContainText(
      "参赛来源",
    );
    await expect(page.locator(".canvas-stage-members")).toContainText("Pool");
    await page.locator('[data-canvas-node="M1"] .canvas-drag').click();
    await page
      .locator('[data-canvas-node="M2"] .canvas-drag')
      .click({ modifiers: ["Control"] });
    await page.keyboard.press("Control+G");
    await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(1);
    await page
      .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
      .first()
      .click();
    await expect(page.locator(".canvas-stage-members")).toContainText("子图");
    await expect(page.locator(".canvas-stage-members")).not.toContainText("M1");
    await expect(page.locator(".canvas-stage-members")).not.toContainText("M2");
    await page.locator('[data-canvas-node="expand"] .canvas-drag').click();
    await page.keyboard.press("Control+Shift+G");
    await expect(page.locator("[data-stage-id]")).toHaveCount(2);
    await page
      .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "选择阶段 2 · 阶段 2", exact: true })
      .first()
      .click({ modifiers: ["Control"] });
    await expect(
      page
        .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
        .first(),
    ).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Control+Shift+G");
    await expect(page.locator("[data-stage-id]")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText(
      "所选组件已加入 Stage 1",
    );
    await expect(
      page
        .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
        .first(),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
      .first()
      .click();
    await expect(page.locator(".canvas-stage-members")).toContainText("子图");
    await expect(page.locator(".canvas-stage-members")).toContainText("展开器");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    await page.reload();
    await page
      .getByRole("button", { name: "选择阶段 1 · 阶段 1", exact: true })
      .first()
      .click();
    await expect(page.locator(".canvas-stage-members")).toContainText("子图");
    await page.screenshot({
      path: "../output/playwright/canvas-direct-interaction-1440.png",
      fullPage: true,
    });
  });
});

test("stage toolbar shortcut, editable members and project deletion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fixture(
    page,
    async (base, id) => {
      const tool = page.getByRole("button", { name: "创建阶段", exact: true });
      await expect(tool).toBeAttached();
      await expect(page.locator(".canvas-palette")).toContainText("Subgraph");
      await expect(
        page
          .locator(".canvas-palette")
          .getByRole("button", { name: "创建阶段", exact: true }),
      ).toBeAttached();
      await page.getByRole("button", { name: "适应全图", exact: true }).click();
      await page.locator('[data-canvas-node="M1"] .canvas-drag').click();
      await page.keyboard.press("Control+Shift+G");
      await expect(page.locator("[data-stage-frame]")).toHaveCount(2);
      await page
        .getByRole("button", { name: "选择阶段 2 · 阶段 2", exact: true })
        .last()
        .click();
      await page.getByLabel("阶段名称", { exact: true }).fill("决胜阶段");
      await page.keyboard.press("Control+Shift+G");
      await expect(page.locator("[data-stage-id]")).toHaveCount(2);
      await page.getByLabel("阶段顺序", { exact: true }).selectOption("1");
      await expect(
        page.getByRole("button", { name: "选择阶段 1 · 决胜阶段" }).first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "移除 M1", exact: true }).click();
      await expect(
        page.getByText("阶段没有成员", { exact: true }),
      ).toBeVisible();
      await expect(page.locator('[data-canvas-node="M1"]')).toBeAttached();
      await page.getByLabel("添加阶段成员").selectOption("M2");
      await page.getByRole("button", { name: "添加成员", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "移除 M2", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "撤销", exact: true }).click();
      await expect(
        page.getByText("阶段没有成员", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("添加阶段成员").selectOption("M1");
      await page.getByRole("button", { name: "添加成员", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "移除 M1", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: "../output/playwright/canvas-stage-properties-1440.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "选择阶段 1 · 决胜阶段", exact: true })
        .first()
        .click();
      await page.keyboard.press("Delete");
      await expect(page.locator("[data-stage-frame]")).toHaveCount(1);
      await expect(page.locator("[data-canvas-node]")).toHaveCount(9);
      await page.getByRole("button", { name: "删除项目", exact: true }).click();
      await page.getByRole("button", { name: "取消删除", exact: true }).click();
      await expect(page.locator('[data-canvas-node="M1"]')).toBeAttached();
      await page.getByRole("button", { name: "删除项目", exact: true }).click();
      let dropped = false;
      await page.route("**/api/v1/planning-canvases/" + id, async (route) => {
        if (route.request().method() === "DELETE" && !dropped) {
          dropped = true;
          await route.fetch();
          await route.abort();
        } else await route.continue();
      });
      await page
        .getByRole("button", { name: "确认删除项目", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "取消删除", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "重试删除项目", exact: true })
        .click();
      await expect(page.locator("[data-canvas-node]")).toHaveCount(0);
      expect(
        (
          await page.request.get(base + "/api/v1/planning-canvases/" + id)
        ).status(),
      ).toBe(404);
    },
    ["M1"],
  );
});
test("cancelling a project switch preserves the current unsaved canvas", async ({
  page,
}) => {
  await fixture(page, async (base, id) => {
    const other = (
      await (
        await page.request.post(base + "/api/v1/planning-canvases", {
          headers: { Origin: base, "Idempotency-Key": "other-project" },
          data: {
            name: "另一个项目",
            graph: G.sample("single"),
          },
        })
      ).json()
    ).data;
    await page.reload();
    await page.getByRole("button", { name: "Match", exact: true }).click();
    await expect(page.locator("[data-canvas-node]")).toHaveCount(10);
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(other.id);
    await expect(
      page.getByRole("dialog", { name: "切换项目确认" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "取消切换", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "项目草稿", exact: true }),
    ).toHaveValue(id);
    expect(
      (
        await page.request.get(base + "/api/v1/planning-canvases/" + other.id)
      ).ok(),
    ).toBeTruthy();
    await expect(page.locator("[data-canvas-node]")).toHaveCount(10);
    await expect(page).toHaveURL(new RegExp("canvas=" + id));
  });
});
for (const width of [360, 768, 1440])
  test(`stage 与 session 完整流程 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(
      page,
      async (base, id) => {
        await page
          .getByRole("button", { name: "适应全图", exact: true })
          .click();
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
        await page
          .getByRole("button", { name: "创建阶段", exact: true })
          .click();
        await expect(page.locator("[data-stage-id]")).toHaveCount(2);
        await page
          .getByRole("button", { name: "保存草稿", exact: true })
          .click();
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
          .getByRole("textbox", {
            name: "时段开始（含 UTC 偏移）",
            exact: true,
          })
          .fill("2026-10-14T09:00:00+08:00");
        await editor
          .getByRole("textbox", {
            name: "时段结束（含 UTC 偏移）",
            exact: true,
          })
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
      },
      ["M5", "M6", "M7"],
    );
  });
test("仅当前格式有画布入口，旧格式不能创建且迁移入口已移除", async ({ page }) =>
  fixture(page, async (base) => {
    await expect(
      page.getByRole("button", { name: "迁移新机制", exact: true }),
    ).toHaveCount(0);
    const graph = { ...G.sample("single"), schemaVersion: "canvas-v1" };
    expect(
      (
        await page.request.post(base + "/api/v1/planning-canvases", {
          headers: { Origin: base, "Idempotency-Key": "reject-old" },
          data: { name: "旧配置", graph },
        })
      ).status(),
    ).toBe(422);
  }));

test("矩形框选创建 stage 保留节点层级，覆盖分组可撤销", async ({ page }) =>
  fixture(page, async () => {
    await page.getByRole("button", { name: "适应全图", exact: true }).click();
    const a = await page.locator('[data-canvas-node="M1"]').boundingBox(),
      b = await page.locator('[data-canvas-node="M2"]').boundingBox();
    if (!a || !b) throw Error("Missing cards");
    await page.getByRole("button", { name: "框选模式", exact: true }).click();
    await page.mouse.move(a.x - 8, a.y - 8);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width + 8, b.y + b.height + 8, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(
      page.locator('[data-canvas-node][data-selected="true"]'),
    ).toHaveCount(2);
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.locator("[data-stage-id]")).toHaveCount(2);
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(page.locator("[data-stage-id]")).toHaveCount(1);
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.locator("[data-stage-frame]")).toHaveCount(2);
    await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(0);
  }, ["M1", "M2"]));
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
        data: { name: "另一项目", graph: G.sample("single") },
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
