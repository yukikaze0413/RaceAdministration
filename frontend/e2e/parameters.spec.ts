import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url),
  { createApp } = require("../../backend/src/app");
const tiSource = require("../../backend/test/fixtures/ti2026-official-observations-v1.json");
const tiCandidate = require("../../backend/src/platform/operations/format-runners/ti-unit-candidate");
let platform: any,
  server: any,
  base: string,
  tid: string,
  directory: string,
  databasePath: string;
let testClock: number;
test.beforeEach(async ({ page }) => {
  testClock = Date.now();
  directory = mkdtempSync(join(tmpdir(), "race-parameters-"));
  databasePath = join(directory, "parameters.sqlite");
  platform = createApp({
    now: () => testClock,
    databasePath,
    origins: [],
    frontendPath: resolve("dist"),
  });
  // Select a high port explicitly: Windows may allocate low ephemeral ports.
  // Bound retries prevent an unsuitable range from spinning indefinitely.
  for (let attempt = 0; attempt < 30; attempt++) {
    server = platform.app.listen(
      25000 + Math.floor(Math.random() * 30000),
      "127.0.0.1",
    );
    const ready = await new Promise<boolean>((resolve, reject) => {
      server.once("listening", () => resolve(true));
      server.once("error", (error: any) =>
        ["EADDRINUSE", "EACCES"].includes(error.code)
          ? resolve(false)
          : reject(error),
      );
    });
    if (ready) break;
    if (attempt === 29) throw new Error("No free test port found");
  }
  base = "http://127.0.0.1:" + server.address().port;
  await new Promise<void>((r) => server.close(() => r()));
  platform.close();
  platform = createApp({
    now: () => testClock,
    databasePath,
    origins: [base],
    frontendPath: resolve("dist"),
  });
  server = platform.app.listen(Number(new URL(base).port), "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  for (const action of ["register", "login"]) {
    const r = await page.request.post(base + "/api/v1/auth/" + action, {
      headers: { Origin: base },
      data: {
        username: "parameter_owner",
        password: "test-parameter-password",
        ...(action === "register" ? { displayName: "参数验收主办" } : {}),
      },
    });
    expect(r.ok()).toBeTruthy();
  }
  const r = await page.request.post(base + "/api/v1/tournaments", {
    headers: { Origin: base, "Idempotency-Key": "event" },
    data: { name: "参数验收赛事", game: "card", visibility: "private" },
  });
  tid = (await r.json()).data.id;
});
test.afterEach(async () => {
  if (server?.listening)
    await new Promise<void>((r) => server.close(() => r()));
  platform?.close();
  for (const path of [
    databasePath,
    databasePath + "-wal",
    databasePath + "-shm",
  ])
    if (path && existsSync(path)) unlinkSync(path);
  if (directory && existsSync(directory)) rmdirSync(directory);
});
async function emptyPage(page: Page) {
  await page.goto(base + "/manage/" + tid + "/overview");
  await page.getByRole("button", { name: "新建赛制配置", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "赛制", exact: true }),
  ).toBeVisible();
  return new URL(page.url()).pathname.split("/")[4];
}
async function gslPage(page: Page) {
  const cid = await emptyPage(page);
  await page
    .getByRole("textbox", { name: "阶段名称", exact: true })
    .fill("分组赛");
  await page
    .getByRole("combobox", { name: "赛制", exact: true })
    .selectOption("gsl-classic-v1");
  await page.getByRole("button", { name: "创建阶段", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  return cid;
}
async function configuration(page: Page, cid: string) {
  const r = await page.request.get(
    base + "/api/v1/tournaments/" + tid + "/configurations/" + cid,
  );
  expect(r.ok()).toBeTruthy();
  return (await r.json()).data;
}
for (const width of [360, 768, 1440])
  test(`TI 隔离注入候选逐局报分与44场推进 ${width}`, async ({ page }) => {
    test.setTimeout(240000);
    page.on("dialog", async (d) => d.accept());
    await page.setViewportSize({ width, height: 900 });
    const cid = await emptyPage(page);
    await page
      .getByRole("combobox", { name: "赛制", exact: true })
      .selectOption("ti2026-observed-candidate-v1");
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("阶段已保存");
    await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
    await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
    await page
      .getByRole("dialog", { name: "确认冻结结构" })
      .getByRole("button", { name: "确认冻结", exact: true })
      .click();
    await expect(
      page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
    ).toBeVisible();
    const c = await configuration(page, cid),
      ids = [...tiSource.observedInitialPairing.matches]
        .sort((a: any, b: any) => a.groupLabel.localeCompare(b.groupLabel))
        .flatMap((m: any) => m.entrantIds.map(String));
    const ownerId = platform.db
      .prepare("SELECT ownerId FROM tournaments WHERE id=?")
      .get(tid).ownerId;
    const entries = ids.map((entrantId: string, i: number) => ({
      entrantId,
      channel: "slot",
      positionKind: "slot",
      position: i + 1,
      initialSeed: i + 1,
    }));
    const {
        read,
        save,
      } = require("../../backend/src/platform/operations/state"),
      s = read(platform.db, tid);
    // Testing the application protocol, with public start deliberately closed.
    // This injection does not claim a completed real registration/import flow.
    s.runtime = {
      version: "runtime-rules-v2",
      status: "running",
      tournamentId: tid,
      configurationId: cid,
      plan: c.snapshot.plan,
      structure: c.snapshot.structure,
      roster: ids.map((id: string, i: number) => ({
        entrantId: id,
        userId: ownerId,
        name: tiSource.teams.find((t: any) => String(t.id) === id).name,
        initialSeed: i + 1,
        exitState: "active",
      })),
      units: [
        tiCandidate.createTiCandidateUnit(c.snapshot.plan.units[0], entries),
      ],
      blocked: [],
      waiting: [],
    };
    save(platform.db, tid, s);
    const current = () => read(platform.db, tid).runtime.units[0];
    await page.goto(base + "/manage/" + tid + "/rounds");
    for (let n = 1; n <= 6; n++) {
      if (n === 6) {
        for (const chooser of current().elimination.choosers) {
          const actual = tiSource.phases
            .find((p: any) => p.name === "Elimination Round")
            .matches.find((m: any) =>
              m.entrantIds.includes(Number(chooser.entrantId)),
            );
          await page
            .getByRole("combobox", { name: "附加赛对手", exact: true })
            .selectOption(
              String(
                actual.entrantIds.find(
                  (id: number) => id !== Number(chooser.entrantId),
                ),
              ),
            );
          await page
            .getByRole("textbox", { name: "选择原因", exact: true })
            .fill("与观察结果兼容的候选选择");
          const before = current().version;
          await page
            .getByRole("button", { name: "确认附加赛对手", exact: true })
            .click();
          await expect.poll(() => current().version).toBe(before + 1);
          if (current().status === "choosing-elimination")
            await expect(
              page.getByText(
                `已完成 ${current().elimination.selections.length}/5 项选择`,
                { exact: true },
              ),
            ).toBeVisible();
        }
      }
      const round = current().rounds.at(-1),
        block = page.locator(".round-block").nth(n - 1);
      await expect(block.getByRole("heading", { level: 4 })).toContainText(
        n === 6 ? "附加淘汰赛" : "第 " + n + " 轮",
      );
      for (const [i, m] of round.matches.entries()) {
        const card = block.locator(".match-card").nth(i),
          actual = tiSource.phases
            .find(
              (p: any) => p.name === (n === 6 ? "Elimination Round" : "Swiss"),
            )
            .matches.find((a: any) =>
              a.entrantIds.every((id: number) =>
                m.entrants.includes(String(id)),
              ),
            );
        const scores = m.entrants.map(
          (id: string) => actual.scores[actual.entrantIds.indexOf(Number(id))],
        );
        await card
          .getByRole("spinbutton", { name: "左方比分", exact: true })
          .fill(String(scores[0]));
        await card
          .getByRole("spinbutton", { name: "右方比分", exact: true })
          .fill(String(scores[1]));
        if (n <= 5)
          for (const [j, g] of actual.games.entries()) {
            await card
              .getByRole("combobox", { name: `第${j + 1}局胜者`, exact: true })
              .selectOption(String(g.winnerId));
            await card
              .getByRole("spinbutton", {
                name: `第${j + 1}局时长（秒）`,
                exact: true,
              })
              .fill(String(g.durationSeconds));
          }
        await card
          .getByRole("textbox", { name: "裁定原因", exact: true })
          .fill("核对逐局或附加赛观察结果");
        if (width === 360 && n === 1 && i === 0) {
          const serverGames = actual.games.map((g: any, j: number) => ({
            matchId: `concurrent-${m.id}/${j + 1}`,
            winnerId: String(g.winnerId),
            durationSeconds: g.durationSeconds + 11,
          }));
          const changed = await page.request.patch(
            base +
              "/api/v1/tournaments/" +
              tid +
              "/matches/" +
              m.id +
              "/results",
            {
              headers: { Origin: base, "Idempotency-Key": "concurrent-ti" },
              data: {
                expectedVersion: read(platform.db, tid).version,
                result: {
                  kind: "score",
                  scores,
                  seriesId: "concurrent-" + m.id,
                  games: serverGames,
                },
                reason: "并发裁定",
              },
            },
          );
          expect(changed.ok()).toBeTruthy();
          await card
            .getByRole("button", { name: "裁定赛果", exact: true })
            .click();
          await expect(
            card.getByText("请处理版本或请求冲突", { exact: true }),
          ).toBeVisible();
          await card.getByRole("button", { name: "重试", exact: true }).click();
          await expect(
            card.getByText("服务器当前赛果：" + scores.join(" : "), {
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            card.getByRole("spinbutton", {
              name: "第1局时长（秒）",
              exact: true,
            }),
          ).toHaveValue(String(actual.games[0].durationSeconds));
          await card
            .getByRole("button", { name: "采用服务器赛果", exact: true })
            .click();
          await expect(
            card.getByRole("spinbutton", {
              name: "第1局时长（秒）",
              exact: true,
            }),
          ).toHaveValue(String(actual.games[0].durationSeconds + 11));
          // Keep the frozen observation's duration for the historical replay;
          // adopting metadata must preserve the server's series/game identity.
          for (const [j, g] of actual.games.entries())
            await card
              .getByRole("spinbutton", {
                name: `第${j + 1}局时长（秒）`,
                exact: true,
              })
              .fill(String(g.durationSeconds));
        }
        await card
          .getByRole("button", { name: "裁定赛果", exact: true })
          .click();
        await expect(card).toContainText("已裁定，等待整轮确认");
        if (width === 360 && n === 1 && i === 0)
          expect(current().rounds[0].matches[0].decision.seriesId).toBe(
            "concurrent-" + m.id,
          );
      }
      await block
        .getByRole("textbox", { name: "TI整轮确认原因", exact: true })
        .fill("当前轮数据齐备");
      await block
        .getByRole("button", { name: "确认整轮并推进", exact: true })
        .click();
      await expect(block.getByRole("heading", { level: 4 })).toContainText(
        "已锁定",
      );
      if (n === 1) {
        await page.reload();
        await expect(page.locator(".round-block")).toHaveCount(2);
      }
    }
    await page.reload();
    await expect(
      page.getByRole("region", { name: "TI瑞士战绩表", exact: true }),
    ).toContainText("晋级第8位");
    expect(current().qualified.map((q: any) => q.swissRank)).toEqual([
      1, 2, 3, 4, 5, 6, 9, 11,
    ]);
    expect(current().confirmedSeries.flatMap((m: any) => m.games)).toHaveLength(
      97,
    );
    expect(current().rounds.flatMap((r: any) => r.matches)).toHaveLength(44);
    expect(current().status).toBe("completed");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: resolve(
        `../openspec/changes/optimize-tournament-planning-and-schedules/evidence/ti-runtime-${width}.png`,
      ),
      fullPage: true,
    });
  });
for (const width of [360, 768, 1440])
  test(`TI 候选计划保存冻结与附加淘汰窗口 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const cid = await emptyPage(page);
    await page
      .getByRole("combobox", { name: "赛制", exact: true })
      .selectOption("ti2026-observed-candidate-v1");
    await expect(
      page.getByText(
        "可保存参数、核验并冻结完整比赛计划；此规则的实际运行仍在接入。",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByText("高级赛制参数", { exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "轮数", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("combobox", { name: "轮数", exact: true })
        .locator("option"),
    ).toHaveText(["5"]);
    await expect(
      page.getByRole("combobox", { name: "默认BO", exact: true }),
    ).toHaveValue("3");
    await expect(page.getByLabel("添加轮次BO", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("阶段已保存");
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "赛制", exact: true }),
    ).toHaveValue("ti2026-observed-candidate-v1");
    const saved = await configuration(page, cid),
      groupId = saved.stages[0].groups[0].id;
    await page.getByRole("link", { name: "赛制画布", exact: true }).click();
    await page
      .getByRole("combobox", { name: "查看比赛子图", exact: true })
      .selectOption(groupId);
    await expect(page.locator('[data-kind="window"]')).toHaveCount(6);
    await expect(page.locator('[data-kind="window"]').last()).toContainText(
      "附加淘汰赛",
    );
    await expect(page.locator('[data-kind="output"]').last()).toContainText(
      "附加淘汰赛后资格第8位",
    );
    await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
    await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
    await page
      .getByRole("dialog", { name: "确认冻结结构" })
      .getByRole("button", { name: "确认冻结", exact: true })
      .click();
    await expect(
      page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
    ).toBeVisible();
    expect((await configuration(page, cid)).snapshot.runtimeReady).toBe(false);
    await page.getByRole("link", { name: "时间编排", exact: true }).click();
    const future = page.getByRole("combobox", {
      name: "关联未来赛程轮次",
      exact: true,
    });
    await expect(future.locator("option")).toHaveCount(7);
    await expect(future.locator("option").last()).toContainText(
      "附加淘汰赛窗口",
    );
    const c = await configuration(page, cid),
      windowKey = c.snapshot.plan.units[0].windows[5].planKey;
    await future.selectOption(windowKey);
    await page.getByLabel("时间窗口名称", { exact: true }).fill("TI附加淘汰");
    await page
      .getByLabel("窗口开始时间", { exact: true })
      .fill("2030-01-01T08:00");
    await page
      .getByRole("button", { name: "添加时间窗口", exact: true })
      .click();
    await expect(page.getByText(/附加淘汰赛预约/)).toBeVisible();
    await page
      .getByRole("button", { name: "保存时间计划", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("时间计划已保存");
    await page.reload();
    await expect(page.getByText(/附加淘汰赛预约/)).toBeVisible();
    await page.screenshot({
      path: resolve(
        `../openspec/changes/optimize-tournament-planning-and-schedules/evidence/ti-plan-${width}.png`,
      ),
      fullPage: true,
    });
  });
for (const width of [360, 768, 1440])
  test(`SC2 时间编排四台并行与公众三视图 ${width}`, async ({
    page,
    browser,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const cid = await emptyPage(page);
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("阶段已保存");
    await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
    await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
    await page
      .getByRole("dialog", { name: "确认冻结结构" })
      .getByRole("button", { name: "确认冻结", exact: true })
      .click();
    await expect(
      page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "时间编排", exact: true }).click();
    for (let n = 1; n <= 4; n++) {
      await page
        .getByRole("textbox", { name: "比赛台名称", exact: true })
        .fill("比赛台" + n);
      await page
        .getByRole("button", { name: "添加比赛台", exact: true })
        .click();
    }
    await page
      .getByRole("textbox", { name: "时间窗口名称", exact: true })
      .fill("首轮并行");
    await page
      .getByLabel("窗口开始时间", { exact: true })
      .fill("2030-01-01T08:00");
    await page
      .getByRole("button", { name: "添加时间窗口", exact: true })
      .click();
    const pending = page.getByRole("region", {
      name: "待安排比赛",
      exact: true,
    });
    const choices = pending.getByRole("checkbox");
    for (let i = 0; i < 4; i++) await choices.nth(i).check();
    await page
      .getByRole("combobox", { name: "批量安排窗口", exact: true })
      .selectOption({ label: "首轮并行" });
    await page
      .getByRole("combobox", { name: "批量安排比赛台", exact: true })
      .selectOption("rotate");
    await page
      .getByRole("button", { name: "安排所选比赛", exact: true })
      .click();
    await page
      .getByRole("button", { name: "保存时间计划", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "时间计划已保存" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "按时间段", exact: true }).click();
    await expect(
      page.locator(".schedule-time-slot .schedule-match"),
    ).toHaveCount(4);
    await page.reload();
    await page.getByRole("button", { name: "按时间段", exact: true }).click();
    await expect(
      page.locator(".schedule-time-slot .schedule-match"),
    ).toHaveCount(4);
    await expect(page.locator(".schedule-time-slot h3").first()).toContainText(
      "UTC+08:00",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const url = base + "/api/v1/tournaments/" + tid + "/schedule",
      saved = (await (await page.request.get(url)).json()).data.schedule;
    expect(saved.assignments).toHaveLength(4);
    expect(new Set(saved.assignments.map((a: any) => a.resourceId)).size).toBe(
      4,
    );
    expect(saved.windows[0].startsAt).toBe("2030-01-01T00:00:00.000Z");
    expect(
      (
        await page.request.patch(base + "/api/v1/tournaments/" + tid, {
          headers: { Origin: base, "Idempotency-Key": "public-schedule" },
          data: { expectedVersion: 1, visibility: "public" },
        })
      ).ok(),
    ).toBeTruthy();
    const context = await browser.newContext({
        viewport: { width, height: 900 },
      }),
      spectator = await context.newPage();
    await spectator.goto(base + "/tournaments/" + tid + "/schedule");
    await spectator
      .getByRole("button", { name: "按时间段", exact: true })
      .click();
    await expect(
      spectator.locator(".schedule-time-slot .schedule-match"),
    ).toHaveCount(4);
    await expect(
      spectator.getByRole("button", { name: "保存时间计划", exact: true }),
    ).toHaveCount(0);
    await spectator
      .getByRole("button", { name: "按轮次", exact: true })
      .click();
    await expect(
      spectator.locator(".schedule-round .schedule-match"),
    ).toHaveCount(7);
    await spectator
      .getByRole("button", { name: "赛制签表", exact: true })
      .click();
    await expect(spectator.locator('[data-kind="match"]')).toHaveCount(7);
    const publicData = JSON.stringify(
      (await (await spectator.request.get(url)).json()).data,
    );
    expect(publicData).not.toContain('"actorId"');
    expect(publicData).not.toContain('"userId"');
    await spectator.screenshot({
      path: resolve(
        `../openspec/changes/optimize-tournament-planning-and-schedules/evidence/schedule-public-${width}.png`,
      ),
      fullPage: true,
    });
    await context.close();
  });
for (const width of [360, 768, 1440])
  test(`CW7 具名端口与键盘连接拒绝复制及确认替换 ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const cid = await emptyPage(page);
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("阶段已保存");
    const c = await configuration(page, cid),
      {
        id,
        tournamentId,
        version,
        state,
        snapshot,
        upgradeOrigin,
        ...payload
      } = c;
    payload.stages = ["来源甲", "来源乙", "决赛"].map((name, i) => {
      const s = structuredClone(c.stages[0]);
      s.id = i === 0 ? s.id : randomUUID();
      s.name = name;
      s.order = i + 1;
      s.groups = s.groups.map((g: any) => ({
        ...g,
        id: i === 0 ? g.id : randomUUID(),
        stageId: s.id,
      }));
      return s;
    });
    const response = await page.request.put(
      base + "/api/v1/tournaments/" + tid + "/configurations/" + cid,
      {
        headers: { Origin: base, "Idempotency-Key": "graph-setup" },
        data: { expectedVersion: version, payload },
      },
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    await page.goto(
      base + "/manage/" + tid + "/configurations/" + cid + "/graph",
    );
    const source = page.getByRole("combobox", {
        name: "连接来源出口",
        exact: true,
      }),
      target = page.getByRole("combobox", {
        name: "连接目标入口",
        exact: true,
      });
    const s1 = JSON.stringify([
        payload.stages[0].groups[0].id,
        "qualification",
      ]),
      s2 = JSON.stringify([payload.stages[1].groups[0].id, "qualification"]),
      t = JSON.stringify([payload.stages[2].groups[0].id, "seed"]);
    await source.selectOption(s1);
    await target.selectOption(t);
    const connect = page.getByRole("button", {
      name: "校验并添加连接",
      exact: true,
    });
    await connect.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: "连接已加入草稿" }),
    ).toBeVisible();
    await connect.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toContainText("不能一对多复制");
    await source.selectOption(s2);
    page.once("dialog", (d) => d.dismiss());
    await connect.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: "保存结构草稿", exact: true })
      .click();
    expect((await configuration(page, cid)).routes[0].source.groupId).toBe(
      payload.stages[0].groups[0].id,
    );
    page.once("dialog", (d) => d.accept());
    await connect.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: "连接已加入草稿" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "保存结构草稿", exact: true })
      .click();
    const saved = await configuration(page, cid);
    expect(saved.routes).toHaveLength(1);
    expect(saved.routes[0].source).toMatchObject({
      groupId: payload.stages[1].groups[0].id,
      port: "qualification",
    });
    expect(saved.routes[0].target.port).toBe("seed");
    await page.reload();
    await page.getByRole("link", { name: "晋级路由", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "来源具名端口", exact: true }),
    ).toHaveValue("qualification");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
