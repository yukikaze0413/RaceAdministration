import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  readdirSync,
  existsSync,
  unlinkSync,
  rmdirSync,
  statSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url),
  { createApp } = require("../../backend/src/app"),
  fixtures = require("../../backend/test/fixtures/reference-cases-v1.json");
let platform: any,
  server: any,
  base: string,
  directory: string,
  database: string;
test.beforeEach(async ({ page }) => {
  directory = mkdtempSync(join(tmpdir(), "race-reference-ui-"));
  database = join(directory, "parent.sqlite");
  platform = createApp({
    databasePath: database,
    origins: [],
    frontendPath: resolve("dist"),
  });
  for (let i = 0; i < 30; i++) {
    server = platform.app.listen(
      25000 + Math.floor(Math.random() * 30000),
      "127.0.0.1",
    );
    const ready = await new Promise<boolean>((r, j) => {
      server.once("listening", () => r(true));
      server.once("error", (e: any) =>
        ["EADDRINUSE", "EACCES"].includes(e.code) ? r(false) : j(e),
      );
    });
    if (ready) break;
    if (i === 29) throw Error("No high test port");
  }
  base = "http://127.0.0.1:" + server.address().port;
  await new Promise<void>((r) => server.close(() => r()));
  platform.close();
  platform = createApp({
    databasePath: database,
    origins: [base],
    frontendPath: resolve("dist"),
  });
  server = platform.app.listen(Number(new URL(base).port), "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  for (const action of ["register", "login"]) {
    const r = await page.request.post(base + "/api/v1/auth/" + action, {
      headers: { Origin: base },
      data: {
        username: "reference_owner",
        password: "reference-test-password",
        ...(action === "register" ? { displayName: "示例主办" } : {}),
      },
    });
    expect(r.ok()).toBeTruthy();
  }
});
test.afterEach(async () => {
  if (server?.listening)
    await new Promise<void>((r) => server.close(() => r()));
  platform?.close();
  const root = resolve(directory, ".reference-demos");
  if (existsSync(root)) {
    for (const name of readdirSync(root)) {
      const file = resolve(root, name);
      expect(dirname(file)).toBe(root);
      expect(statSync(file).isFile()).toBeTruthy();
      unlinkSync(file);
    }
    rmdirSync(root);
  }
  for (const name of [database, database + "-wal", database + "-shm"])
    if (existsSync(name)) unlinkSync(name);
  rmdirSync(directory);
});
async function imported(page: Page, id: string) {
  await page.goto(base + "/reference-cases");
  await page
    .getByRole("combobox", { name: "示例", exact: true })
    .selectOption("ti2026");
  await expect(page.getByRole("status")).toContainText("专用运行器尚未完成");
  await expect(
    page.getByRole("button", { name: "创建独立演示", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "示例", exact: true })
    .selectOption(id);
  const confirm = page.getByRole("checkbox", {
    name: "确认创建独立演示空间",
    exact: true,
  });
  await confirm.focus();
  await page.keyboard.press("Space");
  const response = page.waitForResponse(
    (r) => r.url() === base + "/api/v1/reference-demos" && r.status() === 201,
  );
  await page.getByRole("button", { name: "创建独立演示", exact: true }).focus();
  await page.keyboard.press("Enter");
  const data = (await (await response).json()).data;
  await page.getByRole("link", { name: "进入演示", exact: true }).click();
  await expect(page.locator("aside.notice")).toContainText("隔离演示空间");
  return data;
}
for (const width of [360, 768, 1440])
  for (const example of fixtures.cases)
    test(`RC2/RC3 隔离示例页面全程 ${example.id} ${width}`, async ({
      page,
    }) => {
      test.setTimeout(240000);
      await page.setViewportSize({ width, height: 900 });
      const demo = await imported(page, example.id),
        url = base + demo.prefix,
        api = url + "/api/v1/tournaments/" + demo.tournamentId;
      await page.getByRole("button", { name: /^1\. / }).click();
      for (const bo of ["5", "3"]) {
        await page
          .getByRole("combobox", { name: "默认BO", exact: true })
          .selectOption(bo);
        await page
          .getByRole("button", { name: "保存阶段", exact: true })
          .click();
        await expect(page.getByRole("status")).toContainText("阶段已保存");
        expect(
          (
            await (
              await page.request.get(
                api + "/configurations/" + demo.configurationId,
              )
            ).json()
          ).data.stages[0].parameters.defaultBO,
        ).toBe(Number(bo));
      }
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
      await page.goto(url + "/manage/" + demo.tournamentId + "/registration");
      const shadow = example.id === "shadow-cup-v1";
      for (let i = 1; i <= example.entrantCount; i++) {
        const row = page.getByRole("article").filter({
          has: page.getByRole("heading", {
            name:
              (shadow ? "暗影参赛单位" : "GSL参赛单位") +
              String(i).padStart(2, "0"),
            exact: true,
          }),
        });
        await row
          .getByRole("spinbutton", { name: "初始种子", exact: true })
          .fill(String(i));
        const select = row.getByRole("combobox", {
            name: "初始阶段或小组",
            exact: true,
          }),
          label = shadow
            ? "五轮瑞士 · 小组1 · 种子入口"
            : `四组GSL · 小组${Math.floor((i - 1) / 4) + 1} · 绝对席位入口`;
        await select.selectOption({ label });
        await row
          .getByRole("spinbutton", { name: "入口位置", exact: true })
          .fill(String(shadow ? i : ((i - 1) % 4) + 1));
        await row
          .getByRole("button", { name: "审批并分配", exact: true })
          .click();
        await expect(row).toContainText("已审批");
      }
      page.once("dialog", (d) => d.accept());
      await page
        .getByRole("button", { name: "锁定参赛名单", exact: true })
        .click();
      await expect(
        page.getByText("已锁定名单，前往整轮推进选择冻结配置并开赛。", {
          exact: true,
        }),
      ).toBeVisible();
      await page.goto(url + "/manage/" + demo.tournamentId + "/rounds");
      await page
        .getByRole("combobox", { name: "开赛配置", exact: true })
        .selectOption(demo.configurationId);
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "开始赛事", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await (await page.request.get(api + "/runtime")).json()).data
              .runtime?.status,
        )
        .toBe("running");
      const initialRuntime = (
        await (await page.request.get(api + "/runtime")).json()
      ).data.runtime;
      await page.goto(url + "/manage/" + demo.tournamentId + "/schedule");
      for (let n = 1; n <= 16; n++) {
        await page
          .getByRole("textbox", { name: "比赛台名称", exact: true })
          .fill("示例台" + n);
        await page
          .getByRole("button", { name: "添加比赛台", exact: true })
          .click();
      }
      await page
        .getByRole("textbox", { name: "时间窗口名称", exact: true })
        .fill("示例首批");
      await page
        .getByLabel("窗口开始时间", { exact: true })
        .fill("2026-11-01T16:00");
      await page
        .getByRole("combobox", { name: "窗口固定时区", exact: true })
        .selectOption("480");
      await page
        .getByRole("spinbutton", { name: "窗口预计分钟", exact: true })
        .fill("60");
      await page
        .getByRole("spinbutton", { name: "窗口最小休息分钟", exact: true })
        .fill("15");
      if (shadow)
        await page
          .getByRole("combobox", { name: "关联未来瑞士轮次", exact: true })
          .selectOption(initialRuntime.units[0].rounds[0].planKey);
      await page
        .getByRole("button", { name: "添加时间窗口", exact: true })
        .click();
      const pending = page.getByRole("region", {
          name: "待安排比赛",
          exact: true,
        }),
        choices = pending.getByRole("checkbox", {
          name: shadow
            ? /^五轮瑞士 · 小组1 · 第1轮第\d+场/
            : /^四组GSL · 小组1 · 首轮 · 第1轮第[12]场/,
        });
      await expect(choices).toHaveCount(shadow ? 16 : 2);
      for (const check of await choices.all()) await check.check();
      await page
        .getByRole("combobox", { name: "批量安排窗口", exact: true })
        .selectOption({ label: "示例首批" });
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
      await page.reload();
      const timePlan = (
        await (await page.request.get(api + "/schedule")).json()
      ).data.schedule;
      expect(timePlan.assignments).toHaveLength(shadow ? 16 : 2);
      expect(timePlan.windows[0].startsAt).toBe("2026-11-01T08:00:00.000Z");
      await page.goto(url + "/manage/" + demo.tournamentId + "/rounds");
      const games = shadow
        ? [
            ...example.rounds.flatMap((r: any) => r.matches),
            ...example.knockout.flatMap((r: any) => r.matches),
          ]
        : [
            ...example.groups.flatMap((g: any) => g.matches),
            ...example.matches,
          ];
      const runtime = async () =>
        (await (await page.request.get(api + "/runtime")).json()).data.runtime;
      let count = 0;
      while ((await runtime()).status !== "completed") {
        const rt = await runtime(),
          index = rt.units.findIndex((u: any) => u.status !== "completed"),
          u = rt.units[index],
          r = u.rounds.find((r: any) => !r.confirmed);
        expect(r).toBeTruthy();
        const unitGames = r.matches.map((m: any) => {
          const number = Number(m.planKey.split("/").at(-1)),
            id =
              u.id === "swiss"
                ? `swiss/${r.number}/${number}`
                : u.id === "single"
                  ? `single/${m.round}/${number}`
                  : `${u.id}/${m.role}/${m.round}/${number}`;
          const e = games.find((g: any) => g.id === id);
          expect(e).toBeTruthy();
          return { m, e };
        });
        const scheduleState = (
          await (await page.request.get(api + "/schedule")).json()
        ).data.schedule;
        if (
          unitGames.some(
            ({ m }: any) =>
              !scheduleState.assignments.some(
                (a: any) => a.planKey === m.planKey,
              ),
          )
        ) {
          const e = unitGames[0].e;
          await page.goto(url + "/manage/" + demo.tournamentId + "/schedule");
          let window = scheduleState.windows.find(
            (w: any) => w.startsAt === e.startsAt,
          );
          if (!window) {
            const name = "示例批次" + e.wave;
            await page
              .getByRole("textbox", { name: "时间窗口名称", exact: true })
              .fill(name);
            await page
              .getByLabel("窗口开始时间", { exact: true })
              .fill(
                new Date(Date.parse(e.startsAt) + 480 * 60000)
                  .toISOString()
                  .slice(0, 16),
              );
            await page
              .getByRole("combobox", { name: "窗口固定时区", exact: true })
              .selectOption("480");
            await page
              .getByRole("spinbutton", { name: "窗口预计分钟", exact: true })
              .fill("60");
            await page
              .getByRole("spinbutton", {
                name: "窗口最小休息分钟",
                exact: true,
              })
              .fill("15");
            if (u.id === "swiss")
              await page
                .getByRole("combobox", {
                  name: "关联未来瑞士轮次",
                  exact: true,
                })
                .selectOption(r.planKey);
            await page
              .getByRole("button", { name: "添加时间窗口", exact: true })
              .click();
            window = { name };
          }
          await page
            .getByRole("combobox", { name: "批量安排窗口", exact: true })
            .selectOption({ label: window.name });
          const region = page.getByRole("region", {
            name: "待安排比赛",
            exact: true,
          });
          for (const [i, { m }] of unitGames.entries()) {
            if (
              scheduleState.assignments.some(
                (a: any) => a.planKey === m.planKey,
              )
            )
              continue;
            const names = m.entrants.map(
              (id: string) =>
                rt.roster.find((p: any) => p.entrantId === id).name,
            );
            const role = (
              {
                upper: "胜者组",
                lower: "败者组",
                final: "总决赛",
                opening: "首轮",
                winners: "胜者战",
                elimination: "淘汰战",
                decider: "出线战",
              } as Record<string, string>
            )[m.role];
            const stageName =
              u.stageId === "source"
                ? shadow
                  ? "五轮瑞士"
                  : "四组GSL"
                : shadow
                  ? "八强单败"
                  : "八人双败";
            const title =
              stageName +
              " · 小组" +
              (u.id.startsWith("g") ? Number(u.id.slice(1)) + 1 : 1) +
              (role ? " · " + role : "") +
              ` · 第${m.round ?? r.number}轮第${Number(m.planKey.split("/").at(-1))}场`;
            const label = region
              .locator("label")
              .filter({ hasText: title })
              .filter({ hasText: names[0] })
              .filter({ hasText: names[1] });
            await expect(label).toHaveCount(1);
            await label.getByRole("checkbox").check();
            await page
              .getByRole("combobox", { name: "批量安排比赛台", exact: true })
              .selectOption({
                label:
                  "示例台" +
                  ((u.id.startsWith("g") ? Number(u.id.slice(1)) * 4 : 0) +
                    i +
                    1),
              });
            await page
              .getByRole("button", { name: "安排所选比赛", exact: true })
              .click();
          }
          await page
            .getByRole("button", { name: "保存时间计划", exact: true })
            .click();
          await expect(
            page.getByRole("status").filter({ hasText: "时间计划已保存" }),
          ).toBeVisible();
          await page.goto(url + "/manage/" + demo.tournamentId + "/rounds");
        }
        const unit = page.locator(".competition-unit").nth(index),
          block = unit.locator(".round-block").filter({
            has: page.getByRole("heading", {
              name: `第 ${r.number} 轮 · 当前轮`,
              exact: true,
            }),
          });
        await expect(block.locator(".match-card")).toHaveCount(
          r.matches.length,
        );
        for (const m of r.matches) {
          const number = Number(m.planKey.split("/").at(-1)),
            id =
              u.id === "swiss"
                ? `swiss/${r.number}/${number}`
                : u.id === "single"
                  ? `single/${m.round}/${number}`
                  : `${u.id}/${m.role}/${m.round}/${number}`,
            e = games.find((g: any) => g.id === id);
          expect(e).toBeTruthy();
          const entrants = m.entrants.map((id: string) =>
            rt.roster.find((p: any) => p.entrantId === id),
          );
          expect(entrants.map((p: any) => p.initialSeed)).toEqual(e.entrants);
          const card = block
            .locator(".match-card")
            .filter({ hasText: entrants[0].name })
            .filter({ hasText: entrants[1].name });
          await card
            .getByRole("spinbutton", { name: "左方比分", exact: true })
            .fill(String(e.scores[0]));
          await card
            .getByRole("spinbutton", { name: "右方比分", exact: true })
            .fill(String(e.scores[1]));
          await card
            .getByRole("textbox", { name: "裁定原因", exact: true })
            .fill("独立固定seed预期");
          await card
            .getByRole("button", { name: "裁定赛果", exact: true })
            .click();
          await expect(card).toContainText("已裁定");
          count++;
        }
        page.once("dialog", (d) => d.accept());
        await block
          .getByRole("button", { name: "确认整轮并推进", exact: true })
          .click();
        await expect
          .poll(async () => {
            const n = await runtime();
            return n.units
              .find((x: any) => x.id === u.id)
              .rounds.find((x: any) => x.id === r.id).confirmed;
          })
          .toBe(true);
      }
      await expect(page.getByText("赛事已完成", { exact: true })).toBeVisible();
      expect(count).toBe(example.matchCount);
      await page.reload();
      await expect(page.getByText("赛事已完成", { exact: true })).toBeVisible();
      const final = await runtime(),
        target = final.units.find((u: any) => u.stageId === "target"),
        winner = final.roster.find(
          (p: any) => p.entrantId === target.qualified[0].entrantId,
        );
      expect(winner.initialSeed).toBe(example.champion);
      const savedSchedule = (
        await (await page.request.get(api + "/schedule")).json()
      ).data;
      expect(savedSchedule.schedule.assignments).toHaveLength(
        example.matchCount,
      );
      expect(savedSchedule.validation.status).toBe("ready");
      await page.goto(
        url +
          "/manage/" +
          demo.tournamentId +
          "/configurations/" +
          demo.configurationId +
          "/graph",
      );
      await page
        .getByRole("combobox", { name: "查看比赛子图", exact: true })
        .selectOption(target.id);
      await expect(
        page
          .locator('[data-kind="match"] .plan-node-status')
          .filter({ hasText: "已确认" }),
      ).toHaveCount(shadow ? 7 : example.finalReset ? 15 : 14);
      await page.screenshot({
        path: resolve(
          "../openspec/changes/optimize-tournament-planning-and-schedules/evidence/reference-" +
            example.id +
            "-" +
            width +
            ".png",
        ),
        fullPage: true,
      });
      await page.goto(url + "/tournaments/" + demo.tournamentId + "/schedule");
      for (const name of ["赛制签表", "按轮次", "按时间段"]) {
        await page.getByRole("button", { name, exact: true }).click();
        await expect(page.locator("h1")).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
      await page.goto(base + "/me/tournaments");
      await expect(
        page.getByRole("link", { name: "示例主办", exact: true }),
      ).toBeVisible();
      expect(
        (await (await page.request.get(base + "/api/v1/tournaments")).json())
          .data.total,
      ).toBe(0);
    });
