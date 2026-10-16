import { test as base, expect } from "@playwright/test";

export { expect };
export const test = base.extend<{ requestAudit: void }>({
  requestAudit: [async ({ page }, use, info) => {
    const requests = { edit: 0, migrate: 0, analyze: 0 };
    page.on("request", request => {
      const action = /\/planning-canvas\/(edit|migrate|analyze)$/.exec(new URL(request.url()).pathname)?.[1];
      if (action) requests[action as keyof typeof requests]++;
    });
    await page.route(/\/planning-canvas\/(edit|migrate)$/, route => route.abort());
    const analyses = info.title.includes("乱序分析") || info.title.includes("Pool 部分排序") ? 2 : info.title.startsWith("旧分析响应") || info.title.startsWith("分析到达") ? 1 : 0;
    if (!analyses) await page.route(/\/planning-canvas\/analyze$/, route => route.abort());
    await use();
    await info.attach("canvas-request-audit", {body:JSON.stringify(requests),contentType:"application/json"});
    expect(requests).toEqual({edit:0,migrate:0,analyze:analyses});
  }, { auto: true }],
});