for (const width of [360, 768, 1440])
  test("参数真实创建/刷新/增组/确认 " + width, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    const cid = await gslPage(page),
      before = await configuration(page, cid);
    expect(before.stages[0].groups).toHaveLength(4);
    expect(before.stages[0].capacity).toBe(16);
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "小组数量", exact: true }),
    ).toHaveValue("4");
    await page
      .getByRole("combobox", { name: "小组数量", exact: true })
      .selectOption("5");
    await page.getByRole("button", { name: "保存阶段", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("阶段已保存");
    const expanded = await configuration(page, cid);
    expect(expanded.stages[0].groups.slice(0, 4).map((g: any) => g.id)).toEqual(
      before.stages[0].groups.map((g: any) => g.id),
    );
    await page
      .getByRole("combobox", { name: "小组数量", exact: true })
      .selectOption("2");
    await page.getByRole("button", { name: "保存阶段", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "确认阶段修改" }),
    ).toContainText("C组");
    await page.keyboard.press("Escape");
    expect((await configuration(page, cid)).stages[0].groupCount).toBe(5);
    await expect(
      page.getByRole("combobox", { name: "小组数量", exact: true }),
    ).toHaveValue("2");
    await page.getByRole("button", { name: "保存阶段", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "确认阶段修改" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "确认并保存", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText("阶段已保存");
    const saved = await configuration(page, cid);
    expect(saved.stages[0].groupCount).toBe(2);
    expect(saved.stages[0].groups.map((g: any) => g.id)).toEqual(
      before.stages[0].groups.slice(0, 2).map((g: any) => g.id),
    );
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "小组数量", exact: true }),
    ).toHaveValue("2");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
    await page.screenshot({
      path: resolve(
        "../openspec/changes/optimize-tournament-planning-and-schedules/evidence/parameters-" +
          width +
          ".png",
      ),
      fullPage: true,
    });
  });
