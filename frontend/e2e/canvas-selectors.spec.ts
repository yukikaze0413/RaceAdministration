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
const S = require("../../backend/src/planning-canvas/samples");

test("两个选择器的补集、只读展开数量与关闭连线确认", async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), "race-selector-current-")),
    origins: string[] = [];
  const platform = createApp({
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
              username: "selector_current",
              password: "test",
              ...(action === "register" ? { displayName: "选择器测试" } : {}),
            },
          })
        ).ok(),
      ).toBeTruthy();
    const graph = {
      schemaVersion: "canvas-v2",
      stages: [],
      nodes: [
        S.node("source", "source", {
          seats: Array.from({ length: 5 }, (_, i) => ({
            ref: "P" + i,
            label: "P" + i,
          })),
        }),
        S.node("selector-top", "top", { count: 2 }, { x: 360, y: 40 }),
        S.node("selector-random", "random", { count: 2 }, { x: 360, y: 400 }),
        {
          ...S.node("expander", "top-expand", {}, { x: 700, y: 40 }),
          name: "前K补集展开",
        },
        {
          ...S.node("expander", "random-expand", {}, { x: 700, y: 400 }),
          name: "随机补集展开",
        },
      ],
      edges: [
        {
          id: "top-in",
          from: { node: "source", port: "collection" },
          to: { node: "top", port: "collection" },
        },
        {
          id: "random-in",
          from: { node: "source", port: "collection" },
          to: { node: "random", port: "collection" },
        },
      ],
    };
    const created = (
      await (
        await page.request.post(base + "/api/v1/planning-canvases", {
          headers: { Origin: base, "Idempotency-Key": "selectors-create" },
          data: { name: "选择器", graph },
        })
      ).json()
    ).data;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + "/canvas-lab?canvas=" + created.id);
    const inspect = async (name: string) => {
      await page.getByRole("button", { name: "适应全图", exact: true }).click();
      await page
        .getByRole("button", { name: "编辑 " + name + " 参数", exact: true })
        .click();
    };
    const form = page.locator(".canvas-properties");
    for (const [name, expander] of [
      ["取前 K 名", "前K补集展开"],
      ["随机 K 名", "随机补集展开"],
    ]) {
      await inspect(name);
      await expect(form.getByLabel("数量 K", { exact: true })).toHaveValue("2");
      await expect(form.getByLabel("模式", { exact: true })).toHaveCount(0);
      await form.getByLabel("展示补集", { exact: true }).check();
      await expect(page.locator(".canvas-lab")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await page
        .getByRole("button", { name: name + " 补集 输出", exact: true })
        .click();
      await page
        .getByRole("button", { name: expander + " 席位集合 输入", exact: true })
        .click();
      await inspect(expander);
      await expect(form.getByLabel("展开数量", { exact: true })).toHaveText(
        "展开数量：3",
      );
      await expect(form.getByRole("spinbutton")).toHaveCount(0);
      await expect(form.getByLabel("状态", { exact: true })).toContainText(
        "跟随输入集合",
      );
    }
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    await page.reload();
    await inspect("前K补集展开");
    await expect(form.getByLabel("展开数量", { exact: true })).toContainText(
      "3",
    );
    await inspect("取前 K 名");
    await form.getByLabel("展示补集", { exact: true }).uncheck();
    await expect(
      page.getByRole("heading", { name: "连接影响", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "取消变更", exact: true }).click();
    await expect(form.getByLabel("展示补集", { exact: true })).toBeChecked();
    await form.getByLabel("展示补集", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "确认处理受影响连接", exact: true })
      .click();
    await inspect("前K补集展开");
    await expect(form.getByLabel("展开数量", { exact: true })).toContainText(
      "待解析",
    );
    await expect(form.getByLabel("状态", { exact: true })).toContainText(
      "等待集合输入",
    );
    await page.screenshot({
      path: resolve("../output/playwright/canvas-selectors-1440.png"),
      fullPage: true,
    });
  } finally {
    if (server?.listening)
      await new Promise<void>((done) => server.close(done));
    platform.close();
    if (!dir.startsWith(join(tmpdir(), "race-selector-current-")))
      throw Error("Unexpected path");
    rmSync(dir, { recursive: true, force: true });
  }
});
