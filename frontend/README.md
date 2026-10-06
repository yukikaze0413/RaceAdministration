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

密码仅要求非空，不设最短/最长字符数；空格、Unicode及前后空格原样保留。整个请求仍受1MiB边界和注册/登录限流保护。旧账号的用户ID及摘要参数保持。密码由 scrypt 派生；会话使用 HttpOnly / SameSite=Lax cookie，固定有效期7天。当前管理权限仅创建者；第三方登录、邮件恢复与协作者授权尚未实现。请求号和错误码可展开查看。旧 `/api/races` 是独立内存原型，新前端不调用，不会自动迁移旧演示记录。

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

## 密码切片复核（2026-10-05）

在仓库根执行 `node --test backend/test/platform/password.test.js`，用内存及全新临时SQLite账号真实注册/登录：短密码为单个x，长密码为1025个p。另含12/129字符、Unicode组合序列、前后空格和纯空格，验证删减、去空格或Unicode规范化后的错误密码无法登录；空字符串注册422、登录401。旧scrypt账号重启登录、请求体413、共享限流429和脱敏错误日志单独核验。

`npm --prefix frontend run build` 后执行 `npm --prefix frontend run e2e -- e2e/password.spec.ts`，以真实Edge在360/1440宽度注册并登录1/1025字符密码。测试只使用独立临时库，不建立开发账号。密码恢复和第三方登录仍未接入。

## 日期组件前置验证（2026-10-05）

锁定Ant Design 6.6.5/dayjs 1.11.23。运行 `npm --prefix frontend run calendar:build` 可构建frontend/experiments/calendar隔离验证页；真实Edge前置用例为e2e/calendar-gate.spec.ts，默认e2e入口自动构建该探针。它验证中文、键盘/清空和三宽度，不代表赛事日期已完成。第3组已将控件接入生产MetadataForm，使用边界与复现见下方“赛事日期时间输入”；本节保留任务1.2当时的隔离证据。测量和限制见活动变更calendar-decision.md。

## 赛事日期时间输入（2026-10-05）

赛事创建/编辑页已使用中文日历和时间选择，开始时间可留空。固定UTC偏移默认UTC+08:00，可从UTC-12:00至UTC+14:00按15分钟选择；它不自动处理地区夏令时。切换偏移只改变显示，保留同一时刻；只改名称保留历史秒/毫秒。

键盘输入格式为 `YYYY-MM-DD HH:mm:ss.SSS`（例如 `2026-10-05 10:30:00.000`）；也可直接点击日历与时间列。Tab可到中文“确定”并Enter确认，输入框内Enter可确认；关闭后Enter或向下键重开，Escape或“取消选择”恢复原时间并归还焦点。未确认或非法输入禁止保存，普通失焦保留错误输入。点击“清空开始时间”保存null；留空不自动设当前时间。版本409保留本地日期/偏移，重读不会覆盖，只有“确认使用服务器资料”才替换。

手算复核：
1. 创建赛事，选择2026-10-05 10:30:00.000，偏移UTC+08:00，确认并保存；API startsAt应为2026-10-05T02:30:00.000Z。
2. 编辑赛事，选择偏移UTC-04:00，再输入2026-10-04 23:45:00.000，确认并保存；API startsAt应为2026-10-05T03:45:00.000Z。重启后再进入编辑显示同一时刻（编辑页默认+08，即11:45）。

运行 `npm --prefix frontend run build` 后执行 `npm --prefix frontend run e2e -- e2e/datetime.spec.ts`，使用独立临时SQLite、真实Edge验证三宽度、UTC/上海和纽约夏令时跳时。单测命令：`npm --prefix frontend test -- src/shared/fixed-datetime.test.ts src/features/datetime.test.tsx`；HTTP命令：`node --test backend/test/platform/datetime.test.js`。构建按需加载日历，非日期页面不需要下载日历chunk。

## 游戏预设与目录（2026-10-06）

创建或编辑赛事时选择“游戏预设”：街霸六或影之诗。选中后自动显示分类；选择“未指定游戏”可保留卡牌/格斗兼容分类。影之诗使用统一入口，九职业和中立的稳定清单已建立，职业素材浏览尚待第5组。

公开目录的“筛选游戏”支持具体游戏和未指定游戏，可与分类、关键词同时使用，筛选变更回到第一页。列表及详情显示游戏名和分类；旧赛事不自动猜游戏，历史未知ID显示保留状态。

游戏目录加载失败时可重试，当前游戏和名称、日期等输入保留，已有赛事仍可保存。409冲突先重读并比较；点击“确认使用服务器资料”才替换游戏和日期。游戏改动不改冻结结构，不开启报名、赛果或配对。

复核：运行 `node --test backend/test/platform/game-presets.test.js` 检查新/旧记录、分类校验、权限、同版本竞争、幂等回放、SQLite重启与冻结隔离；`npm --prefix frontend test -- src/features/game-presets.test.tsx` 检查选择、筛选、失败恢复与未知游戏；构建后运行 `npm --prefix frontend run e2e -- e2e/game-presets.spec.ts` 使用临时SQLite与真实Edge验证三宽度、重启/编辑/筛选及目录失败/409恢复。迁移与配套回退限制见docs/PLATFORM-API.md。游戏素材仍pending，没有完整图库。

## 手机验收修订（2026-10-06）

创建赛事依次填写基本信息，再选分类（卡牌/格斗）和该分类中的游戏，随后填写时间地点、所属系列与可见性。改分类会清空原游戏，请重新选择。日期显示到分钟，默认北京时间；可清空，切换时区显示同一时刻。日历“此刻”也使用所选偏移。原秒/毫秒仍保存。

点击顶部自己的显示名进入账户设置：概览展示头像、显示名、登录用户名和固定唯一ID。个人资料可上传/移除头像、修改显示名及用户名；改变登录用户名须当前密码，ID和赛事归属不变。原头像PNG/JPEG/WebP不超过10MiB，浏览器裁切压缩再上传，服务端保存256平方像素WebP。登录与安全可修改密码及退出登录。永久注销先查看系列/赛事/配置/快照等删除数量，填写当前密码、当前用户名并确认不可恢复；一个数据库事务清理账号与自身关联数据，错误不会部分删除。取消后保留账号；退出登录独立保留，只结束当前会话。

实际手机预览：http://10.82.238.254:5173 。本轮已用真正HTTP LAN的360px页面注册专用测试账号，点击创建并刷新、编辑时间保存并刷新验证持久化；用户自己的手机仍需复验。具体根因和证据见活动change的acceptance-mobile-feedback.md。当前后端watch已更新，/api/v1/games返回200。

### 账户总览交互（2026-10-07）
账户页与工作台共用panel和按钮风格。先查看已保存的头像、显示名、登录用户名与唯一ID，点击头像、修改名称、修改用户名、修改密码后才打开对应输入框。取消丢弃草稿并回入口；退出登录先确认。删除账号读取当前拥有的系列/赛事及关联配置数量，再验证密码和用户名；只删除当前ownerId属于用户的赛事，已归他人所有的赛事保留，新建默认归创建账号。此改动未新增转让赛事功能。