test("九种赛制按服务器默认集保存及恢复", async ({ page }) => {
  const cid = await emptyPage(page);
  const cases = [
    ["single-cut-v2", 8, 1, 1, 8],
    ["gsl-classic-v1", 4, 4, 2, 16],
    ["de-standard-v1", 8, 1, 1, 8],
    ["de-lower-entry-v1", 8, 1, 1, 8],
    ["swiss-fixed-v1", 16, 1, 8, 16],
    ["swiss-threshold-v1", 16, 1, 8, 16],
    ["major-cologne-2026-v1", 16, 1, 8, 16],
    ["round-robin-v2", 4, 1, 2, 4],
    ["double-round-robin-v2", 4, 1, 2, 4],
  ] as const;
  for (let i = 0; i < cases.length; i++) {
    const [id, n, count, q, total] = cases[i];
    await page
      .getByRole("combobox", { name: "赛制", exact: true })
      .selectOption(id);
    await page
      .getByRole("button", {
        name: i === 0 ? "创建阶段" : "保存阶段",
        exact: true,
      })
      .click();
    if (i > 0) {
      await expect(
        page.getByRole("dialog", { name: "确认阶段修改" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "确认并保存", exact: true })
        .click();
    }
    await expect(page.getByRole("status")).toContainText("阶段已保存");
    const current = await configuration(page, cid),
      s = current.stages[0];
    expect([s.groupSize, s.groupCount, s.qualifyCount, s.capacity]).toEqual([
      n,
      count,
      q,
      total,
    ]);
    expect(s.ruleVersion).toBe(id);
    expect(s.parameters.defaultBO).toBe(3);
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "赛制", exact: true }),
    ).toHaveValue(id);
  }
});
test("409比较后保留输入并用最新版本确认保存", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  const cid = await gslPage(page),
    old = await configuration(page, cid),
    sid = old.stages[0].id;
  await page
    .getByRole("combobox", { name: "小组数量", exact: true })
    .selectOption("2");
  const url =
    base +
    "/api/v1/tournaments/" +
    tid +
    "/configurations/" +
    cid +
    "/stages/" +
    sid;
  const report = (
    await (
      await page.request.post(url + "/plan", {
        headers: { Origin: base },
        data: { expectedVersion: old.version, changes: { groupCount: 3 } },
      })
    ).json()
  ).data;
  expect(
    (
      await page.request.post(url + "/apply", {
        headers: { Origin: base, "Idempotency-Key": "other-admin" },
        data: {
          expectedVersion: old.version,
          changes: { groupCount: 3 },
          confirmed: true,
          confirmationToken: report.confirmationToken,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.getByRole("button", { name: "保存阶段", exact: true }).click();
  await expect(page.getByText("请处理版本或请求冲突")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "小组数量", exact: true }),
  ).toHaveValue("2");
  await page.getByRole("button", { name: "读取最新版本", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "版本冲突比较" }),
  ).toContainText("服务器版本 3");
  await page
    .getByRole("button", { name: "保留我的输入，采用最新版本", exact: true })
    .click();
  await page.getByRole("button", { name: "保存阶段", exact: true }).click();
  await page.getByRole("button", { name: "确认并保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  expect((await configuration(page, cid)).stages[0].groupCount).toBe(2);
});
test("已提交但响应丢失后按原键重试，不重复应用", async ({ page }) => {
  const cid = await gslPage(page);
  let lost = false;
  const keys: string[] = [];
  await page.route(
    "**/api/v1/tournaments/*/configurations/*/stages/*/apply",
    async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      if (!lost) {
        lost = true;
        const r = await route.fetch();
        expect(r.ok()).toBeTruthy();
        await route.abort("failed");
      } else await route.continue();
    },
  );
  await page
    .getByRole("combobox", { name: "默认BO", exact: true })
    .selectOption("5");
  await page.getByRole("button", { name: "保存阶段", exact: true }).click();
  await expect(
    page.getByText("网络连接失败，请检查网络后重试。"),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "默认BO", exact: true }),
  ).toHaveValue("5");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const saved = await configuration(page, cid);
  expect(saved.version).toBe(3);
  expect(saved.stages[0].parameters.defaultBO).toBe(5);
});
test("目录读取失败后不编造默认值，重试恢复编辑", async ({ page }) => {
  await page.route("**/api/v1/formats", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "STORE_UNAVAILABLE",
          message: "目录暂不可用",
          requestId: "blocked",
          retryable: true,
        },
      }),
    }),
  );
  await page.goto(base + "/manage/" + tid + "/overview");
  await page.getByRole("button", { name: "新建赛制配置", exact: true }).click();
  await expect(page.getByText("目录暂不可用")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "赛制", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/v1/formats");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "每组人数", exact: true }),
  ).toHaveValue("8");
});

