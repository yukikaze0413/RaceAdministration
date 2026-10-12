import { test, expect } from "@playwright/test";
import { createServer, loadConfigFromFile } from "vite";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
const {
  listenTestServer,
} = require("../../backend/test/helpers/http-listener");

for (const caseId of ["shadow-cup-v1", "gsl-no-reset-v1", "gsl-reset-v1"])
  test(`开发服务创建演示后可以进入、刷新并重新进入 ${caseId}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const directory = mkdtempSync(join(tmpdir(), "race-reference-dev-"));
    const origins: string[] = [];
    const platform = createApp({
      databasePath: join(directory, "parent.sqlite"),
      origins,
    });
    let backend: any, vite: any;
    try {
      backend = await listenTestServer(platform.app);
      const target = "http://127.0.0.1:" + backend.address().port;
      const loaded = await loadConfigFromFile(
        { command: "serve", mode: "development" },
        resolve("vite.config.ts"),
      );
      if (!loaded) throw Error("Missing development configuration");
      // Keep the production proxy path rules, replacing only the isolated target.
      const proxy = Object.fromEntries(
        Object.entries(loaded.config.server!.proxy!).map(([key, value]) => [
          key,
          typeof value === "string" ? target : { ...value, target },
        ]),
      );
      vite = await createServer({
        ...loaded.config,
        configFile: false,
        root: resolve("."),
        server: {
          ...loaded.config.server,
          host: "127.0.0.1",
          port: 25000 + Math.floor(Math.random() * 30000),
          strictPort: false,
          proxy,
        },
      });
      await vite.listen();
      const base = "http://127.0.0.1:" + vite.httpServer.address().port;
      origins.push(base);
      for (const action of ["register", "login"]) {
        const response = await page.request.post(
          base + "/api/v1/auth/" + action,
          {
            headers: { Origin: base },
            data: {
              username: "dev_demo_owner",
              password: "reference-dev-test-password",
              ...(action === "register" ? { displayName: "开发演示主办" } : {}),
            },
          },
        );
        expect(response.ok()).toBeTruthy();
      }
      await page.goto(base + "/reference-cases");
      await page
        .getByRole("combobox", { name: "示例", exact: true })
        .selectOption(caseId);
      await page
        .getByRole("checkbox", { name: "确认创建独立演示空间", exact: true })
        .check();
      const created = page.waitForResponse(
        (r) =>
          r.url() === base + "/api/v1/reference-demos" && r.status() === 201,
      );
      await page
        .getByRole("button", { name: "创建独立演示", exact: true })
        .click();
      const demo = (await (await created).json()).data;
      await page.getByRole("link", { name: "进入演示", exact: true }).click();
      const health = await page.request.get(
        base + demo.prefix + "/api/v1/health",
      );
      expect(health.headers()["content-type"]).toContain("application/json");
      expect((await health.json()).data.status).toBe("ok");
      await expect(page.locator("aside.notice")).toContainText("隔离演示空间");
      await expect(page.getByRole("button", { name: /^1\. / })).toBeVisible();
      await page.getByRole("button", { name: /^1\. / }).click();
      await page
        .getByRole("combobox", { name: "默认BO", exact: true })
        .selectOption("5");
      await page.getByRole("button", { name: "保存阶段", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("阶段已保存");
      await page.reload();
      await expect(page.getByRole("button", { name: /^1\. / })).toBeVisible();
      await page.getByRole("button", { name: /^1\. / }).click();
      await expect(
        page.getByRole("combobox", { name: "默认BO", exact: true }),
      ).toHaveValue("5");
      await page.goto(base + "/reference-cases");
      await page.getByRole("button", { name: "打开演示", exact: true }).click();
      await expect(page.getByRole("button", { name: /^1\. / })).toBeVisible();
      const cookies = await page.context().cookies();
      expect(cookies.find((c) => c.name === "race_session")?.path).toBe("/");
      expect(cookies.find((c) => c.name === "race_demo_" + demo.id)?.path).toBe(
        demo.prefix,
      );
    } finally {
      await vite?.close();
      if (backend?.listening)
        await new Promise<void>((r) => backend.close(() => r()));
      platform.close();
      if (!directory.startsWith(join(tmpdir(), "race-reference-dev-")))
        throw Error("Unexpected temporary directory");
      rmSync(directory, { recursive: true, force: true });
    }
  });
