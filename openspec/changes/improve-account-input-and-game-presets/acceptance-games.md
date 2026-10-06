# 游戏预设与目录兼容切片验收

日期：2026-10-06。范围：任务4.1–4.4；活动变更仍处于实施。代码在当前工作区，HEAD e09ed528d925fc3a2f826fa6f770c4096b0f4d3c，并非已提交交付。任务完成状态以 tasks.md 为准。

## 已完成内容

- 固定 street-fighter-6 / shadowverse 游戏身份。统一影之诗九职业，死灵、吸血鬼、梦魇各自稳定ID并列，中立独立；没有版别选择门槛。
- GET /api/v1/games 提供版本化只读预设。赛事 gameId 读写、服务端分类派生、未知值及分类不一致校验；未指定游戏兼容旧分类。
- 创建/编辑游戏选择，目录关键词/分类/gameId交集筛选、未指定筛选和分页；列表及详情显示具体游戏。
- 503保留表单并可保存/重试；409重新读取后保留本地输入，显式确认才替换。
- 旧JSON缺失gameId只在响应投影为null，不自动猜测或批改数据；旧幂等回放原结果不重写。临时SQLite重启、A/B权限、并发版本和冻结隔离均取得真实测试证据。
- API与用户文档补充部署顺序、备份和回退边界；未执行生产迁移或生产恢复。

## 需求—规格—任务—证据

| 需求 | delta规格与场景 | 任务 | 当前证据 |
|---|---|---|---|
| PRD R02、游戏输入反馈 | game-presets GP1：统一影之诗与职业并列 | 4.1 | backend/test/platform/game-presets.test.js 清单断言 |
| PRD R02、旧赛事兼容 | tournament-catalog TC1：游戏预设创建与旧赛事 | 4.2、4.4 | 真实HTTP：分类派生、null/未知值、旧JSON及幂等、A/B、同版本竞争、重启；冻结快照原字节比较 |
| PRD R02、赛事发现 | tournament-catalog TC2：按游戏筛选 | 4.3 | HTTP交集/分页/未指定/私有隔离；frontend/src/features/game-presets.test.tsx；frontend/e2e/game-presets.spec.ts |
| GP1选择与失败恢复 | tournament-catalog TC1/TC2及GP1 | 4.3 | 360/768/1440真实Edge创建→重启→编辑→筛选，409显式确认、503草稿保留和重试 |
| 文档与冻结边界 | TC1、game-presets预设不代表运行就绪 | 4.4 | docs/PLATFORM-API.md、frontend/README.md；冻结版本/快照不变与runtimeFormats=[]测试 |

## 实际检查

| 命令 | 结果 | 记录 |
|---|---|---|
| backend npm test | 66/66，退出0 | evidence/game-regression-backend.txt |
| frontend npm test | 55/55，退出0 | evidence/game-regression-frontend.txt |
| frontend npm run build（含tsc --noEmit） | 通过，退出0 | evidence/game-build.txt |
| frontend npm run e2e | 25/25，退出0 | evidence/game-regression-browser-final.txt |
| git diff --check | 通过，退出0 | evidence/game-sdd-validation.txt |
| openspec validate improve-account-input-and-game-presets --strict | 通过，退出0 | evidence/game-sdd-validation.txt |

新增10个后端、4个组件和4个浏览器用例。原有日期/密码/501/配置冻结回归保留。浏览器初轮23通过、2失败输出保存在 game-regression-browser.txt：新用例服务器关闭被闲置连接阻塞，原密码用例随机监听6666被Edge拒绝。修正测试连接关闭和密码测试端口后重跑通过。SQLite实验性API、calendar-gate独立探针的大chunk警告不代表测试失败。

截图 output/playwright/game-preset-{360,768,1440}.png；主代理查看360与1440截图，表单没有横向溢出，浏览器三宽度均断言无横向溢出。

## 核验与限制

两个独立只读核验（后端、前端）未发现本切片阻断缺陷，主代理点验分类/历史ID提交及事务内PATCH关键代码；见 review-games.md。默认Windows沙箱故障导致首个后端探子无法读取，重派聚焦核验通过受审只读通道完成。

HTTP覆盖未指定筛选和分页；前端尚无这两项的独立实际点击用例。未知历史ID在编辑组件覆盖，列表/详情尚无独立浏览器标签用例。409日期字段另由datetime用例覆盖。这些覆盖限制不伪装成已执行场景。

GP2/GP3资源实体、素材台账、图像403/404/超时和资源浏览尚未完成，resourceCatalogVersion仍pending。/games最小预设清单不代表5.2完整资源API完成。第5组五项及第6组整链验收三项均未勾选；本次测试与审查仅支持4.1–4.4完成，不提前宣称6.1–6.3完成。正式规格同步、全变更归档、提交/推送、部署及真实用户接受尚未发生。

Notion阶段同步使用完整T0→候选T1→同范围T2→最小写入→逐项回读；结果见 .sdd/notion/runs/20261006-game-slice/。如出现外部变化须先定稿，不以测试结果代替同步核验。
