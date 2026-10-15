import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
const {
  listenTestServer,
} = require("../../backend/test/helpers/http-listener");

test("瑞士轮属性按需覆盖，保存与撤销保留内部属性", async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), "race-canvas-properties-"));
  const origins: string[] = [];
  const platform = createApp({
    databasePath: join(dir, "lab.sqlite"),
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
            username: "canvas_properties",
            password: "canvas-test",
            ...(action === "register" ? { displayName: "属性测试" } : {}),
          },
        },
      );
      expect(response.ok()).toBeTruthy();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const sampleResponse = await page.request.get(
      base + "/api/v1/planning-canvas/samples/swiss-eight",
    );
    const graph = (await sampleResponse.json()).data.graph;
    const swiss = graph.nodes.find((node: any) => node.kind === "swiss");
    swiss.params.parameters.overrides = { rounds: { "2": 3 } };
    const created = await page.request.post(
      base + "/api/v1/planning-canvases",
      {
        headers: { Origin: base, "Idempotency-Key": "swiss-properties" },
        data: { name: "瑞士轮属性测试", graph },
      },
    );
    expect(created.ok()).toBeTruthy();
    const record = (await created.json()).data;
    await page.goto(base + "/canvas-lab?canvas=" + record.id);
    const selectSwiss = async (name: string) => {
      await expect(page.locator('[data-canvas-node="swiss"]')).toBeAttached();
      await page.getByRole("button", { name: "适应全图", exact: true }).click();
      await page
        .getByRole("button", { name: "编辑 " + name + " 参数", exact: true })
        .click();
    };
    await selectSwiss("瑞士轮");
    const form = page.locator(".canvas-properties");
    await expect(form.getByLabel("轮数", { exact: true })).toHaveValue("5");
    await expect(form.getByRole("list", { name: "同分顺序", hidden: true })).toBeHidden();
    await expect(form.locator("select[aria-label^='第 ']")).toHaveCount(1);
    await form.getByText("高级规则", { exact: true }).click();
    await form.getByText("逐轮覆盖", { exact: true }).click();
    await form.getByLabel("覆盖轮次", { exact: true }).selectOption("4");
    await form
      .getByRole("button", { name: "添加轮次覆盖", exact: true })
      .click();
    await form.getByLabel("第 4 轮 BO", { exact: true }).selectOption("5");
    await form
      .getByRole("button", { name: "移除第 2 轮覆盖", exact: true })
      .click();
    await expect(
      form.getByRole("button", { name: "应用属性", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".canvas-lab")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(form.getByLabel("第 2 轮 BO", { exact: true })).toHaveValue(
      "3",
    );
    await expect(form.getByLabel("第 4 轮 BO", { exact: true })).toHaveValue(
      "5",
    );
    await page.getByRole("button", { name: "重做", exact: true }).click();
    await expect(form.getByLabel("第 4 轮 BO", { exact: true })).toHaveValue(
      "5",
    );
    await form.getByLabel("轮数", { exact: true }).fill("6");
    await form.getByLabel("名称", { exact: true }).fill("晋级瑞士轮");
    await expect(page.locator(".canvas-lab")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.getByRole("status")).toContainText("画布已更新");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    const saved = (
      await (
        await page.request.get(base + "/api/v1/planning-canvases/" + record.id)
      ).json()
    ).data;
    const stored = saved.graph.nodes.find((node: any) => node.id === swiss.id);
    expect(stored.position).toEqual(swiss.position);
    expect(stored.parentId).toEqual(swiss.parentId);
    expect(stored.params.ranking).toBe("complete-v1");
    expect(stored.params).not.toHaveProperty("release");
    expect(stored.params.parameters.overrides.rounds).toEqual({ "4": 5 });
    await page.reload();
    await selectSwiss("晋级瑞士轮");
    await expect(form.getByLabel("轮数", { exact: true })).toHaveValue("6");
    for (const width of [1440, 768, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "参数", exact: true }).click();
      await expect(form.getByLabel("名称", { exact: true })).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
      ).toBe(false);
      await page.screenshot({
        path: resolve(
          "../output/playwright/canvas-component-properties-" + width + ".png",
        ),
        fullPage: true,
      });
    }
  } finally {
    if (server?.listening)
      await new Promise<void>((done) => server.close(done));
    platform.close();
    if (!dir.startsWith(join(tmpdir(), "race-canvas-properties-")))
      throw Error("Unexpected path");
    rmSync(dir, { recursive: true, force: true });
  }
});
