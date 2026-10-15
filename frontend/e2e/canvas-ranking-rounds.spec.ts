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

test("循环赛整轮编辑、撤销、保存、预览及 session 筛选", async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), "race-ranking-rounds-"));
  const origins: string[] = [];
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
    for (const action of ["register", "login"]) {
      expect(
        (
          await page.request.post(base + "/api/v1/auth/" + action, {
            headers: { Origin: base },
            data: {
              username: "ranking_rounds",
              password: "test",
              ...(action === "register" ? { displayName: "轮次测试" } : {}),
            },
          })
        ).ok(),
      ).toBeTruthy();
    }
    const sample = (
      await (
        await page.request.get(
          base + "/api/v1/planning-canvas/samples/round-robin",
        )
      ).json()
    ).data;
    const created = (
      await (
        await page.request.post(base + "/api/v1/planning-canvases", {
          headers: { Origin: base, "Idempotency-Key": "create-ranking" },
          data: { name: "A组", graph: sample.graph },
        })
      ).json()
    ).data;
    await page.goto(base + "/canvas-lab?canvas=" + created.id);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("button", { name: "编辑 小组循环赛 参数", exact: true })
      .click();
    const form = page.locator(".canvas-properties");
    await expect(form.getByText("循环轮数：3", { exact: true })).toBeVisible();
    await form
      .getByLabel("循环方式", { exact: true })
      .selectOption("double-round-robin-v2");
    await expect(form.getByText("循环轮数：6", { exact: true })).toBeVisible();
    await expect(page.locator(".canvas-lab")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(form.getByLabel("循环方式", { exact: true })).toHaveValue(
      "round-robin-v2",
    );
    await page.getByRole("button", { name: "重做", exact: true }).click();
    await expect(form.getByLabel("循环方式", { exact: true })).toHaveValue(
      "double-round-robin-v2",
    );
    for (const width of [1440, 768, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "参数", exact: true }).click();
      await expect(
        form.getByLabel("循环方式", { exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
      ).toBe(false);
      await page.screenshot({
        path: resolve("../output/playwright/canvas-ranking-" + width + ".png"),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    const path = base + "/api/v1/planning-canvases/" + created.id;
    const saved = (await (await page.request.get(path)).json()).data;
    const validation = (
      await (
        await page.request.post(path + "/validate", {
          headers: { Origin: base },
          data: { expectedVersion: saved.version },
        })
      ).json()
    ).data;
    expect(validation.valid).toBe(true);
    expect(validation.wavePlan.rounds).toHaveLength(6);
    expect(
      validation.wavePlan.waves.every(
        (w: any) => w.matchIds.length === 0 && w.roundIds.length === 1,
      ),
    ).toBe(true);
    const session = {
      id: "morning",
      name: "上午",
      waveIds: validation.wavePlan.waves.map((w: any) => w.id),
      timeRange: {
        startAt: "2026-10-16T09:00:00+08:00",
        endAt: "2026-10-16T12:00:00+08:00",
      },
    };
    expect(
      (
        await page.request.put(path + "/schedule", {
          headers: { Origin: base, "Idempotency-Key": "ranking-schedule" },
          data: {
            expectedVersion: saved.version,
            expectedScheduleVersion: 0,
            wavePlanDigest: validation.wavePlanDigest,
            sessions: [session],
          },
        })
      ).ok(),
    ).toBeTruthy();
    await page.goto(base + "/canvas-lab/preview?canvas=" + created.id);
    await page.getByText("赛制轮次（6）", { exact: true }).click();
    await expect(page.locator(".schedule-round")).toHaveCount(6);
    await expect(page.locator(".schedule-round").first()).toContainText("上午");
    await expect(page.locator(".schedule-round li")).toHaveCount(12);
    await page
      .getByLabel("Wave 筛选", { exact: true })
      .selectOption(created.id + "/" + validation.wavePlan.waves[0].id);
    await expect(page.locator(".schedule-round")).toHaveCount(1);
    await page.getByLabel("Wave 筛选", { exact: true }).selectOption("");
    await page.getByLabel("开始日期", { exact: true }).fill("2026-10-17");
    await expect(page.locator(".schedule-round")).toHaveCount(0);
    await page.getByLabel("开始日期", { exact: true }).fill("");
    await page.reload();
    await expect(
      page.getByText("赛制轮次（6）", { exact: true }),
    ).toBeVisible();
    // Rule changes retain the old schedule snapshot and require explicit rebinding.
    saved.graph.nodes.find(
      (n: any) => n.kind === "round-robin",
    ).params.ruleVersion = "round-robin-v2";
    const update = await page.request.put(path, {
      headers: { Origin: base, "Idempotency-Key": "ranking-change" },
      data: { expectedVersion: saved.version, name: "A组", graph: saved.graph },
    });
    expect(update.ok()).toBeTruthy();
    const record = (await update.json()).data;
    await page.request.post(path + "/validate", {
      headers: { Origin: base },
      data: { expectedVersion: record.version },
    });
    const stale = (await (await page.request.get(path + "/schedule")).json())
      .data;
    expect(stale.stale).toBe(true);
    expect(stale.schedule.boundWavePlan.rounds).toHaveLength(6);
  } finally {
    if (server?.listening)
      await new Promise<void>((done) => server.close(done));
    platform.close();
    if (!dir.startsWith(join(tmpdir(), "race-ranking-rounds-")))
      throw Error("Unexpected path");
    rmSync(dir, { recursive: true, force: true });
  }
});
