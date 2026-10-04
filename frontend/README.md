# 赛事工作台前端

中文 React / TypeScript / Vite 单页应用。账号、赛事资料、结构表单、校验、模拟预演与冻结调用真实 `/api/v1` 接口；报名、组队、对阵、赛果、排名、推进、处罚、协作者和密码恢复显示明确不可用状态。

## 本地运行

要求 Node.js 24.11.1 或兼容的 Node 24 环境。该版本内置 SQLite 仍会产生 ExperimentalWarning，本项目用于单实例本地交付。

在仓库根目录执行：

```powershell
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend start
```

另开终端运行：

```powershell
npm --prefix frontend run dev
```

打开 http://127.0.0.1:5173。开发服务器代理 `/api` 到 5000；请使用该地址的来源，不把 localhost 与 127.0.0.1 混用。首次数据库为空，没有预置账号、赛事或管理员。创建账号后登录，再创建系列/赛事；赛事默认私有。

同源构建运行：

```powershell
npm --prefix frontend run build
npm --prefix backend start
```

打开 http://127.0.0.1:5000。已知页面支持深链接刷新；API 未匹配返回 JSON 404。构建输出不纳入 Git。

## 配置与数据

后端默认仅监听 127.0.0.1:5000，数据库在 `backend/.data/platform.sqlite`，启动不会清空。可通过 PORT、HOST、DATABASE_PATH、APP_ORIGINS（逗号分隔的完整 Origin）、COOKIE_SECURE=true 配置。TLS 部署须使用 Secure cookie；生产域名、TLS、备份、吞吐与多实例部署尚未验收，不要直接把本地默认暴露到公网。

密码由 scrypt 派生；会话使用 HttpOnly / SameSite=Lax cookie，固定有效期7天。当前管理权限仅创建者；第三方登录、邮件恢复与协作者授权尚未实现。请求号和错误码可展开查看。旧 `/api/races` 是独立内存原型，新前端不调用，不会自动迁移旧演示记录。

## 配置工作台

从赛事管理概览新建空草稿或选择 four-groups/1、pool/1 模板。阶段/小组、池、路由均通过独立表单编辑；对象使用稳定 ID，不新增领域未支持的名称字段。排序列表的先后顺序有含义，sourcePriority 必须完整列出实际来源。seed 和 slot 分开保存。

未完整且类型合法的草稿可保存。删除引用对象不会自动级联，保存错误可以定位关联字段。切换栏目或离开会提醒未保存内容；刷新前浏览器会询问。输入只在当前页面内存中，不承诺离线持久草稿。

保存成功才更新版本。版本冲突保留本地输入，重读服务器版本后可以比较，并需确认才能替换。网络失败或超时意味着结果未确认：使用原操作重试沿用原请求键；改了输入则生成新键。刷新后先重读服务器，不自动重发写操作。

校验与预演显示结构有效、当前输入的预演就绪和运行就绪三个状态。模拟样例明确标记；模板会重建 ID，必须人工将样例来源一对一映射到当前阶段/小组，不能猜测数组位置。也可输入包含 roster / sourceSnapshots 的自定义 JSON。DQ 标记继续保留，样例不会变成报名或比分数据。

冻结需要二次确认并在服务端重新校验。成功后结构只读且不可解冻；runtimeReady=false、started=false。公开页面仅展示冻结结构摘要，不公开模拟名单、完整私有配置或操作者身份。

## 验证

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix backend test
npm --prefix frontend run e2e
```

浏览器验收使用本机 Microsoft Edge 的 Playwright channel 和独立临时 SQLite，服务随机监听回环端口；不使用开发数据库。截图写入 `output/playwright/`，报告和构建输出被忽略。详见 `docs/PLATFORM-API.md` 与 OpenSpec 交付变更的 acceptance.md。