for (const width of [360, 768, 1440])
  test("v1复制升级明确确认且原草稿保留 " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const oldResponse = await page.request.post(
      base + "/api/v1/tournaments/" + tid + "/configurations",
      {
        headers: { Origin: base, "Idempotency-Key": "legacy-six" },
        data: {
          payload: {
            entrantKind: "individual",
            structureVersion: "structure-v1",
            routingVersion: "routing-v1",
            stages: [
              {
                id: "six",
                order: 1,
                capacity: 6,
                formatIntent: "single-elimination",
                groups: [],
              },
            ],
            pools: [],
            routes: [],
          },
        },
      },
    );
    expect(oldResponse.ok()).toBeTruthy();
    const original = (await oldResponse.json()).data;
    await page.goto(
      base + "/manage/" + tid + "/configurations/" + original.id + "/stages",
    );
    await page.locator('[data-path="/stages/0/capacity"]').fill("8");
    await expect(
      page.getByRole("button", { name: "复制升级为新版配置", exact: true }),
    ).toBeDisabled();
    await page.locator('[data-path="/stages/0/capacity"]').fill("6");
    await page
      .getByRole("button", { name: "复制升级为新版配置", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "复制升级旧草稿" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    expect(
      (
        await (
          await page.request.get(
            base + "/api/v1/tournaments/" + tid + "/configurations",
          )
        ).json()
      ).data,
    ).toHaveLength(1);
    const keys: string[] = [];
    let lost = false;
    if (width === 360)
      await page.route("**/copy-upgrade", async (route) => {
        keys.push(route.request().headers()["idempotency-key"]);
        if (!lost) {
          lost = true;
          const response = await route.fetch();
          expect(response.ok(), await response.text()).toBeTruthy();
          await route.abort("failed");
        } else await route.continue();
      });
    await page
      .getByRole("button", { name: "复制升级为新版配置", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "确认复制升级", exact: true })
      .click();
    if (width === 360) {
      await expect(
        dialog.getByText("网络连接失败，请检查网络后重试。"),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "重试", exact: true }).click();
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(keys[1]);
    }
    await expect(
      page.getByRole("heading", { name: "赛制参数", exact: true }),
    ).toBeVisible();
    const copiedId = new URL(page.url()).pathname.split("/")[4];
    expect(copiedId).not.toBe(original.id);
    const copied = await configuration(page, copiedId);
    expect(copied.upgradeOrigin.configurationId).toBe(original.id);
    expect(copied.stages[0].groupSize).toBe(6);
    expect(await configuration(page, original.id)).toEqual(original);
    await page.reload();
    await expect(page.getByText(/由旧配置复制升级/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });

test("CW6 同配置参数与画布切页保留草稿，真正离开才提醒", async ({ page }) => {
  const cid = await gslPage(page);
  await page
    .getByRole("combobox", { name: "小组数量", exact: true })
    .selectOption("2");
  await page.getByRole("link", { name: "赛制画布", exact: true }).click();
  await expect(
    page.getByRole("alertdialog", { name: "未保存草稿" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "赛制参数", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "小组数量", exact: true }),
  ).toHaveValue("2");
  await page.getByRole("link", { name: "配置列表", exact: true }).click();
  await expect(
    page.getByRole("alertdialog", { name: "未保存草稿" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "小组数量", exact: true }),
  ).toHaveValue("2");
  expect((await configuration(page, cid)).stages[0].groupCount).toBe(4);
});
test("CW6 查看缩放不算修改，节点位置跨子页保留", async ({ page }) => {
  const r = await page.request.post(
    base + "/api/v1/tournaments/" + tid + "/configurations",
    {
      headers: { Origin: base, "Idempotency-Key": "legacy-view" },
      data: {
        payload: {
          entrantKind: "individual",
          structureVersion: "structure-v1",
          routingVersion: "routing-v1",
          stages: [
            {
              id: "eight",
              order: 1,
              capacity: 8,
              formatIntent: "single-elimination",
              groups: [],
            },
          ],
          pools: [],
          routes: [],
        },
      },
    },
  );
  const c = (await r.json()).data;
  await page.goto(
    base + "/manage/" + tid + "/configurations/" + c.id + "/graph",
  );
  await page
    .getByRole("spinbutton", { name: "画布缩放", exact: true })
    .fill("1.5");
  await expect(
    page.getByText("布局有未保存修改。", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "移动阶段1", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByText("布局有未保存修改。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "阶段与小组", exact: true }).click();
  await expect(
    page.getByRole("alertdialog", { name: "未保存草稿" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "赛制画布", exact: true }).click();
  await expect(page.locator(".graph-node").first()).toHaveCSS("left", "50px");
  await expect(
    page.getByRole("spinbutton", { name: "画布缩放", exact: true }),
  ).toHaveValue("1.5");
  await page.getByRole("link", { name: "配置列表", exact: true }).click();
  await expect(
    page.getByRole("alertdialog", { name: "未保存草稿" }),
  ).toBeVisible();
});
test("CW6 保存后离开等待真实参数保存；失败仍保留输入", async ({ page }) => {
  const cid = await gslPage(page);
  await page
    .getByRole("combobox", { name: "默认BO", exact: true })
    .selectOption("5");
  await page.route("**/stages/*/apply", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "STORE_FAILURE", message: "故障注入", retryable: true },
      }),
    }),
  );
  await page.getByRole("link", { name: "配置列表", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "未保存草稿" });
  await dialog.getByRole("button", { name: "保存后离开", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "默认BO", exact: true }),
  ).toHaveValue("5");
  expect((await configuration(page, cid)).stages[0].parameters.defaultBO).toBe(
    3,
  );
  await page.unroute("**/stages/*/apply");
  await dialog.getByRole("button", { name: "保存后离开", exact: true }).click();
  await expect(page).toHaveURL(base + "/manage/" + tid + "/overview");
  expect((await configuration(page, cid)).stages[0].parameters.defaultBO).toBe(
    5,
  );
});
test("CW6 保存后离开可以保存已经切出画布的节点布局", async ({ page }) => {
  const r = await page.request.post(
    base + "/api/v1/tournaments/" + tid + "/configurations",
    {
      headers: { Origin: base, "Idempotency-Key": "layout-leave" },
      data: {
        payload: {
          entrantKind: "individual",
          structureVersion: "structure-v1",
          routingVersion: "routing-v1",
          stages: [
            {
              id: "eight",
              order: 1,
              capacity: 8,
              formatIntent: "single-elimination",
              groups: [],
            },
          ],
          pools: [],
          routes: [],
        },
      },
    },
  );
  const c = (await r.json()).data;
  await page.goto(
    base + "/manage/" + tid + "/configurations/" + c.id + "/graph",
  );
  await expect(
    page.getByRole("button", { name: "移动阶段1", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "移动阶段1", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("link", { name: "阶段与小组", exact: true }).click();
  await page.getByRole("link", { name: "配置列表", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "未保存草稿" })
    .getByRole("button", { name: "保存后离开", exact: true })
    .click();
  await expect(page).toHaveURL(base + "/manage/" + tid + "/overview");
  const layout = (
    await (
      await page.request.get(
        base +
          "/api/v1/tournaments/" +
          tid +
          "/configurations/" +
          c.id +
          "/layout",
      )
    ).json()
  ).data;
  expect(layout.positions.eight).toEqual({ x: 50, y: 30 });
});
test("CW7 比赛子节点离页保存与独立布局409明确恢复", async ({ page }) => {
  const cid = await emptyPage(page);
  await page.getByRole("button", { name: "创建阶段", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  const c = await configuration(page, cid),
    groupId = c.stages[0].groups[0].id;
  await page.getByRole("link", { name: "赛制画布", exact: true }).click();
  await page
    .getByRole("combobox", { name: "查看比赛子图", exact: true })
    .selectOption(groupId);
  const node = page.locator('[data-kind="match"]').first();
  await expect(node).toBeVisible();
  const key = (await node.getAttribute("data-plan-key"))!,
    move = node.getByRole("button", { name: /^移动/ });
  await expect(move).toBeEnabled();
  await move.focus();
  await page.keyboard.press("ArrowRight");
  const layoutUrl =
    base + "/api/v1/tournaments/" + tid + "/configurations/" + cid + "/layout";
  const concurrent = await page.request.put(layoutUrl, {
    headers: { Origin: base, "Idempotency-Key": "concurrent-match-layout" },
    data: {
      expectedVersion: 0,
      positions: { [key]: { x: 900, y: 900 } },
      zoom: 1,
      pan: { x: 0, y: 0 },
    },
  });
  expect(concurrent.ok(), await concurrent.text()).toBeTruthy();
  await page.getByRole("button", { name: "保存画布布局", exact: true }).click();
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByText(/服务器布局版本1/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "保留本地布局并使用新版本", exact: true })
    .click();
  await page.getByRole("link", { name: "赛制参数", exact: true }).click();
  await page.getByRole("link", { name: "配置列表", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "未保存草稿" })
    .getByRole("button", { name: "保存后离开", exact: true })
    .click();
  await expect(page).toHaveURL(base + "/manage/" + tid + "/overview");
  const saved = (await (await page.request.get(layoutUrl)).json()).data;
  expect(saved.version).toBe(2);
  expect(saved.positions[key]).toEqual({ x: 340, y: 40 });
  expect((await configuration(page, cid)).version).toBe(c.version);
});
test("CW6 冻结前明确保存并以新版本复验", async ({ page }) => {
  const r = await page.request.post(
    base + "/api/v1/tournaments/" + tid + "/configurations",
    {
      headers: { Origin: base, "Idempotency-Key": "freeze-dirty" },
      data: {
        payload: {
          entrantKind: "individual",
          structureVersion: "structure-v1",
          routingVersion: "routing-v1",
          stages: [
            {
              id: "eight",
              order: 1,
              capacity: 8,
              formatIntent: "single-elimination",
              groups: [],
            },
          ],
          pools: [],
          routes: [],
        },
      },
    },
  );
  const c = (await r.json()).data;
  await page.goto(
    base + "/manage/" + tid + "/configurations/" + c.id + "/stages",
  );
  await page.locator('[data-path="/stages/0/capacity"]').fill("16");
  await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "冻结结构…", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
  await page
    .getByRole("dialog", { name: "确认冻结结构" })
    .getByRole("button", { name: "保存并冻结", exact: true })
    .click();
  await expect(page.getByText("结构已冻结，赛事尚未启动。")).toBeVisible();
  await page.getByRole("link", { name: "阶段与小组", exact: true }).click();
  await expect(
    page.locator(' [data-path="/stages/0/capacity"]'.trim()),
  ).toHaveValue("16");
  const latest = await configuration(page, c.id);
  expect(latest.version).toBe(3);
  expect(latest.snapshot.structure.stages[0].capacity).toBe(16);
  expect(latest.state).toBe("structure-frozen");
});
test("CW6 保存后离开仍等待缩组明确确认", async ({ page }) => {
  const cid = await gslPage(page);
  await page
    .getByRole("combobox", { name: "小组数量", exact: true })
    .selectOption("2");
  await page.getByRole("link", { name: "配置列表", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "未保存草稿" })
    .getByRole("button", { name: "保存后离开", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "确认阶段修改" }),
  ).toBeVisible();
  expect((await configuration(page, cid)).stages[0].groupCount).toBe(4);
  await page.getByRole("button", { name: "确认并保存", exact: true }).click();
  await expect(page).toHaveURL(base + "/manage/" + tid + "/overview");
  expect((await configuration(page, cid)).stages[0].groupCount).toBe(2);
});
test("CW6 真实Edge刷新取消保留输入，恢复原值后刷新无提醒", async ({ page }) => {
  await gslPage(page);
  await page
    .getByRole("combobox", { name: "小组数量", exact: true })
    .selectOption("2");
  const event = page.waitForEvent("dialog");
  await page.evaluate(() => {
    setTimeout(() => location.reload(), 0);
  });
  const dialog = await event;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await expect(
    page.getByRole("combobox", { name: "小组数量", exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("combobox", { name: "小组数量", exact: true })
    .selectOption("4");
  let count = 0;
  page.on("dialog", async (d) => {
    count++;
    await d.dismiss();
  });
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "小组数量", exact: true }),
  ).toHaveValue("4");
  expect(count).toBe(0);
});
test("CW6 真实断网保存失败保留参数，联网重试成功", async ({ page }) => {
  const cid = await gslPage(page);
  await page
    .getByRole("combobox", { name: "默认BO", exact: true })
    .selectOption("5");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "保存阶段", exact: true }).click();
  await expect(
    page.getByText("网络连接失败，请检查网络后重试。"),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "默认BO", exact: true }),
  ).toHaveValue("5");
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  expect((await configuration(page, cid)).stages[0].parameters.defaultBO).toBe(
    5,
  );
});
test("CW6 v2冻结入口先保存参数并冻结完整计划", async ({ page }) => {
  const cid = await gslPage(page);
  await page
    .getByRole("combobox", { name: "默认BO", exact: true })
    .selectOption("5");
  await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
  await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
  await page
    .getByRole("dialog", { name: "确认冻结结构" })
    .getByRole("button", { name: "保存并冻结", exact: true })
    .click();
  await expect(
    page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
  ).toBeVisible();
  const c = await configuration(page, cid);
  expect(c.state).toBe("structure-frozen");
  expect(c.stages[0].parameters.defaultBO).toBe(5);
  expect(c.snapshot.plan.units[0].matches).toHaveLength(5);
});
test("CW6 结构草稿跨页及409重读保留本地池并显式恢复版本", async ({ page }) => {
  const cid = await gslPage(page),
    old = await configuration(page, cid);
  await page.getByRole("link", { name: "选手池", exact: true }).click();
  await page.getByRole("button", { name: "添加池", exact: true }).click();
  await page.getByRole("spinbutton", { name: "池容量", exact: true }).fill("2");
  await page.getByRole("link", { name: "晋级路由", exact: true }).click();
  await page.getByRole("link", { name: "选手池", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "池容量", exact: true }),
  ).toHaveValue("2");
  const url =
    base +
    "/api/v1/tournaments/" +
    tid +
    "/configurations/" +
    cid +
    "/stages/" +
    old.stages[0].id;
  const changed = await page.request.post(url + "/apply", {
    headers: { Origin: base, "Idempotency-Key": "remote-bo" },
    data: {
      expectedVersion: old.version,
      changes: { parameters: { ...old.stages[0].parameters, defaultBO: 5 } },
    },
  });
  expect(changed.ok()).toBeTruthy();
  await page.getByRole("button", { name: "保存结构草稿", exact: true }).click();
  await expect(page.getByText("请处理版本或请求冲突")).toBeVisible();
  await page.getByRole("button", { name: "读取最新版本", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "版本冲突比较" }),
  ).toContainText("服务器版本 3");
  await page
    .getByRole("button", { name: "保留我的输入，采用最新版本", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "池容量", exact: true }),
  ).toHaveValue("2");
  await page.getByRole("button", { name: "保存结构草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  const saved = await configuration(page, cid);
  expect(saved.pools[0].capacity).toBe(2);
  expect(saved.stages[0].parameters.defaultBO).toBe(5);
});

async function legacyGraph(page: Page, key: string, id = "eight") {
  const r = await page.request.post(
    base + "/api/v1/tournaments/" + tid + "/configurations",
    {
      headers: { Origin: base, "Idempotency-Key": key },
      data: {
        payload: {
          entrantKind: "individual",
          structureVersion: "structure-v1",
          routingVersion: "routing-v1",
          stages: [
            {
              id,
              order: 1,
              capacity: 8,
              formatIntent: "single-elimination",
              groups: [],
            },
          ],
          pools: [],
          routes: [],
        },
      },
    },
  );
  return (await r.json()).data;
}
test("CW6 布局单独冻结也要求保存或舍弃", async ({ page }) => {
  const c = await legacyGraph(page, "layout-freeze");
  await page.goto(
    base + "/manage/" + tid + "/configurations/" + c.id + "/graph",
  );
  const move = page.getByRole("button", { name: "移动阶段1", exact: true });
  await expect(move).toBeEnabled();
  await move.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
  await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "确认冻结结构" })
      .getByRole("button", { name: "保存并冻结", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保存并冻结", exact: true }).click();
  await expect(page.getByText("结构已冻结，赛事尚未启动。")).toBeVisible();
  const layout = (
    await (
      await page.request.get(
        base +
          "/api/v1/tournaments/" +
          tid +
          "/configurations/" +
          c.id +
          "/layout",
      )
    ).json()
  ).data;
  expect(layout.positions.eight).toEqual({ x: 50, y: 30 });
  await page.getByRole("link", { name: "配置列表", exact: true }).click();
  await expect(page).toHaveURL(base + "/manage/" + tid + "/overview");
});
test("CW6 布局初读未完成时禁止移动，真实基线到达后才编辑", async ({ page }) => {
  const c = await legacyGraph(page, "layout-delayed");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/layout", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(
    base + "/manage/" + tid + "/configurations/" + c.id + "/graph",
  );
  const move = page.getByRole("button", { name: "移动阶段1", exact: true });
  try {
    await expect(move).toBeDisabled();
  } finally {
    release();
  }
  await expect(move).toBeEnabled();
  await move.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".graph-node").first()).toHaveCSS("left", "50px");
});

test("CW6 离页布局失败后重试只保存布局，不重复写结构", async ({ page }) => {
  const c = await legacyGraph(page, "layout-retry");
  let failed = false;
  const keys: string[] = [];
  await page.route("**/layout", async (route) => {
    if (route.request().method() === "PUT") {
      keys.push(route.request().headers()["idempotency-key"]);
      if (!failed) {
        failed = true;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "STORE_FAILURE",
              message: "布局故障注入",
              retryable: true,
            },
          }),
        });
        return;
      }
    }
    await route.continue();
  });
  await page.goto(
    base + "/manage/" + tid + "/configurations/" + c.id + "/graph",
  );
  const move = page.getByRole("button", { name: "移动阶段1", exact: true });
  await expect(move).toBeEnabled();
  await move.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("link", { name: "配置列表", exact: true }).click();
  await page.getByRole("button", { name: "保存后离开", exact: true }).click();
  await expect(
    page.getByText("保存未完成，输入保留，请处理页面错误或继续编辑。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(
    page.getByText("布局有未保存修改。", { exact: true }),
  ).toHaveCount(0);
  const layout = (
    await (
      await page.request.get(
        base +
          "/api/v1/tournaments/" +
          tid +
          "/configurations/" +
          c.id +
          "/layout",
      )
    ).json()
  ).data;
  expect(layout.positions.eight).toEqual({ x: 50, y: 30 });
  expect((await configuration(page, c.id)).version).toBe(1);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});
