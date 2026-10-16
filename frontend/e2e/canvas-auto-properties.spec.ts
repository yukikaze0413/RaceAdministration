import { test, expect } from "./canvas-fixture";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
const {
  listenTestServer,
} = require("../../backend/test/helpers/http-listener");

test("Match 连续编辑自动生效，项目下拉直接切换并保留保存提醒", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "race-canvas-auto-"));
  const origins: string[] = [];
  const platform = createApp({
    databasePath: join(dir, "canvas.sqlite"),
    frontendPath: resolve("dist"),
    origins,
  });
  let server: any;
  try {
    server = await listenTestServer(platform.app);
    const base = "http://127.0.0.1:" + server.address().port;
    origins.push(base);
    for (const action of ["register", "login"]) {
      const response = await page.request.post(
        base + "/api/v1/auth/" + action,
        {
          headers: { Origin: base },
          data: {
            username: "auto_properties",
            password: "canvas-test",
            ...(action === "register" ? { displayName: "属性测试" } : {}),
          },
        },
      );
      expect(response.ok()).toBeTruthy();
    }
    const graph = (
      await (
        await page.request.get(base + "/api/v1/planning-canvas/samples/single")
      ).json()
    ).data.graph;
    const create = async (name: string) => {
      const response = await page.request.post(
        base + "/api/v1/planning-canvases",
        {
          headers: { Origin: base, "Idempotency-Key": name },
          data: { name, graph },
        },
      );
      expect(response.ok()).toBeTruthy();
      return (await response.json()).data;
    };
    const a = await create("A"),
      b = await create("B");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + "/canvas-lab?canvas=" + a.id);
    await expect(
      page
        .locator(".canvas-component-category")
        .filter({
          has: page.locator("summary").getByText("淘汰赛", { exact: true }),
        })
        .getByRole("button", { name: "Match", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^编辑 M1.*参数$/ }).click();
    const editRequests: string[] = [];
    await page.route("**/api/v1/planning-canvas/edit", async (route) => {
      editRequests.push(route.request().url());
      await route.abort();
    });
    const form = page.locator(".canvas-properties");
    const name = form.getByLabel("名称", { exact: true });
    await name.fill("");
    await name.pressSequentially("连续输入Match", { delay: 5 });
    await expect(name).toBeEnabled();
    await expect(name).toHaveValue("连续输入Match");
    expect(editRequests).toEqual([]);
    await form.getByLabel("单场赛制", { exact: true }).selectOption("bo1");
    await expect(form.getByText("赛果列表", { exact: true })).toHaveCount(0);
    await expect(form.getByLabel("平", { exact: true })).toHaveCount(0);
    await expect(form.getByLabel("双败", { exact: true })).toHaveCount(0);
    await expect(form.getByLabel("预计开始时间", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      form.getByRole("button", { name: "应用属性", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    const read = async (id: string) =>
      (
        await (
          await page.request.get(base + "/api/v1/planning-canvases/" + id)
        ).json()
      ).data;
    const stored = (await read(a.id)).graph.nodes.find(
      (node: any) => node.id === "M1",
    );
    expect(stored.name).toBe("连续输入Match");
    expect(stored.params.matchFormat).toBe("bo1");
    expect(stored.params.bestOf).toBeUndefined();
    expect(stored.params.allowedResults).toBeUndefined();
    expect(stored.params.winnerRule).toBeUndefined();
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(b.id);
    await expect(page.getByLabel("草稿名称", { exact: true })).toHaveValue("B");
    await expect(
      page.getByRole("button", { name: "切换项目", exact: true }),
    ).toHaveCount(0);
    const stage = graph.stages[0];
    await page.locator('[data-stage-id="' + stage.id + '"] button').click();
    await page.getByLabel("阶段名称", { exact: true }).fill("自动阶段");
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(a.id);
    await expect(
      page.getByRole("dialog", { name: "切换项目确认" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "取消切换", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "项目草稿", exact: true }),
    ).toHaveValue(b.id);
    await expect(page.getByLabel("阶段名称", { exact: true })).toHaveValue(
      "自动阶段",
    );
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(a.id);
    await page.getByRole("button", { name: "保存后切换", exact: true }).click();
    await expect(page.getByLabel("草稿名称", { exact: true })).toHaveValue("A");
    expect(
      (await read(b.id)).graph.stages.find((item: any) => item.id === stage.id)
        .name,
    ).toBe("自动阶段");
    await page
      .getByRole("button", { name: "编辑 连续输入Match 参数", exact: true })
      .click();
    await name.fill("舍弃的改名");
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(b.id);
    await page
      .getByRole("button", { name: "舍弃修改并切换", exact: true })
      .click();
    await expect(page.getByLabel("草稿名称", { exact: true })).toHaveValue("B");
    await page
      .getByRole("combobox", { name: "项目草稿", exact: true })
      .selectOption(a.id);
    await page
      .getByRole("button", { name: "编辑 连续输入Match 参数", exact: true })
      .click();
    await expect(name).toHaveValue("连续输入Match");
    await expect(form.getByLabel("单场赛制", { exact: true })).toHaveValue(
      "bo1",
    );
    await expect(form.getByLabel("平", { exact: true })).toHaveCount(0);
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "参数", exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
      ).toBe(false);
      await page.screenshot({
        path: resolve(
          "../output/playwright/canvas-match-auto-" + width + ".png",
        ),
        fullPage: true,
      });
    }
  } finally {
    if (server?.listening)
      await new Promise<void>((done) => server.close(done));
    platform.close();
    if (!dir.startsWith(join(tmpdir(), "race-canvas-auto-")))
      throw Error("Unexpected path");
    rmSync(dir, { recursive: true, force: true });
  }
});
