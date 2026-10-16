import { test, expect } from "./canvas-fixture";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
async function finishPropertyEdit(page: any) {
  await page
    .locator(".canvas-properties :focus")
    .evaluateAll((elements: Element[]) =>
      elements.forEach((element) => (element as HTMLElement).blur()),
    );
  await expect(page.locator(".canvas-lab")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function selectCard(page: any, name: string | RegExp, multi = false) {
  const card = page
    .locator("[data-canvas-node]")
    .filter({
      has: page.getByRole("button", { name, exact: typeof name === "string" }),
    })
    .first();
  await expect(card).toBeAttached();
  await page.getByRole("button", { name: "适应全图", exact: true }).click();
  if (multi && (await card.getAttribute("data-selected")) === "true") return;
  await card
    .locator(".canvas-drag")
    .click({ modifiers: multi ? ["Control"] : [] });
}
const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
const {
  listenTestServer,
} = require("../../backend/test/helpers/http-listener");
async function isolated(
  page: any,
  run: (base: string, platform: any) => Promise<void>,
) {
  const dir = mkdtempSync(join(tmpdir(), "race-canvas-interaction-")),
    origins: string[] = [],
    platform = createApp({
      databasePath: join(dir, "lab.sqlite"),
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
              username: "canvas_interaction",
              password: "canvas-test",
              ...(action === "register" ? { displayName: "画布测试" } : {}),
            },
          })
        ).ok(),
      ).toBeTruthy();
    await page.goto(base + "/canvas-lab");
    await expect(page.locator('[data-canvas-node="M1"]')).toBeAttached();
    await run(base, platform);
  } finally {
    if (server?.listening)
      await new Promise<void>((r) => server.close(() => r()));
    platform.close();
    if (!dir.startsWith(join(tmpdir(), "race-canvas-interaction-")))
      throw Error("Unexpected path");
    rmSync(dir, { recursive: true, force: true });
  }
}
test("清空来源外部映射先确认其连线影响，保存后不恢复旧映射", async ({ page }) =>
  isolated(page, async () => {
    await page.getByText("样例与已保存草稿", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "样例", exact: true })
      .selectOption("partial-pool");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "重置样例", exact: true }).click();
    await selectCard(page, "参赛来源", true);
    await page
      .getByRole("textbox", { name: "外部种子映射（可选，每行 引用:数值）" })
      .fill("");
    await finishPropertyEdit(page);
    await expect(
      page.getByRole("heading", { name: "连接影响", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "确认处理受影响连接", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "参赛来源 外部种子映射 输出",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    await page.reload();
    await selectCard(page, "参赛来源", true);
    await expect(
      page.getByRole("textbox", {
        name: "外部种子映射（可选，每行 引用:数值）",
      }),
    ).toHaveValue("");
  }));