test("CW6 不完整高级字段可显式修复并真实保存，其他参数保留", async ({
  page,
}) => {
  const cid = await emptyPage(page),
    root = base + "/api/v1/tournaments/" + tid + "/configurations/" + cid;
  expect(
    (
      await page.request.post(root + "/stages", {
        headers: { Origin: base, "Idempotency-Key": "partial-seed" },
        data: {
          expectedVersion: 1,
          stage: {
            ruleVersion: "gsl-classic-v1",
            name: "分组赛",
            parameters: { seeding: { kind: "seed" } },
          },
        },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.post(root + "/stages", {
        headers: { Origin: base, "Idempotency-Key": "partial-ranking" },
        data: {
          expectedVersion: 2,
          stage: {
            ruleVersion: "swiss-fixed-v1",
            name: "瑞士阶段",
            parameters: { defaultBO: 5, tiebreakers: ["points"] },
          },
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await page.getByText("高级赛制参数", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "种子表", exact: true })
    .selectOption("recursive-v1");
  await page.getByRole("button", { name: "保存阶段", exact: true }).click();
  await page.getByRole("button", { name: "确认并保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  await page.getByRole("button", { name: "2. 瑞士阶段", exact: true }).click();
  await page.getByRole("button", { name: "恢复默认排序", exact: true }).click();
  await page.getByRole("button", { name: "保存阶段", exact: true }).click();
  await page.getByRole("button", { name: "确认并保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  const saved = await configuration(page, cid);
  expect(saved.stages[0].parameters.seeding).toEqual({
    kind: "seed",
    seedTableVersion: "recursive-v1",
  });
  expect(saved.stages[1].parameters.defaultBO).toBe(5);
  expect(saved.stages[1].parameters.tiebreakers).toEqual([
    "points",
    "BH-points-v1",
    "netGames",
    "initialSeed",
  ]);
});
test("CW6 合法原型名称节点仍从实际坐标编辑并保存", async ({ page }) => {
  const c = await legacyGraph(page, "prototype-layout", "__proto__");
  await page.goto(
    base + "/manage/" + tid + "/configurations/" + c.id + "/graph",
  );
  const move = page.getByRole("button", { name: "移动阶段1", exact: true });
  await expect(move).toBeEnabled();
  await expect(page.locator(".graph-node").first()).toHaveCSS("left", "30px");
  await move.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "保存画布布局", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("布局已保存");
  const layout = (
    await (
      await page.request.get(
        base +
          "/api/v1/tournaments/" +
          tid +
          "/configurations/" +
          c.id +
          "/layout",
      )
    ).json()
  ).data;
  expect(layout.positions["__proto__"]).toEqual({ x: 50, y: 30 });
});

test("PR5 ER1 具名入口真实审批锁定并运行单败资格集合，未交手者不冒充冠军", async ({
  page,
}) => {
  const cid = await emptyPage(page);
  await page
    .getByRole("combobox", { name: "每组人数", exact: true })
    .selectOption("4");
  await page
    .getByRole("combobox", { name: "每组晋级人数", exact: true })
    .selectOption("2");
  await page
    .getByRole("combobox", { name: "默认BO", exact: true })
    .selectOption("5");
  await page.getByRole("button", { name: "创建阶段", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
  await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
  await page
    .getByRole("dialog", { name: "确认冻结结构" })
    .getByRole("button", { name: "确认冻结", exact: true })
    .click();
  await expect(
    page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
  ).toBeVisible();
  const api = base + "/api/v1";
  expect(
    (
      await page.request.patch(api + "/tournaments/" + tid, {
        headers: { Origin: base, "Idempotency-Key": "public" },
        data: { expectedVersion: 1, visibility: "public" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.post(
        api + "/tournaments/" + tid + "/registration-form/publish",
        {
          headers: { Origin: base, "Idempotency-Key": "publish" },
          data: { expectedVersion: 0 },
        },
      )
    ).ok(),
  ).toBeTruthy();
  for (let i = 1; i <= 4; i++) {
    const credentials = {
      username: "entry_player_" + i,
      password: "entry-browser-password",
    };
    expect(
      (
        await page.request.post(api + "/auth/register", {
          headers: { Origin: base },
          data: { ...credentials, displayName: "入口选手" + i },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await page.request.post(api + "/auth/login", {
          headers: { Origin: base },
          data: credentials,
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await page.request.post(
          api + "/tournaments/" + tid + "/registrations",
          {
            headers: { Origin: base, "Idempotency-Key": "join" },
            data: { schemaVersion: 1, answers: {} },
          },
        )
      ).ok(),
    ).toBeTruthy();
  }
  expect(
    (
      await page.request.post(api + "/auth/login", {
        headers: { Origin: base },
        data: {
          username: "parameter_owner",
          password: "test-parameter-password",
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto(base + "/manage/" + tid + "/registration");
  for (let i = 1; i <= 4; i++) {
    const row = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "入口选手" + i, exact: true }),
    });
    await row
      .getByRole("spinbutton", { name: "入口位置", exact: true })
      .fill(String(i));
    await row.getByRole("button", { name: "审批并分配", exact: true }).click();
    await expect(row).toContainText("已审批");
  }
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "锁定参赛名单", exact: true }).click();
  await expect(
    page.getByText("已锁定名单，前往整轮推进选择冻结配置并开赛。", {
      exact: true,
    }),
  ).toBeVisible();
  const regs = (
    await (
      await page.request.get(api + "/tournaments/" + tid + "/registrations")
    ).json()
  ).data;
  expect(
    regs.items.every(
      (r: any) =>
        r.entryRef.configurationId === cid && r.entryRef.port === "seed",
    ),
  ).toBeTruthy();
  await page.goto(base + "/manage/" + tid + "/rounds");
  await page
    .getByRole("combobox", { name: "开赛配置", exact: true })
    .selectOption(cid);
  await expect(
    page.getByText("新版赛制使用冻结参数；BO等规则请在冻结前修改。", {
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "开始赛事", exact: true }).click();
  await expect(page.locator(".match-card")).toHaveCount(2);
  for (const card of await page.locator(".match-card").all()) {
    await card
      .getByRole("spinbutton", { name: "左方比分", exact: true })
      .fill("3");
    await card
      .getByRole("spinbutton", { name: "右方比分", exact: true })
      .fill("0");
    await card
      .getByRole("textbox", { name: "裁定原因", exact: true })
      .fill("独立资格算例");
    await card.getByRole("button", { name: "裁定赛果", exact: true }).click();
    await expect(card).toContainText("已裁定");
  }
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "确认整轮并推进", exact: true })
    .click();
  await expect(
    page.getByText("资格集合（2人）", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("赛事已完成", { exact: true })).toBeVisible();
  await expect(page.locator(".winner")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("资格集合（2人）", { exact: true }),
  ).toBeVisible();
});

async function approveSingleRosterUI(
  page: Page,
  count: number,
  lock = true,
  upperCount = count,
) {
  const api = base + "/api/v1";
  expect(
    (
      await page.request.patch(api + "/tournaments/" + tid, {
        headers: { Origin: base, "Idempotency-Key": "public" },
        data: { expectedVersion: 1, visibility: "public" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.post(
        api + "/tournaments/" + tid + "/registration-form/publish",
        {
          headers: { Origin: base, "Idempotency-Key": "publish" },
          data: { expectedVersion: 0 },
        },
      )
    ).ok(),
  ).toBeTruthy();
  for (let i = 1; i <= count; i++) {
    if (i > 1 && (i - 1) % 8 === 0) testClock += 15 * 60 * 1000 + 1;
    const credentials = {
      username: "run_entry_" + i,
      password: "entry-browser-password",
    };
    expect(
      (
        await page.request.post(api + "/auth/register", {
          headers: { Origin: base },
          data: { ...credentials, displayName: "运行选手" + i },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await page.request.post(api + "/auth/login", {
          headers: { Origin: base },
          data: credentials,
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await page.request.post(
          api + "/tournaments/" + tid + "/registrations",
          {
            headers: { Origin: base, "Idempotency-Key": "join" },
            data: { schemaVersion: 1, answers: {} },
          },
        )
      ).ok(),
    ).toBeTruthy();
  }
  expect(
    (
      await page.request.post(api + "/auth/login", {
        headers: { Origin: base },
        data: {
          username: "parameter_owner",
          password: "test-parameter-password",
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto(base + "/manage/" + tid + "/registration");
  for (let i = 1; i <= count; i++) {
    const row = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "运行选手" + i, exact: true }),
    });
    if (upperCount !== count) {
      const options = row.getByRole("combobox", {
        name: "初始阶段或小组",
        exact: true,
      });
      const value = await options
        .locator("option")
        .filter({ hasText: i <= upperCount ? "胜者入口" : "败者入口" })
        .first()
        .getAttribute("value");
      await options.selectOption(value!);
    }
    await row
      .getByRole("spinbutton", { name: "入口位置", exact: true })
      .fill(String(i <= upperCount ? i : i - upperCount));
    await row.getByRole("button", { name: "审批并分配", exact: true }).click();
    await expect(row).toContainText("已审批");
  }
  if (!lock) return;
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "锁定参赛名单", exact: true }).click();
  await expect(
    page.getByText("已锁定名单，前往整轮推进选择冻结配置并开赛。", {
      exact: true,
    }),
  ).toBeVisible();
}
test("PR5 切换审批配置等待入口载入，保留另一配置已审批身份", async ({
  page,
}) => {
  const endpoint = base + "/api/v1/tournaments/" + tid + "/configurations";
  const ids: string[] = [];
  for (const i of [1, 2]) {
    const created = await page.request.post(endpoint, {
      headers: { Origin: base, "Idempotency-Key": "config-" + i },
      data: {
        payload: {
          entrantKind: "individual",
          structureVersion: "structure-v2",
          routingVersion: "routing-v2",
          stages: [
            {
              id: "s",
              name: "配置" + i,
              order: 1,
              format: "single-elimination",
              ruleVersion: "single-cut-v2",
              groupSize: 4,
              groupCount: 1,
              qualifyCount: 1,
              groups: [{ id: "g", stageId: "s" }],
            },
          ],
          pools: [],
          routes: [],
        },
      },
    });
    expect(created.ok()).toBeTruthy();
    const c = (await created.json()).data;
    ids.push(c.id);
    const frozen = await page.request.post(endpoint + "/" + c.id + "/freeze", {
      headers: { Origin: base, "Idempotency-Key": "freeze-" + i },
      data: { expectedVersion: c.version },
    });
    expect(frozen.ok()).toBeTruthy();
  }
  await approveSingleRosterUI(page, 4, false);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const requested = new Promise<void>((r) => {
    entered = r;
  });
  await page.route("**/stages?configurationId=" + ids[0], async (route) => {
    entered();
    await gate;
    await route.continue();
  });
  const row = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "运行选手1", exact: true }),
  });
  try {
    await page
      .getByRole("combobox", { name: "审批配置", exact: true })
      .selectOption(ids[0]);
    await requested;
    await expect(
      row.getByRole("button", { name: "审批并分配", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "锁定参赛名单", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(row.getByRole("alert")).toContainText(
    "已保存的入口不属于当前审批配置",
  );
  await expect(
    row.getByRole("button", { name: "审批并分配", exact: true }),
  ).toBeDisabled();
  const list = await page.request.get(
    base + "/api/v1/tournaments/" + tid + "/registrations",
  );
  expect(
    (await list.json()).data.items.every(
      (r: any) => r.entryRef.configurationId === ids[1],
    ),
  ).toBeTruthy();
  await row
    .getByRole("combobox", { name: "初始阶段或小组", exact: true })
    .selectOption(JSON.stringify([ids[0], "g", "seed"]));
  await expect(
    row.getByRole("button", { name: "审批并分配", exact: true }),
  ).toBeEnabled();
});
for (const width of [360, 768, 1440])
  test("ER1 季军与决赛独立BO真实确认与刷新 " + width, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    const cid = await emptyPage(page);
    await page.getByText("高级赛制参数", { exact: true }).click();
    await page.getByRole("checkbox", { name: "季军战", exact: true }).check();
    await page
      .getByRole("combobox", { name: "决赛BO", exact: true })
      .selectOption("7");
    await page
      .getByRole("combobox", { name: "季军战BO", exact: true })
      .selectOption("1");
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("阶段已保存");
    await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
    await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
    await page
      .getByRole("dialog", { name: "确认冻结结构" })
      .getByRole("button", { name: "确认冻结", exact: true })
      .click();
    await expect(
      page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
    ).toBeVisible();
    await approveSingleRosterUI(page, 8);
    await page.goto(base + "/manage/" + tid + "/rounds");
    await page
      .getByRole("combobox", { name: "开赛配置", exact: true })
      .selectOption(cid);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "开始赛事", exact: true }).click();
    for (let round = 1; round <= 3; round++) {
      const block = page
        .locator(".round-block")
        .filter({ has: page.getByRole("heading", { name: /当前轮/ }) });
      await expect(block).toBeVisible();
      const cards = block.locator(".match-card");
      await expect(cards).toHaveCount(round === 1 ? 4 : 2);
      for (const card of await cards.all()) {
        const label = await card.locator("small").first().innerText();
        const target = label.includes("季军战")
          ? 1
          : label.includes("决赛")
            ? 4
            : 2;
        await card
          .getByRole("spinbutton", { name: "左方比分", exact: true })
          .fill(String(target));
        await card
          .getByRole("spinbutton", { name: "右方比分", exact: true })
          .fill("0");
        await card
          .getByRole("textbox", { name: "裁定原因", exact: true })
          .fill("三宽度独立左胜算例");
        await card
          .getByRole("button", { name: "裁定赛果", exact: true })
          .click();
        await expect(card).toContainText("已裁定");
      }
      if (round === 3) {
        await expect(cards.filter({ hasText: "决赛 ·" })).toContainText("BO7");
        await expect(cards.filter({ hasText: "季军战 ·" })).toContainText(
          "BO1",
        );
      }
      page.once("dialog", (d) => d.accept());
      await block
        .getByRole("button", { name: "确认整轮并推进", exact: true })
        .click();
    }
    await expect(page.getByText("赛事已完成", { exact: true })).toBeVisible();
    await expect(page.locator(".winner")).toContainText("运行选手1");
    await expect(page.locator(".match-card")).toHaveCount(8);
    await page.reload();
    await expect(page.locator(".match-card")).toHaveCount(8);
    const rows = page
      .getByRole("table", { name: "最终排名" })
      .locator("tbody tr");
    await expect(rows.nth(2)).toContainText("运行选手4");
    await expect(rows.nth(3)).toContainText("运行选手3");
    expect(errors).toEqual([]);
    await page.screenshot({
      path: resolve(
        "../openspec/changes/optimize-tournament-planning-and-schedules/evidence/single-third-" +
          width +
          ".png",
      ),
      fullPage: true,
    });
  });

for (const width of [360, 768, 1440])
  test("ER1 GSL 五场三批次有序出线与刷新 " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const cid = await emptyPage(page);
    await page
      .getByRole("combobox", { name: "赛制", exact: true })
      .selectOption("gsl-classic-v1");
    await page
      .getByRole("combobox", { name: "小组数量", exact: true })
      .selectOption("1");
    await page.getByRole("button", { name: "创建阶段", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("阶段已保存");
    await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
    await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
    await page
      .getByRole("dialog", { name: "确认冻结结构" })
      .getByRole("button", { name: "确认冻结", exact: true })
      .click();
    await expect(
      page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
    ).toBeVisible();
    await approveSingleRosterUI(page, 4);
    await page.goto(base + "/manage/" + tid + "/rounds");
    await page
      .getByRole("combobox", { name: "开赛配置", exact: true })
      .selectOption(cid);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "开始赛事", exact: true }).click();
    for (let wave = 1; wave <= 3; wave++) {
      const block = page
        .locator(".round-block")
        .filter({ has: page.getByRole("heading", { name: /当前轮/ }) });
      const cards = block.locator(".match-card");
      await expect(cards).toHaveCount(wave === 3 ? 1 : 2);
      for (const card of await cards.all()) {
        const rightWins = (
          await card.locator("small").first().innerText()
        ).includes("淘汰轮");
        await card
          .getByRole("spinbutton", { name: "左方比分", exact: true })
          .fill(rightWins ? "0" : "2");
        await card
          .getByRole("spinbutton", { name: "右方比分", exact: true })
          .fill(rightWins ? "2" : "0");
        await card
          .getByRole("textbox", { name: "裁定原因", exact: true })
          .fill("独立GSL A/B/C/D算例");
        await card
          .getByRole("button", { name: "裁定赛果", exact: true })
          .click();
        await expect(card).toContainText("已裁定");
      }
      page.once("dialog", (d) => d.accept());
      await block
        .getByRole("button", { name: "确认整轮并推进", exact: true })
        .click();
    }
    await expect(page.getByText("赛事已完成", { exact: true })).toBeVisible();
    await expect(page.locator(".match-card")).toHaveCount(5);
    await page.reload();
    const rows = page
      .getByRole("table", { name: "最终资格与战绩" })
      .locator("tbody tr");
    await expect(
      page.getByText("有序出线：运行选手1 → 运行选手2", { exact: true }),
    ).toBeVisible();
    for (const [i, n] of [1, 2, 3, 4].entries())
      await expect(rows.nth(i)).toContainText("运行选手" + n);
    await page.screenshot({
      path: resolve(
        "../openspec/changes/optimize-tournament-planning-and-schedules/evidence/gsl-runtime-" +
          width +
          ".png",
      ),
      fullPage: true,
    });
  });
for (const width of [360, 768, 1440])
  for (const rule of ["round-robin-v2", "double-round-robin-v2"])
    test(`CW7 循环真实运行与完整图一致 ${rule} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const cid = await emptyPage(page);
      await page
        .getByRole("combobox", { name: "赛制", exact: true })
        .selectOption(rule);
      await page.getByRole("button", { name: "创建阶段", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("阶段已保存");
      const groupId = (await configuration(page, cid)).stages[0].groups[0].id;
      await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
      await page
        .getByRole("button", { name: "冻结结构…", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "确认冻结结构" })
        .getByRole("button", { name: "确认冻结", exact: true })
        .click();
      await expect(
        page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
      ).toBeVisible();
      await approveSingleRosterUI(page, 4);
      await page.goto(base + "/manage/" + tid + "/rounds");
      await page
        .getByRole("combobox", { name: "开赛配置", exact: true })
        .selectOption(cid);
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "开始赛事", exact: true }).click();
      const rounds = rule === "round-robin-v2" ? 3 : 6;
      for (let round = 1; round <= rounds; round++) {
        const block = page.locator(".round-block").filter({
          has: page.getByRole("heading", {
            name: `第 ${round} 轮 · 当前轮`,
            exact: true,
          }),
        });
        await expect(block).toBeVisible();
        const cards = block.locator(".match-card");
        await expect(cards).toHaveCount(2);
        for (const card of await cards.all()) {
          const names = [...(await card.innerText()).matchAll(/运行选手(\d+)/g)]
            .slice(0, 2)
            .map((m) => Number(m[1]));
          expect(names).toHaveLength(2);
          await card
            .getByRole("spinbutton", { name: "左方比分", exact: true })
            .fill(names[0] < names[1] ? "2" : "0");
          await card
            .getByRole("spinbutton", { name: "右方比分", exact: true })
            .fill(names[0] < names[1] ? "0" : "2");
          await card
            .getByRole("textbox", { name: "裁定原因", exact: true })
            .fill("按初始种子独立循环算例");
          await card
            .getByRole("button", { name: "裁定赛果", exact: true })
            .click();
          await expect(card).toContainText("已裁定");
        }
        page.once("dialog", (d) => d.accept());
        await block
          .getByRole("button", { name: "确认整轮并推进", exact: true })
          .click();
      }
      await expect(page.getByText("赛事已完成", { exact: true })).toBeVisible();
      await expect(page.locator(".match-card")).toHaveCount(rounds * 2);
      await page.reload();
      await page.goto(
        base + "/manage/" + tid + "/configurations/" + cid + "/graph",
      );
      await page
        .getByRole("combobox", { name: "查看比赛子图", exact: true })
        .selectOption(groupId);
      await expect(page.locator('[data-kind="match"]')).toHaveCount(rounds * 2);
      await expect(
        page
          .locator('[data-kind="match"] .plan-node-status')
          .filter({ hasText: "已确认" }),
      ).toHaveCount(rounds * 2);
    });

for (const width of [360, 768, 1440])
  for (const [mode, reset, lowerWins] of [
    ["disabled", false, false],
    ["disabled", true, false],
    ["disabled", true, true],
    ["half", true, true],
    ["same", true, true],
  ] as const)
    test(`ER2 双败具名入口与条件决赛 ${mode} ${reset} ${lowerWins} ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const cid = await emptyPage(page);
      await page
        .getByRole("combobox", { name: "赛制", exact: true })
        .selectOption(
          mode === "disabled" ? "de-standard-v1" : "de-lower-entry-v1",
        );
      await page
        .getByRole("combobox", { name: "每组人数", exact: true })
        .selectOption("4");
      await page.getByText("高级赛制参数", { exact: true }).click();
      if (mode !== "disabled")
        await page
          .getByRole("combobox", { name: "败者直接输入", exact: true })
          .selectOption(mode);
      if (reset)
        await page
          .getByRole("checkbox", { name: "决赛重置", exact: true })
          .check();
      await page
        .getByRole("combobox", { name: "决赛BO", exact: true })
        .selectOption("5");
      await page.getByRole("button", { name: "创建阶段", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("阶段已保存");
      await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
      await page
        .getByRole("button", { name: "冻结结构…", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "确认冻结结构" })
        .getByRole("button", { name: "确认冻结", exact: true })
        .click();
      await expect(
        page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
      ).toBeVisible();
      await approveSingleRosterUI(
        page,
        mode === "same" ? 8 : mode === "half" ? 6 : 4,
        true,
        4,
      );
      await page.goto(base + "/manage/" + tid + "/rounds");
      await page
        .getByRole("combobox", { name: "开赛配置", exact: true })
        .selectOption(cid);
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "开始赛事", exact: true }).click();
      if (reset)
        await expect(
          page.getByText("重置决赛：等待首次总决赛，败者组冠军获胜后才激活。", {
            exact: true,
          }),
        ).toBeVisible();
      let finals = 0;
      for (let wave = 0; wave < 7; wave++) {
        const block = page.locator(".round-block").filter({
          has: page.getByRole("heading", {
            name: `第 ${wave + 1} 轮 · 当前轮`,
            exact: true,
          }),
        });
        await expect(block).toBeVisible();
        for (const card of await block.locator(".match-card").all()) {
          const label = await card.locator("small").first().innerText(),
            isFinal = label.startsWith("决赛 ·"),
            right = isFinal && finals === 0 && lowerWins;
          if (isFinal) finals++;
          await card
            .getByRole("spinbutton", { name: "左方比分", exact: true })
            .fill(right ? "0" : isFinal ? "3" : "2");
          await card
            .getByRole("spinbutton", { name: "右方比分", exact: true })
            .fill(right ? "3" : "0");
          await card
            .getByRole("textbox", { name: "裁定原因", exact: true })
            .fill("独立双败确认算例");
          await card
            .getByRole("button", { name: "裁定赛果", exact: true })
            .click();
          await expect(card).toContainText("已裁定");
        }
        page.once("dialog", (d) => d.accept());
        await block
          .getByRole("button", { name: "确认整轮并推进", exact: true })
          .click();
        if (finals === (reset && lowerWins ? 2 : 1)) break;
      }
      await expect(page.getByText("赛事已完成", { exact: true })).toBeVisible();
      const games =
        6 +
        (mode === "half" ? 2 : mode === "same" ? 4 : 0) +
        (reset && lowerWins ? 1 : 0);
      await expect(page.locator(".match-card")).toHaveCount(games);
      await page.reload();
      await expect(page.locator(".match-card")).toHaveCount(games);
      if (reset && !lowerWins)
        await expect(
          page.getByText("重置决赛：条件未满足，未激活。", { exact: true }),
        ).toBeVisible();
      await page.screenshot({
        path: resolve(
          `../openspec/changes/optimize-tournament-planning-and-schedules/evidence/de-${mode}-${reset}-${lowerWins}-${width}.png`,
        ),
        fullPage: true,
      });
    });

for (const width of [360, 768, 1440])
  for (const rule of [
    "swiss-fixed-v1",
    "swiss-threshold-v1",
    "major-cologne-2026-v1",
  ])
    test(`ER3 瑞士真实出轮小分和刷新 ${rule} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const cid = await emptyPage(page);
      await page
        .getByRole("combobox", { name: "赛制", exact: true })
        .selectOption(rule);
      if (rule === "swiss-fixed-v1") {
        await page
          .getByRole("combobox", { name: "每组人数", exact: true })
          .selectOption("8");
        await page
          .getByRole("combobox", { name: "每组晋级人数", exact: true })
          .selectOption("4");
      }
      await page.getByText("高级赛制参数", { exact: true }).click();
      if (rule === "swiss-fixed-v1")
        await page
          .getByRole("combobox", { name: "轮数", exact: true })
          .selectOption("3");
      else {
        await page
          .getByRole("combobox", { name: "默认BO", exact: true })
          .selectOption("1");
        await page
          .getByRole("combobox", { name: "晋级战BO", exact: true })
          .selectOption("3");
        await page
          .getByRole("combobox", { name: "淘汰战BO", exact: true })
          .selectOption(rule === "major-cologne-2026-v1" ? "3" : "5");
      }
      await page.getByRole("button", { name: "创建阶段", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("阶段已保存");
      await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
      await page
        .getByRole("button", { name: "冻结结构…", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "确认冻结结构" })
        .getByRole("button", { name: "确认冻结", exact: true })
        .click();
      await expect(
        page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
      ).toBeVisible();
      await approveSingleRosterUI(page, rule === "swiss-fixed-v1" ? 8 : 16);
      await page.goto(base + "/manage/" + tid + "/rounds");
      await page
        .getByRole("combobox", { name: "开赛配置", exact: true })
        .selectOption(cid);
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "开始赛事", exact: true }).click();
      const counts = rule === "swiss-fixed-v1" ? [4, 4, 4] : [8, 8, 8, 6, 3];
      for (const [wave, count] of counts.entries()) {
        const block = page.locator(".round-block").filter({
          has: page.getByRole("heading", {
            name: `第 ${wave + 1} 轮 · 当前轮`,
            exact: true,
          }),
        });
        await expect(block.locator(".match-card")).toHaveCount(count);
        for (const card of await block.locator(".match-card").all()) {
          const label = await card.locator("small").first().innerText(),
            bo = Number(label.match(/BO(\d+)/)![1]);
          await card
            .getByRole("spinbutton", { name: "左方比分", exact: true })
            .fill(String((bo + 1) / 2));
          await card
            .getByRole("spinbutton", { name: "右方比分", exact: true })
            .fill("0");
          await card
            .getByRole("textbox", { name: "裁定原因", exact: true })
            .fill("独立瑞士完整算例");
          await card
            .getByRole("button", { name: "裁定赛果", exact: true })
            .click();
          await expect(card).toContainText("已裁定");
        }
        page.once("dialog", (d) => d.accept());
        await block
          .getByRole("button", { name: "确认整轮并推进", exact: true })
          .click();
      }
      await expect(page.getByText("赛事已完成", { exact: true })).toBeVisible();
      await expect(page.locator(".match-card")).toHaveCount(
        rule === "swiss-fixed-v1" ? 12 : 33,
      );
      await page.reload();
      await expect(
        page.getByRole("table", { name: "最终资格与战绩" }),
      ).toBeVisible();
      await page.getByText("瑞士排名规则与小分来源", { exact: true }).click();
      await expect(page.getByText(/排序顺序：/)).toContainText(
        rule === "swiss-fixed-v1" ? "对手积分和" : "对手胜负差",
      );
      await expect(
        page.getByRole("columnheader", { name: "净胜局", exact: true }),
      ).toBeVisible();
      if (width === 360) {
        const tableRegion = page.getByRole("region", {
          name: "瑞士战绩表",
          exact: true,
        });
        expect(
          await tableRegion.evaluate((el) => el.scrollWidth > el.clientWidth),
        ).toBeTruthy();
        await tableRegion.focus();
        await page.keyboard.press("ArrowRight");
        await expect
          .poll(() => tableRegion.evaluate((el) => el.scrollLeft))
          .toBeGreaterThan(0);
        await tableRegion.evaluate((el) => {
          el.scrollLeft = 0;
        });
        await tableRegion.screenshot({
          path: resolve(
            `../openspec/changes/optimize-tournament-planning-and-schedules/evidence/${rule}-table-360.png`,
          ),
        });
      }
      await page.screenshot({
        path: resolve(
          `../openspec/changes/optimize-tournament-planning-and-schedules/evidence/${rule}-${width}.png`,
        ),
        fullPage: true,
      });
    });

async function swissFourUI(page: Page, ranking = false) {
  const cid = await emptyPage(page);
  await page
    .getByRole("combobox", { name: "赛制", exact: true })
    .selectOption("swiss-fixed-v1");
  await page
    .getByRole("combobox", { name: "每组人数", exact: true })
    .selectOption("4");
  await page
    .getByRole("combobox", { name: "每组晋级人数", exact: true })
    .selectOption(ranking ? "1" : "2");
  await page.getByText("高级赛制参数", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "轮数", exact: true })
    .selectOption(ranking ? "1" : "3");
  if (ranking) {
    await page
      .getByRole("button", { name: "移除排序字段", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "移除排序字段", exact: true })
      .first()
      .click();
    await page
      .getByRole("combobox", { name: "第2排序字段", exact: true })
      .selectOption("manual-with-reason");
  }
  await page.getByRole("button", { name: "创建阶段", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
  await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
  await page
    .getByRole("dialog", { name: "确认冻结结构" })
    .getByRole("button", { name: "确认冻结", exact: true })
    .click();
  await expect(
    page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
  ).toBeVisible();
  await approveSingleRosterUI(page, 4);
  await page.goto(base + "/manage/" + tid + "/rounds");
  await page
    .getByRole("combobox", { name: "开赛配置", exact: true })
    .selectOption(cid);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "开始赛事", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "第 1 轮 · 当前轮", exact: true }),
  ).toBeVisible();
}
for (const width of [360, 768, 1440]) {
  test(`ER4 瑞士切线同分留因裁定 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await swissFourUI(page, true);
    const block = page.locator(".round-block").filter({
      has: page.getByRole("heading", {
        name: "第 1 轮 · 当前轮",
        exact: true,
      }),
    });
    for (const card of await block.locator(".match-card").all()) {
      await card
        .getByRole("spinbutton", { name: "左方比分", exact: true })
        .fill("2");
      await card
        .getByRole("spinbutton", { name: "右方比分", exact: true })
        .fill("0");
      await card
        .getByRole("textbox", { name: "裁定原因", exact: true })
        .fill("同分切线真实算例");
      await card.getByRole("button", { name: "裁定赛果", exact: true }).click();
      await expect(card).toContainText("已裁定");
    }
    page.once("dialog", (d) => d.accept());
    await block
      .getByRole("button", { name: "确认整轮并推进", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "同分排名待裁定", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("赛事已完成", { exact: true }),
    ).not.toBeVisible();
    await page
      .getByRole("button", { name: "上移 运行选手2", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "排名裁定原因", exact: true })
      .fill("并列者采用已核对的裁定顺序");
    await page
      .getByRole("button", { name: "确认并列顺序", exact: true })
      .click();
    await expect(page.getByText("赛事已完成", { exact: true })).toBeVisible();
    await expect(page.locator(".winner")).toContainText("运行选手2");
    await page.reload();
    await expect(page.locator(".winner")).toContainText("运行选手2");
  });
  test(`ER3 完整人工配对保留原键恢复丢失响应 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await swissFourUI(page);
    const {
        read,
        save,
      } = require("../../backend/src/platform/operations/state"),
      s = read(platform.db, tid),
      u = s.runtime.units[0];
    // Simulate a solver-budget blocked fixture, rather than claiming this easy
    // four-player table naturally exhausts the solver.
    u.rounds = [];
    u.status = "pairing-blocked";
    u.pairingBlock = { code: "PAIRING_SOLVER_LIMIT", round: 1, nodes: 250001 };
    save(platform.db, tid, s);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "瑞士配对待裁定", exact: true }),
    ).toBeVisible();
    const selections = [
      [1, 3],
      [2, 4],
    ];
    for (const [i, pair] of selections.entries())
      for (const [side, n] of pair.entries())
        await page
          .getByRole("combobox", {
            name: `第${i + 1}场${side === 0 ? "左方" : "右方"}`,
            exact: true,
          })
          .selectOption({ label: "运行选手" + n });
    await page
      .getByRole("textbox", { name: "配对裁定原因", exact: true })
      .fill("完整首轮表人工复核");
    const keys: string[] = [];
    let dropped = false;
    await page.route("**/units/" + u.id + "/pairing", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      if (!dropped) {
        dropped = true;
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await page
      .getByRole("button", { name: "确认完整人工配对", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "重试", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "第 1 轮 · 当前轮", exact: true }),
    ).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    await expect(
      page.getByText("人工配对裁定：完整首轮表人工复核", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator(".match-card")).toHaveCount(2);
  });
}

for (const width of [360, 768, 1440])
  for (const [rule, count, kind] of [
    ["single-cut-v2", 7, "match"],
    ["de-standard-v1", 15, "match"],
    ["swiss-fixed-v1", 4, "window"],
    ["gsl-classic-v1", 5, "match"],
    ["round-robin-v2", 6, "match"],
    ["double-round-robin-v2", 12, "match"],
  ] as const)
    test(`CW7 完整子图布局与未来来源 ${rule} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const cid = await emptyPage(page);
      await page
        .getByRole("combobox", { name: "赛制", exact: true })
        .selectOption(rule);
      if (rule === "de-standard-v1") {
        await page.getByText("高级赛制参数", { exact: true }).click();
        await page
          .getByRole("checkbox", { name: "决赛重置", exact: true })
          .check();
      }
      await page.getByRole("button", { name: "创建阶段", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("阶段已保存");
      const c = await configuration(page, cid),
        groupId = c.stages[0].groups[0].id;
      await page.getByRole("link", { name: "赛制画布", exact: true }).click();
      await page
        .getByRole("combobox", { name: "查看比赛子图", exact: true })
        .selectOption(groupId);
      await expect(page.locator(`[data-kind="${kind}"]`)).toHaveCount(count);
      if (rule === "de-standard-v1")
        await expect(
          page.locator(".plan-condition .plan-node-status"),
        ).toContainText("条件决赛，尚未激活");
      const node = page.locator(`[data-kind="${kind}"]`).first(),
        key = (await node.getAttribute("data-plan-key"))!;
      await node.getByRole("button", { name: /^移动/ }).focus();
      await page.keyboard.press("ArrowRight");
      await page
        .getByRole("button", { name: "保存画布布局", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "布局已保存" }),
      ).toBeVisible();
      const layout = (
        await (
          await page.request.get(
            base +
              "/api/v1/tournaments/" +
              tid +
              "/configurations/" +
              cid +
              "/layout",
          )
        ).json()
      ).data;
      expect(layout.positions[key]).toBeDefined();
      await page.reload();
      await page
        .getByRole("combobox", { name: "查看比赛子图", exact: true })
        .selectOption(groupId);
      await expect(page.locator(`[data-kind="${kind}"]`)).toHaveCount(count);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: resolve(
          `../openspec/changes/optimize-tournament-planning-and-schedules/evidence/graph-${rule}-${width}.png`,
        ),
        fullPage: true,
      });
    });

async function frozenSchedulePage(page: Page, rule = "single-cut-v2") {
  const cid = await emptyPage(page);
  await page
    .getByRole("combobox", { name: "赛制", exact: true })
    .selectOption(rule);
  if (rule === "gsl-classic-v1")
    await page
      .getByRole("combobox", { name: "小组数量", exact: true })
      .selectOption("1");
  await page.getByRole("button", { name: "创建阶段", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("阶段已保存");
  await page.getByRole("link", { name: "校验与冻结", exact: true }).click();
  await page.getByRole("button", { name: "冻结结构…", exact: true }).click();
  await page
    .getByRole("dialog", { name: "确认冻结结构" })
    .getByRole("button", { name: "确认冻结", exact: true })
    .click();
  await expect(
    page.getByText("结构已冻结，赛事尚未启动。", { exact: true }),
  ).toBeVisible();
  const c = await configuration(page, cid),
    keys = c.snapshot.plan.units[0].matches
      .filter((m: any) => m.round === 1)
      .slice(0, 2)
      .map((m: any) => m.planKey),
    payload = {
      configurationId: cid,
      resources: [
        { id: "a", name: "A台" },
        { id: "b", name: "B台" },
      ],
      windows: [
        {
          id: "w",
          name: "开幕",
          startsAt: "2030-01-01T00:00:00Z",
          offsetMinutes: 480,
          durationMinutes: 60,
          minRestMinutes: 0,
        },
      ],
      assignments: keys.map((planKey: string, i: number) => ({
        planKey,
        windowId: "w",
        resourceId: i ? "b" : "a",
      })),
    };
  const url = base + "/api/v1/tournaments/" + tid + "/schedule",
    out = await page.request.put(url, {
      headers: { Origin: base, "Idempotency-Key": "prepare-time" },
      data: { expectedVersion: 0, payload },
    });
  expect(out.ok(), await out.text()).toBeTruthy();
  return { cid, payload, url };
}
test("SC3 时间响应丢失原键恢复及409保留本地输入", async ({ page }) => {
  const { url } = await frozenSchedulePage(page);
  await page.goto(base + "/manage/" + tid + "/schedule");
  const minutes = page.getByRole("spinbutton", {
    name: "窗口时长 开幕",
    exact: true,
  });
  await minutes.fill("45");
  let lost = false;
  const keys: string[] = [];
  await page.route("**/api/v1/tournaments/*/schedule", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    keys.push(route.request().headers()["idempotency-key"]);
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "STORE_FAILURE",
            message: "已提交但响应丢失",
            retryable: true,
          },
        }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "保存时间计划", exact: true }).click();
  await expect(minutes).toHaveValue("45");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "时间计划已保存" }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute("**/api/v1/tournaments/*/schedule");
  const stored = (await (await page.request.get(url)).json()).data.schedule,
    { version, structureDigest, planDigest, validation, ...payload } = stored;
  payload.windows[0].durationMinutes = 30;
  expect(
    (
      await page.request.put(url, {
        headers: { Origin: base, "Idempotency-Key": "concurrent-time" },
        data: { expectedVersion: 2, payload },
      })
    ).ok(),
  ).toBeTruthy();
  await minutes.fill("20");
  await page.getByRole("button", { name: "保存时间计划", exact: true }).click();
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByText(/服务器时间计划版本 3/)).toBeVisible();
  await expect(minutes).toHaveValue("20");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "保留本地时间计划并使用新版本", exact: true })
    .click();
  await page.getByRole("button", { name: "保存时间计划", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "时间计划已保存" }),
  ).toBeVisible();
  const saved = (await (await page.request.get(url)).json()).data.schedule;
  expect(saved.version).toBe(4);
  expect(saved.windows[0].durationMinutes).toBe(20);
});
test("SC3 实际开始明确确认并锁定原时间，不把预计2030当实际", async ({
  page,
}) => {
  const { cid, url } = await frozenSchedulePage(page, "gsl-classic-v1");
  await approveSingleRosterUI(page, 4);
  await page.goto(base + "/manage/" + tid + "/rounds");
  await page
    .getByRole("combobox", { name: "开赛配置", exact: true })
    .selectOption(cid);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "开始赛事", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "第 1 轮 · 当前轮", exact: true }),
  ).toBeVisible();
  await page.goto(base + "/manage/" + tid + "/schedule");
  const cards = page.locator(".schedule-time-slot .schedule-match");
  await expect(cards).toHaveCount(2);
  page.once("dialog", (d) => d.accept());
  await cards
    .first()
    .getByRole("button", { name: "标记实际开赛", exact: true })
    .click();
  await expect(cards.first()).toContainText("实际开始：");
  await expect(
    page.getByRole("spinbutton", { name: "窗口时长 开幕", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(cards.first()).toContainText("计划锁定");
  const data = (await (await page.request.get(url)).json()).data;
  expect(data.schedule.version).toBe(1);
  expect(data.runtime.units[0].rounds[0].matches[0].actualStartedAt).not.toBe(
    data.schedule.windows[0].startsAt,
  );
  const firstKey = data.schedule.assignments[0].planKey;
  await cards
    .nth(1)
    .getByRole("button", { name: "取消安排", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "时间窗口名称", exact: true })
    .fill("重排");
  await page
    .getByLabel("窗口开始时间", { exact: true })
    .fill("2030-01-01T10:00");
  await page.getByRole("button", { name: "添加时间窗口", exact: true }).click();
  await page
    .getByRole("region", { name: "待安排比赛", exact: true })
    .getByRole("checkbox")
    .first()
    .check();
  await page
    .getByRole("combobox", { name: "批量安排窗口", exact: true })
    .selectOption({ label: "重排" });
  await page
    .getByRole("combobox", { name: "批量安排比赛台", exact: true })
    .selectOption("a");
  await page.getByRole("button", { name: "安排所选比赛", exact: true }).click();
  await page.getByRole("button", { name: "保存时间计划", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "时间计划已保存" }),
  ).toBeVisible();
  const moved = (await (await page.request.get(url)).json()).data.schedule;
  expect(moved.version).toBe(2);
  expect(
    moved.assignments.find((a: any) => a.planKey === firstKey).windowId,
  ).toBe("w");
  expect(moved.windows.find((w: any) => w.id === "w").startsAt).toBe(
    data.schedule.windows[0].startsAt,
  );
  expect(
    moved.assignments.find((a: any) => a.planKey !== firstKey).windowId,
  ).not.toBe("w");
});

test("SC3 实际开赛409重读后明确使用新版本恢复", async ({ page }) => {
  const { cid } = await frozenSchedulePage(page, "gsl-classic-v1");
  await approveSingleRosterUI(page, 4);
  await page.goto(base + "/manage/" + tid + "/rounds");
  await page
    .getByRole("combobox", { name: "开赛配置", exact: true })
    .selectOption(cid);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "开始赛事", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "第 1 轮 · 当前轮", exact: true }),
  ).toBeVisible();
  await page.goto(base + "/manage/" + tid + "/schedule");
  let raced = false;
  await page.route("**/matches/*/actual-start", async (route) => {
    if (!raced) {
      raced = true;
      const out = (
          await (
            await page.request.get(
              base + "/api/v1/tournaments/" + tid + "/runtime",
            )
          ).json()
        ).data,
        other = out.runtime.units[0].rounds[0].matches[1];
      const scored = await page.request.patch(
        base +
          "/api/v1/tournaments/" +
          tid +
          "/matches/" +
          other.id +
          "/results",
        {
          headers: { Origin: base, "Idempotency-Key": "concurrent-score" },
          data: {
            expectedVersion: out.version,
            result: { kind: "score", scores: [2, 0] },
            reason: "另一场并发裁定",
          },
        },
      );
      expect(scored.ok()).toBeTruthy();
    }
    await route.continue();
  });
  const card = page.locator(".schedule-time-slot .schedule-match").first();
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "标记实际开赛", exact: true }).click();
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "按最新状态标记实际开始", exact: true }),
  ).toBeEnabled();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "按最新状态标记实际开始", exact: true })
    .click();
  await expect(card).toContainText("实际开始：");
});