test("RC3 已提交但响应丢失使用原键恢复同一演示", async ({ page }) => {
  await page.goto(base + "/reference-cases");
  const keys: string[] = [];
  let lost = true;
  await page.route("**/api/v1/reference-demos", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    keys.push(route.request().headers()["idempotency-key"]);
    if (lost) {
      lost = false;
      const r = await route.fetch();
      expect(r.status()).toBe(201);
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "STORE_UNAVAILABLE",
            message: "响应丢失",
            retryable: true,
            requestId: "lost",
          },
        }),
      });
    } else await route.continue();
  });
  await page
    .getByRole("checkbox", { name: "确认创建独立演示空间", exact: true })
    .check();
  await page.getByRole("button", { name: "创建独立演示", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("响应丢失");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "进入演示", exact: true }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(
    readdirSync(join(directory, ".reference-demos")).filter((n) =>
      n.endsWith(".sqlite"),
    ),
  ).toHaveLength(1);
  await page.getByRole("link", { name: "进入演示", exact: true }).click();
  await expect(page.locator("aside.notice")).toContainText("隔离演示空间");
  const url = page.url();
  await page.goto(base + "/reference-cases");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "已创建的独立演示", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "打开演示", exact: true }).click();
  await expect(page).toHaveURL(url);
  await expect(page.locator("aside.notice")).toContainText("隔离演示空间");
});