test("轮空预览与悬空接口显隐可保存，嵌套已有连接不隐藏", async ({ page }) =>
  isolated(page, async (base) => {
    const graph = {
      schemaVersion: "canvas",
      stages: [],
      nodes: [
        {
          id: "source",
          kind: "source",
          name: "参赛来源",
          params: { seats: [{ ref: "A", label: "选手 A" }] },
          position: { x: 40, y: 40 },
        },
        ...[
          ["bye", "轮空晋级"],
          ["empty", "双方轮空"],
          ["next", "后续轮空"],
        ].map(([id, name], i) => ({
          id,
          kind: "match",
          name,
          params: { matchFormat: "bo3" },
          position: { x: 400 + i * 330, y: 40 },
        })),
      ],
      edges: [
        {
          id: "in",
          from: { node: "source", port: "seat:1" },
          to: { node: "bye", port: "A" },
        },
        {
          id: "next-in",
          from: { node: "bye", port: "W" },
          to: { node: "next", port: "A" },
        },
      ],
    };
    const r = await page.request.post(base + "/api/v1/planning-canvases", {
      headers: { Origin: base, "Idempotency-Key": "bye-fixture" },
      data: { name: "轮空测试", graph },
    });
    expect(r.ok()).toBeTruthy();
    const saved = (await r.json()).data;
    page.once("dialog", (d) => d.accept());
    await page.goto(base + "/canvas-lab?canvas=" + saved.id);
    await selectCard(page, "轮空晋级");
    await expect(
      page.getByRole("checkbox", { name: "自动添加末端胜者出口", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("checkbox", { name: "隐藏悬空输入接口", exact: true })
      .check();
    await expect(
      page.locator('[data-canvas-node="bye"] .port-input'),
    ).toHaveCount(1);
    await page
      .getByRole("checkbox", { name: "隐藏悬空输出接口", exact: true })
      .check();
    await expect(
      page.locator('[data-canvas-node="bye"] .port-output'),
    ).toHaveCount(1);
    await selectCard(page, "双方轮空");
    await page
      .getByRole("checkbox", { name: "隐藏悬空输入接口", exact: true })
      .check();
    await expect(
      page.locator('[data-canvas-node="empty"] .port-input'),
    ).toHaveCount(0);
    await page
      .getByRole("checkbox", { name: "隐藏悬空输入接口", exact: true })
      .uncheck();
    await expect(
      page.locator('[data-canvas-node="empty"] .port-input'),
    ).toHaveCount(2);
    await selectCard(page, "轮空晋级");
    await selectCard(page, "后续轮空", true);
    await page
      .getByRole("button", { name: "封装所选组件", exact: true })
      .click();
    await page
      .getByRole("button", { name: "编辑 子图 参数", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "隐藏悬空输出接口", exact: true })
      .check();
    await expect(
      page.locator('[data-node-kind="subgraph"] .port-output'),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "进入所选子图", exact: true })
      .click();
    await expect(
      page.locator('[data-canvas-node="bye"] .port-input'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-canvas-node="bye"] .port-output'),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "返回上层", exact: true }).click();
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    await page.reload();
    await expect(
      page.locator('[data-node-kind="subgraph"] .port-output'),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "验证保存版本", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("规划验证通过");
    await page.getByRole("link", { name: "打开赛程预览", exact: true }).click();
    await expect(page.locator('[data-preview-match="bye"]')).toContainText(
      "轮空晋级",
    );
    await expect(page.locator('[data-preview-match="empty"]')).toContainText(
      "双方轮空",
    );
    await expect(page.locator('[data-preview-match="next"]')).toContainText(
      "选手 A",
    );
  }));
test("无连接Match封装后默认展示全部边界，隐藏开关仅改变可见性", async ({
  page,
}) =>
  isolated(page, async () => {
    await page.getByText("样例与已保存草稿", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "样例", exact: true })
      .selectOption("empty");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "重置样例", exact: true }).click();
    await expect(page.locator("[data-canvas-node]")).toHaveCount(0);
    await page
      .locator(".canvas-palette")
      .getByRole("button", { name: "Match", exact: true })
      .click();
    await selectCard(page, "Match");
    await page
      .getByRole("button", { name: "封装所选组件", exact: true })
      .click();
    const group = page.locator('[data-node-kind="subgraph"]');
    await expect(group.locator(".port-input")).toHaveCount(2);
    await expect(group.locator(".port-output")).toHaveCount(2);
    await page
      .getByRole("button", { name: "编辑 子图 参数", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "隐藏悬空输入接口", exact: true }),
    ).not.toBeChecked();
    await page
      .getByRole("checkbox", { name: "隐藏悬空输入接口", exact: true })
      .check();
    await expect(group.locator(".port-input")).toHaveCount(0);
    await expect(group.locator(".port-output")).toHaveCount(2);
    await page
      .getByRole("checkbox", { name: "隐藏悬空输入接口", exact: true })
      .uncheck();
    await expect(group.locator(".port-input")).toHaveCount(2);
    await page
      .getByRole("checkbox", { name: "隐藏悬空输出接口", exact: true })
      .check();
    await expect(group.locator(".port-output")).toHaveCount(0);
    await expect(group.locator(".port-input")).toHaveCount(2);
  }));