test("SC3 切换冻结配置明确清空旧安排并保留比赛台", async ({ page }) => {
  const { cid, url } = await frozenSchedulePage(page);
  const c = await configuration(page, cid),
    payload = structuredClone(c.snapshot.structure);
  payload.stages[0].name = "第二配置";
  const created = await page.request.post(
      base + "/api/v1/tournaments/" + tid + "/configurations",
      {
        headers: { Origin: base, "Idempotency-Key": "second-configuration" },
        data: { payload },
      },
    ),
    next = (await created.json()).data;
  expect(created.ok()).toBeTruthy();
  expect(
    (
      await page.request.post(
        base +
          "/api/v1/tournaments/" +
          tid +
          "/configurations/" +
          next.id +
          "/freeze",
        {
          headers: { Origin: base, "Idempotency-Key": "second-freeze" },
          data: { expectedVersion: 1 },
        },
      )
    ).ok(),
  ).toBeTruthy();
  await page.goto(base + "/manage/" + tid + "/schedule");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("combobox", { name: "时间计划配置", exact: true })
    .selectOption(next.id);
  await expect(
    page.getByRole("combobox", { name: "时间计划配置", exact: true }),
  ).toHaveValue(next.id);
  await expect(page.locator(".schedule-time-slot")).toHaveCount(0);
  await page.getByRole("button", { name: "保存时间计划", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "时间计划已保存" }),
  ).toBeVisible();
  const saved = (await (await page.request.get(url)).json()).data.schedule;
  expect(saved.configurationId).toBe(next.id);
  expect(saved.windows).toHaveLength(0);
  expect(saved.assignments).toHaveLength(0);
  expect(saved.resources).toHaveLength(2);
  expect(
    (await configuration(page, cid)).snapshot.structure.stages[0].name,
  ).not.toBe("第二配置");
});
