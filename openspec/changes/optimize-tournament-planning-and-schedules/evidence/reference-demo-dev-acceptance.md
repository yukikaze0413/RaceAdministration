# 开发入口演示修复验收（2026-10-12）

用户反馈创建后无法查看演示。此前真实 Edge 验收通过构建后的同源后端进行，遗漏日常 Vite 开发入口。

失败复现：`npx playwright test e2e/reference-demo-dev.spec.ts`，创建成功并点击“进入演示”后，`/demos/<id>/api/v1/health` 返回 `text/html`，断言期待 `application/json` 失败。Vite 原来只代理 `/api`，子空间请求进入 SPA fallback。

修复：`frontend/vite.config.ts` 增加 `^/demos/[a-f0-9]{64}/api(?:/|$)` 代理到原后端；页面仍由 Vite 提供，不改演示地址、数据库或会话路径。

最终验证：

- 实际配置 + 临时后端 + 真实 Edge，三个可用示例均完成创建、进入、保存默认 BO、刷新后 BO 保留、原入口重新打开；原会话 Path=/，演示会话 Path=/demos/<id>。3/3 通过，日志 `reference-demo-dev-browser-final.log`。
- `npm --prefix frontend test`：18 文件、93 测试通过。
- `npm --prefix frontend run build`：类型检查和构建通过；保留既有大于500kB的 chunk 提示。
- 当前运行的5173服务只读请求不存在演示ID，返回后端404正文“未找到此演示空间。”，确认已加载代理规则。没有进入、修改用户实际实例。

不需要重新创建已保存的演示。用户可刷新“赛事示例”，从已有列表点击“打开演示”。本次验证不构成用户实例的实际验收；SDD仍28/36。