test("当前草稿赛程预览筛选项目、阶段和时间，未验证项目明确排除", async ({
  page,
}) =>
  isolated(page, async (base) => {
    const sample = require("../../backend/src/planning-canvas/graph").sample(
      "swiss-eight",
    );
    const matches = sample.nodes.filter((n: any) => n.kind === "match");
    sample.stages = [
      { id: "swiss-stage", name: "瑞士轮", order: 1, nodeIds: ["swiss"] },
      {
        id: "quarter",
        name: "八强",
        order: 2,
        nodeIds: ["M1", "M2", "M3", "M4"],
      },
      { id: "final", name: "决赛", order: 3, nodeIds: ["M5", "M6", "M7"] },
    ];
    const create = async (name: string, graph: any, validate: boolean) => {
      const response = await page.request.post(
        base + "/api/v1/planning-canvases",
        {
          headers: {
            Origin: base,
            "Idempotency-Key": encodeURIComponent(name),
          },
          data: { name, graph },
        },
      );
      expect(response.ok()).toBeTruthy();
      const record = (await response.json()).data;
      if (validate) {
        const r = await page.request.post(
          base + "/api/v1/planning-canvases/" + record.id + "/validate",
          {
            headers: { Origin: base },
            data: { expectedVersion: record.version },
          },
        );
        expect((await r.json()).data.valid).toBe(true);
      }
      return record;
    };
    const a = await create("秋季赛", sample, true);
    const b = await create("邀请赛", sample, true);
    const invalid = (
      await (
        await page.request.get(base + "/api/v1/planning-canvas/samples/invalid")
      ).json()
    ).data.graph;
    await create("待验证项目", invalid, false);
    page.once("dialog", (d) => d.accept());
    await page.goto(base + "/canvas-lab?canvas=" + a.id);
    await page.getByRole("link", { name: "打开赛程预览", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "赛程预览", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-preview-match]")).toHaveCount(7);
    await expect(
      page.getByRole("heading", { name: /2026-10-14.*2 场/ }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.locator("[data-preview-match]")).toHaveCount(7);
    await expect(
      page.getByRole("heading", { name: /时间待定/ }).first(),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "阶段筛选", exact: true })
      .selectOption({ label: "八强" });
    await expect(page.locator("[data-preview-match]")).toHaveCount(4);
    await page.getByLabel("开始日期", { exact: true }).fill("2026-10-14");
    await page.getByLabel("结束日期", { exact: true }).fill("2026-10-14");
    await expect(page.locator("[data-preview-match]")).toHaveCount(0);
    await page.getByLabel("开始日期", { exact: true }).fill("");
    await page.getByLabel("结束日期", { exact: true }).fill("");
    await page
      .getByRole("searchbox", { name: "比赛搜索", exact: true })
      .fill("M1");
    await expect(page.locator("[data-preview-match]")).toHaveCount(1);
    await page.getByRole("button", { name: "重置筛选", exact: true }).click();
    await page
      .getByRole("combobox", { name: "赛事项目", exact: true })
      .selectOption("all");
    await expect(page.locator("[data-preview-match]")).toHaveCount(14);
    await expect(page.locator(".schedule-excluded")).toContainText(
      "待验证项目",
    );
    await page
      .getByRole("combobox", { name: "赛事项目", exact: true })
      .selectOption(b.id);
    await expect(page.locator("[data-preview-match]")).toHaveCount(7);
    await expect(page.locator(".schedule-match-event").first()).toContainText(
      "邀请赛",
    );
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
      ).toBe(false);
      await page.screenshot({
        path: resolve("../output/playwright/canvas-schedule-" + width + ".png"),
        fullPage: true,
      });
    }
    await page.getByRole("link", { name: "返回画布", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("邀请赛");
  }));
test("分类组件、无箭头连线、参数入口与子图快捷键", async ({ page }) =>
  isolated(page, async () => {
    for (const name of ["基础", "转换", "淘汰赛", "瑞士轮", "排序"])
      await expect(
        page
          .locator(".canvas-component-category summary")
          .getByText(name, { exact: true }),
      ).toBeVisible();
    await expect(page.locator(".canvas-edges marker")).toHaveCount(0);
    await expect(page.locator("[data-canvas-edge][marker-end]")).toHaveCount(0);
    await page
      .getByRole("button", { name: "编辑 M1 参数", exact: true })
      .click();
    const panel = page.getByRole("complementary", { name: "卡片参数面板" });
    await expect(
      panel.getByRole("combobox", { name: "单场赛制", exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("combobox", { name: "单场赛制", exact: true })
      .selectOption("bo1");
    await panel
      .getByRole("combobox", { name: "单场赛制", exact: true })
      .press("Control+g");
    await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(0);
    await finishPropertyEdit(page);
    await expect(page.locator('[data-canvas-node="M1"]')).toContainText("BO1");
    await selectCard(page, "M2", true);
    await page.keyboard.press("Control+g");
    await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(1);
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(page.locator('[data-canvas-node="M1"]')).toContainText("BO1");
    await page.getByRole("button", { name: "随机排序", exact: true }).click();
    await expect(page.locator('[data-node-kind="generator"]')).toContainText(
      "随机",
    );
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    await page.reload();
    await expect(page.locator('[data-canvas-node="M1"]')).toContainText("BO1");
  }));
test("工作区双输出、清空撤销、项目切换与末端胜者", async ({ page }) =>
  isolated(page, async (base) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const source = page.locator('[data-canvas-node="source"]');
    await expect(
      source.getByRole("button", {
        name: "参赛来源 初始席位集合 输出",
        exact: true,
      }),
    ).toBeAttached();
    await expect(
      source.getByRole("button", {
        name: "参赛来源 初始种子 输出",
        exact: true,
      }),
    ).toBeAttached();
    await expect(source.locator("[data-anchor]")).toHaveCount(2);
    const viewport = await page.locator(".canvas-viewport").boundingBox();
    expect(viewport!.width).toBeGreaterThan(850);
    expect(viewport!.height).toBeGreaterThan(500);
    await expect(
      page.locator(".canvas-inspector .canvas-connection-form"),
    ).toHaveCount(0);
    await expect(
      page.locator(".canvas-center .canvas-connection-form"),
    ).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "草稿名称", exact: true })
      .fill("项目 A");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    const a = new URL(page.url()).searchParams.get("canvas")!;
    for (const id of ["M1", "M2", "M3", "M4", "M5", "M6", "M7"])
      await selectCard(page, id, true);
    await page
      .getByRole("button", { name: "封装所选组件", exact: true })
      .click();
    const group = page.locator('[data-node-kind="subgraph"]');
    await expect(
      group.getByRole("button", { name: /M7 W · 胜者 输出/ }),
    ).toBeAttached();
    await expect(group.locator(".port-output")).toHaveCount(8);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    const legacy = (
      await (
        await page.request.get(base + "/api/v1/planning-canvases/" + a)
      ).json()
    ).data;
    legacy.graph.nodes.find(
      (n: any) => n.kind === "subgraph",
    ).params.boundaries = legacy.graph.nodes
      .find((n: any) => n.kind === "subgraph")
      .params.boundaries.filter((b: any) => b.direction !== "output");
    expect(
      (
        await page.request.put(base + "/api/v1/planning-canvases/" + a, {
          headers: { Origin: base, "Idempotency-Key": "legacy-winner-fixture" },
          data: {
            name: legacy.name,
            graph: legacy.graph,
            expectedVersion: legacy.version,
          },
        })
      ).ok(),
    ).toBeTruthy();
    await page.reload();
    await page
      .getByRole("button", { name: "编辑 子图 参数", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "隐藏悬空输出接口", exact: true }),
    ).not.toBeChecked();
    await expect(
      page.locator('[data-node-kind="subgraph"] .port-output'),
    ).toHaveCount(8);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    await page.getByRole("button", { name: "新建项目", exact: true }).click();
    await expect(page.locator("[data-canvas-node]")).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "草稿名称", exact: true })
      .fill("项目 B");
    await page
      .locator(".canvas-palette")
      .getByRole("button", { name: "参赛来源", exact: true })
      .click();
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    const b = new URL(page.url()).searchParams.get("canvas")!;
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "清空画布", exact: true }).click();
    await expect(page.locator("[data-canvas-node]")).toHaveCount(1);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "清空画布", exact: true }).click();
    await expect(page.locator("[data-canvas-node]")).toHaveCount(0);
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(page.locator("[data-canvas-node]")).toHaveCount(1);
    await page
      .getByRole("textbox", { name: "草稿名称", exact: true })
      .fill("项目 B 修改");
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(a);
    await page.getByRole("button", { name: "取消切换", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("canvas")).toBe(b);
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(a);
    await page.getByRole("button", { name: "保存后切换", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("项目 A");
    await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(1);
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(b);
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("项目 B 修改");
    await expect(page.locator("[data-canvas-node]")).toHaveCount(1);
    expect(
      (
        await (
          await page.request.get(base + "/api/v1/planning-canvases/" + a)
        ).json()
      ).data.name,
    ).toBe("项目 A");
    await page
      .getByRole("textbox", { name: "草稿名称", exact: true })
      .fill("舍弃的名称");
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(a);
    await page
      .getByRole("button", { name: "舍弃修改并切换", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("项目 A");
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(b);
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("项目 B 修改");
    await page.screenshot({
      path: resolve("../output/playwright/canvas-workspace-1440.png"),
      fullPage: true,
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "清空画布", exact: true }).click();
    await expect(page.locator("[data-canvas-node]")).toHaveCount(0);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    expect(new URL(page.url()).searchParams.get("canvas")).toBe(b);
    await page.reload();
    await expect(page.locator("[data-canvas-node]")).toHaveCount(0);
  }));
for (const width of [360, 768, 1440])
  test(`独立画布 ${width} 保存验证预览与封装`, async ({ page }) => {
    const dir = mkdtempSync(join(tmpdir(), "race-canvas-e2e-")),
      origins: string[] = [];
    const platform = createApp({
      databasePath: join(dir, "isolated.sqlite"),
      frontendPath: resolve("dist"),
      origins,
    });
    let server: any;
    try {
      server = await listenTestServer(platform.app);
      const base = "http://127.0.0.1:" + server.address().port;
      origins.push(base);
      await page.setViewportSize({ width, height: 900 });
      for (const action of ["register", "login"]) {
        const r = await page.request.post(base + "/api/v1/auth/" + action, {
          headers: { Origin: base },
          data: {
            username: "canvas_owner",
            password: "test-canvas",
            ...(action === "register" ? { displayName: "画布测试" } : {}),
          },
        });
        expect(r.ok()).toBeTruthy();
      }
      await page.goto(base + "/canvas-lab");
      await expect(
        page.getByRole("heading", { name: "赛程规划画布" }),
      ).toBeVisible();
      await expect(page.locator('[data-canvas-node="M1"]')).toBeAttached();
      await page.getByRole("button", { name: "保存草稿", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("草稿已保存");
      await page
        .getByRole("button", { name: "验证保存版本", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("规划验证通过");
      await page
        .getByRole("button", { name: "生成赛程预览", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "赛程预览" }),
      ).toBeVisible();
      await expect(page.locator("[data-preview-match]")).toHaveCount(7);
      await expect(page.locator('[data-preview-match="M1"]')).toContainText(
        "最终第 1 名",
      );
      const url = page.url();
      await page.reload();
      await expect(page.locator('[data-canvas-node="M7"]')).toBeAttached();
      await page.getByRole("button", { name: "适应全图", exact: true }).click();
      const record = (
        await (
          await page.request.get(
            base +
              "/api/v1/planning-canvases/" +
              new URL(url).searchParams.get("canvas"),
          )
        ).json()
      ).data;
      const anchorError = await page.evaluate((edge: any) => {
        const path = Array.from(
          document.querySelectorAll<SVGPathElement>("[data-canvas-edge]"),
        ).find((p) => p.dataset.canvasEdge === edge.id)!;
        const ends = [
          path.getPointAtLength(0),
          path.getPointAtLength(path.getTotalLength()),
        ];
        return Math.max(
          ...["from", "to"].map((side, i) => {
            const button = Array.from(
                document.querySelectorAll<HTMLElement>("[data-anchor]"),
              ).find(
                (p) =>
                  p.dataset.anchor ===
                  JSON.stringify({
                    ...edge[side],
                    direction: side === "from" ? "output" : "input",
                  }),
              )!,
              rect = button.querySelector(".port-dot")!.getBoundingClientRect(),
              point = new DOMPoint(ends[i].x, ends[i].y).matrixTransform(
                path.getScreenCTM()!,
              );
            return Math.hypot(
              point.x - rect.left - rect.width / 2,
              point.y - rect.top - rect.height / 2,
            );
          }),
        );
      }, record.graph.edges[0]);
      expect(anchorError).toBeLessThan(1);
      const misplacedPorts = await page.locator("[data-anchor]").evaluateAll(
        (buttons) =>
          buttons.filter((button) => {
            const port = JSON.parse((button as HTMLElement).dataset.anchor!),
              node = button
                .closest("[data-canvas-node]")!
                .getBoundingClientRect(),
              row = button.getBoundingClientRect(),
              dot = button.querySelector(".port-dot")!.getBoundingClientRect(),
              x = dot.left + dot.width / 2,
              y = dot.top + dot.height / 2;
            return (
              (port.direction === "input" ? x >= node.left : x <= node.right) ||
              Math.abs(y - row.top - row.height / 2) > 1
            );
          }).length,
      );
      expect(misplacedPorts).toBe(0);
      const clipped = await page
        .locator("[data-canvas-node]")
        .evaluateAll((nodes) =>
          nodes.some((n) => n.scrollHeight > n.clientHeight + 2),
        );
      expect(clipped).toBe(false);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      expect(overflow).toBe(false);
      await selectCard(page, "M1", true);
      await selectCard(page, "M2", true);
      await page
        .getByRole("button", { name: "封装所选组件", exact: true })
        .click();
      await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(1);
      await page.getByRole("button", { name: "撤销", exact: true }).click();
      await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(0);
      await page.getByRole("button", { name: "重做", exact: true }).click();
      await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(1);
      await page.getByRole("button", { name: "保存草稿", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("草稿已保存");
      await page.reload();
      await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(1);
      expect(page.url().split("?")[0]).toBe(url.split("?")[0]);
      await page.screenshot({
        path: resolve("../output/playwright/canvas-lab-" + width + ".png"),
        fullPage: true,
      });
      expect(
        platform.db.prepare("SELECT count(*) n FROM tournaments").get().n,
      ).toBe(0);
    } finally {
      if (server?.listening)
        await new Promise<void>((r) => server.close(() => r()));
      platform.close();
      if (!dir.startsWith(join(tmpdir(), "race-canvas-e2e-")))
        throw Error("Unexpected path");
      rmSync(dir, { recursive: true, force: true });
    }
  });
test("属性表单在保存请求进行中不可编辑", async ({ page }) =>
  isolated(page, async () => {
    await selectCard(page, "M1", true);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(
      "**/api/v1/planning-canvases",
      async (route) => {
        if (route.request().method() === "POST") await gate;
        await route.continue();
      },
      { times: 1 },
    );
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    try {
      await expect(
        page.getByRole("textbox", { name: "名称", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("combobox", { name: "单场赛制", exact: true }),
      ).toBeDisabled();
    } finally {
      release();
    }
    await expect(page.getByRole("status")).toContainText("草稿已保存");
  }));
test("同路径查询参数切换重新读取对应草稿", async ({ page }) =>
  isolated(page, async (base) => {
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    const id = new URL(page.url()).searchParams.get("canvas")!,
      a = (
        await (
          await page.request.get(base + "/api/v1/planning-canvases/" + id)
        ).json()
      ).data;
    const b = (
      await (
        await page.request.post(base + "/api/v1/planning-canvases", {
          headers: { Origin: base, "Idempotency-Key": "create-other" },
          data: { name: "草稿 B", graph: a.graph },
        })
      ).json()
    ).data;
    await page.evaluate((id: string) => {
      history.pushState(
        { ...history.state, idx: (history.state?.idx ?? 0) + 1, key: "other" },
        "",
        "?canvas=" + id,
      );
      dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    }, b.id);
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("草稿 B");
  }));
test("画布 Pool 部分排序与无输入生成器位置模板在真实表单中可应用", async ({
  page,
}) =>
  isolated(page, async () => {
    await page.getByText("样例与已保存草稿", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "样例", exact: true })
      .selectOption("partial-pool");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "重置样例", exact: true }).click();
    await expect(page.locator('[data-canvas-node="pool"]')).toBeAttached();
    await page.getByRole("button", {name:"分析草稿",exact:true}).click();
    await expect(page.getByLabel("草稿分析状态")).toHaveText("分析结果已更新");
    await page.getByText("集合与种子结果", { exact: true }).click();
    await expect(
      page.locator(".canvas-inspector details ol").last().locator("li"),
    ).toHaveText([
      "A · 当前种子 1",
      "D · 当前种子 2",
      "C · 当前种子 3",
      "B · 当前种子 4",
      "E · 当前种子 5",
    ]);
    await page.getByRole("button", { name: "随机排序", exact: true }).click();
    await selectCard(page, "随机排序", true);
    await page
      .getByRole("combobox", { name: "模式", exact: true })
      .selectOption("reverse");
    await page
      .getByRole("spinbutton", { name: "数量 N", exact: true })
      .fill("5");
    await finishPropertyEdit(page);
    await expect(page.getByRole("status")).toContainText("画布已更新");
    await page.getByRole("button", { name: "适应全图", exact: true }).click();
    await page
      .getByRole("button", { name: "随机排序 位置排序模板 输出", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Pool 排序 输入", exact: true })
      .click();
    await page.getByRole("button", {name:"分析草稿",exact:true}).click();
    await expect(page.getByLabel("草稿分析状态")).toHaveText("分析结果已更新");
    await expect(
      page.locator(".canvas-inspector details ol").last().locator("li"),
    ).toHaveText([
      "E · 当前种子 1",
      "D · 当前种子 2",
      "C · 当前种子 3",
      "B · 当前种子 4",
      "A · 当前种子 5",
    ]);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    await page.reload();
    await expect(page.locator('[data-node-kind="generator"]')).toHaveCount(1);
  }));
test("预设子图能显式连接集合、转自定义、进入编辑并返回", async ({ page }) =>
  isolated(page, async () => {
    await page.getByText("样例与已保存草稿", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "样例", exact: true })
      .selectOption("empty");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "重置样例", exact: true }).click();
    await page
      .locator(".canvas-palette")
      .getByRole("button", { name: "参赛来源", exact: true })
      .click();
    await selectCard(page, "参赛来源", true);
    await page
      .getByRole("textbox", { name: "未来席位（每行 引用 | 名称）" })
      .fill(
        Array.from(
          { length: 8 },
          (_, i) => "S" + (i + 1) + " | 来源 " + (i + 1),
        ).join("\n"),
      );
    await finishPropertyEdit(page);
    await page
      .getByRole("button", { name: "添加单败子图", exact: true })
      .click();
    await page.getByRole("button", { name: "适应全图", exact: true }).click();
    await page
      .getByRole("button", { name: "参赛来源 初始席位集合 输出", exact: true })
      .click();
    await page
      .getByRole("button", { name: "八人单败 参赛集合 输入", exact: true })
      .click();
    await selectCard(page, "八人单败", true);
    await page.getByRole("button", { name: "转为自定义", exact: true }).click();
    await page
      .getByRole("button", { name: "进入所选子图", exact: true })
      .click();
    await selectCard(page, /^M1 /, true);
    await page
      .getByRole("combobox", { name: "单场赛制", exact: true })
      .selectOption("bo1");
    await finishPropertyEdit(page);
    await expect(page.getByRole("status")).toContainText("画布已更新");
    await page.getByRole("button", { name: "返回上层", exact: true }).click();
    await selectCard(page, "八人单败");
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.locator("[data-stage-id]")).toHaveCount(1);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    await page
      .getByRole("button", { name: "验证保存版本", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("规划验证通过");
    await page
      .getByRole("button", { name: "生成赛程预览", exact: true })
      .click();
    await expect(page.locator("[data-preview-match]")).toHaveCount(7);
    await expect(page.locator("[data-preview-match]").first()).toContainText(
      "BO1",
    );
  }));
test("选择器缩容影响可取消，展开器数量只读且随集合推导", async ({ page }) =>
  isolated(page, async () => {
    await selectCard(page, "取前 K 名", true);
    await page.getByRole("spinbutton", { name: "数量 K" }).fill("4");
    await finishPropertyEdit(page);
    await expect(
      page.getByRole("heading", { name: "连接影响", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('[aria-label="连接影响确认"]').locator("li"),
    ).toHaveCount(4);
    await page.getByRole("button", { name: "取消变更", exact: true }).click();
    await expect(page.locator('[data-canvas-node="expand"]')).toContainText(
      "8 个席位",
    );
    await page.getByRole("spinbutton", { name: "数量 K" }).fill("4");
    await finishPropertyEdit(page);
    await page
      .getByRole("button", { name: "确认处理受影响连接", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("画布已更新");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    await page
      .getByRole("button", { name: "验证保存版本", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("规划验证通过");
    await expect(
      page.getByRole("button", { name: "生成赛程预览", exact: true }),
    ).toBeEnabled();
  }));
test("画布保存响应丢失保留原键，409 保留本地并显式采用最新版本再保存", async ({
  page,
}) =>
  isolated(page, async (base, platform) => {
    await page.route(
      "**/api/v1/planning-canvases",
      async (route) => {
        if (route.request().method() === "POST") {
          await route.fetch();
          await route.abort("failed");
        } else await route.continue();
      },
      { times: 1 },
    );
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "使用原请求重试保存" }),
    ).toBeVisible();
    expect(
      platform.db.prepare("SELECT count(*) n FROM planning_canvases").get().n,
    ).toBe(1);
    await page.getByRole("button", { name: "使用原请求重试保存" }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    expect(
      platform.db.prepare("SELECT count(*) n FROM planning_canvases").get().n,
    ).toBe(1);
    const id = new URL(page.url()).searchParams.get("canvas")!,
      stored = (
        await (
          await page.request.get(base + "/api/v1/planning-canvases/" + id)
        ).json()
      ).data;
    expect(
      (
        await page.request.put(base + "/api/v1/planning-canvases/" + id, {
          headers: { Origin: base, "Idempotency-Key": "external" },
          data: { expectedVersion: 1, graph: stored.graph, name: "外部版本" },
        })
      ).ok(),
    ).toBeTruthy();
    await page
      .getByRole("textbox", { name: "草稿名称", exact: true })
      .fill("本地保留");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("保存版本已变化");
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("本地保留");
    await page.getByText("样例与已保存草稿", { exact: true }).click();
    await page
      .getByRole("button", { name: "读取保存版本", exact: true })
      .click();
    await page
      .getByRole("button", { name: "保留本地并采用最新版本号", exact: true })
      .click();
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("版本 3");
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "草稿名称", exact: true }),
    ).toHaveValue("本地保留");
  }));
