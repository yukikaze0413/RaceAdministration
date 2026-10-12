# v1/v2 升级兼容核对（任务 0.1）

日期：2026-10-08。范围：前序 implement-tournament-workbench 的五份增量规格、本变更八份增量规格及当前代码。此记录完成升级前置核对；不表示 v2 解析、复制升级或新赛制已经实现。

## 版本与字段对照

| 当前 v1 事实 | v2 约定与升级边界 | 来源 / 后续任务 |
|---|---|---|
| 顶层 entrantKind=individual、structureVersion=structure-v1、routingVersion=routing-v1；阶段只有 id/tournamentId/order/capacity/formatIntent/groups | 新结构显式使用 structure-v2/routing-v2，新增阶段 name/groupCount/groupSize/qualifyCount/format/ruleVersion/parameters。capacity 派生；同阶段组实体数与 groupCount 一致。不能将字段注入原 v1 | backend/src/tournament-configuration/domain/structure.js:31；design.md §1；1.1 |
| 小组 id/stageId/capacity；引用为 stageId/groupId/poolId，route selector/quota/sort/placement | 重复组保留已有稳定 ID；新增入口/出口、来源占位。缩组/换格式先展示影响并明确确认。复制时统一改写 stage/group/pool/route 引用并保存映射 | structure.js:40；specs/tournament-structure/spec.md TS7；1.2/1.4/3.2 |
| 配置 version 是乐观并发整数；snapshot 有 frozenFromVersion/version/configurationId/digest | 并发版本与规则版本分开，不用 version 整数猜赛制。复制产生独立新配置，记录源配置 ID/版本和迁移映射，不覆盖原配置；重复复制请求返回同一结果 | application/service.js:75、115；TS7；1.4 |
| 冻结结构先校验，再 canonical JSON SHA-256；对象键排序、数组顺序保留；snapshot.runtimeReady=false、started=false | 原快照与 digest 原样保留。新 v2 新增字段仅参与新快照摘要；不为旧对象补默认参数、重排数组或改写历史能力报告。冻结不表示开赛 | domain/canonical.js:4；application/service.js:115；CV5/1.1/1.4 |
| 开赛 runtime.version=runtime-rules-v1；预设 ruleVersion=runtime-rules-v1；运行 unit.format 来自 formatIntent | 两者是同一旧规则族在不同层的字段，不能把 runtime.version 改成数字或原地重命名。v2 按阶段 ruleVersion 分派；仅实现并验证后开放支持。旧 family 继续走原规则 | backend/src/platform/operations/runtime-http.js:148；presets.js:56；design.md §1/4 |
| 旧结构标签六种；实际运行仅 single-elimination / round-robin。规格称 single-elimination-v1 / round-robin-v1，而代码没有这两个独立 registry key | 保留标签、规格名称与实际 runtime-rules-v1 三层区分；不能把规格名称假称现有存储字段。新注册表显式绑定 single-cut-v2、gsl-classic-v1、de-standard-v1/de-lower-entry-v1、swiss-fixed-v1/swiss-threshold-v1、round-robin-v2/double-round-robin-v2 | structure.js:2；runtime-http.js:108；前序 TO3/CV3；1.1/4–7 |
| rules[stageId] 保存 bestOf、allowDraw、allowPlayerDoubleLoss，BO1/3/5/7；开赛复制到 unit.rule | v2 参数完整版本化保存并在开赛冻结到运行；未知字段拒绝，未实现规则不能因目录/模板存在就启动；规则变更不得作用于已开赛 v1 | runtime-http.js:55；runtime.js createUnit；FP2/CV5；1.1/3/4–7 |
| 来源排名 rankingProfileId=unit.format+"-v1"、recordProfileId=match-record-v1；来源 version 是已确认轮数，未确认时为1 | 规则族、排名公式、战绩与来源快照版本分别表达；BH/DS 等不能替换旧循环积分排序。所有必需来源齐备才分配目标，目标建立与确认在同一事务 | operations/progression.js:15；ER4/PR5；3.2/3.3/5.3 |
| 布局和时间不参与旧单败/循环赛果规则；旧预设没有 schedule 聚合 | 时间计划新增独立聚合与版本，布局不得改比赛引用或冻结 digest；不自动改旧比分与旧时间语义 | design.md §5/6；9.1 |

全部正式规则标识以 parameters.md 为准。

## 报名与来源入口

当前报名提交 POST /tournaments/:tid/registrations 只接 schemaVersion/answers；审批 POST /registrations/:rid/approve 接 expectedVersion/seed/sourceId/approved，写 seed 与 sourceId。名单锁定为2–64名已审批个人。来源入口不是选手提交的权限声明。

开赛从没有入边的根阶段取入口：有组则用 group.id，否则 stage.id。sourceId 省略仅在唯一入口时自动填充；其他入口、后阶段直邀、upper/lower 在当前 v1 均不支持，不把设计中的 entryRef 假称已实现。分组先按全赛事 initialSeed 排序，再生成组内 position；直接阶段保持 seed。出处：registration.js:206/244/282，runtime-http.js:131–176。

v2 entryRef 应明确 stage/group/upper|lower/seed 及来源，与审批身份、目标席位绑定；后阶段直邀与上游晋级必须全部齐备才整体启动。复制升级保留旧 sourceId 语义并记录映射，不把已有报名偷偷迁到新配置。上下入口跨入口身份唯一；直接 lower 的 initialLosses=1 与 actualLosses=0 分开记录。对应任务 1.4、3.3、6.2。

## 旧规则与兼容样例

| 独立预期 | 现有测试出处 | 本轮结果 |
|---|---|---|
| 六人单败8槽 [1,8,4,5,2,7,3,6]；1/2轮空，4–5和3–6，真实5场，冠军种子1 | backend/test/platform/tournament-operations.test.js:310（TO3） | 本轮 backend npm test 中通过 |
| 五人循环五轮，每人4场/一次休赛，10个无序对，积分12/9/6/3/0 | 同文件:405（TO3） | 通过 |
| 八人A/B两组循环接四强，A1/B2/B1/A2固定slot，所有来源结束后才建目标，共15场 | 同文件:486（TO5） | 通过 |
| 非法版本、未知字段、重复ID、跨赛事拒绝；独立草稿及版本递增 | test/tournament-configuration/structure.test.js:5 | 通过 |
| 冻结摘要存在；runtimeReady=false / started=false；冻结后禁止编辑 | test/tournament-configuration/freeze.test.js:4 | 通过 |
| 旧六类意图校验不等于运行；未支持规则不得伪造配对 | test/tournament-configuration/validation.test.js:26 | 通过 |

关键兼容约束：旧六人轮空继续 v1；v2 默认齐满不反向限制旧赛事。旧循环积分/同分、审批隐私、撤权重检、乐观版本、成功键持久、整轮永久锁定与事务回滚继续沿用。复制后新实例及引用不共享；旧冻结/运行不允许升级。

## 本轮验证与证据

- 当前分支 chore/openspec-restart；HEAD 1b2266a666d71c9ac56c1b082a4f25a608382e38。
- 主代理读取前后变更正式规划及关键源码；只读探子提供跨文件定位，主代理点验结构解析、canonical、冻结、开赛、报名与实际晋级入口。
- 2026-10-08，backend 目录 npm test：95 tests / 95 pass / 0 fail / 0 skipped，退出0。完整命令输出见 evidence/compatibility-backend.txt；为旧规则兼容回归，不是 v2 新行为红→绿。
- 独立只读核验无阻断；主代理已修正三处源码引用精度（预设 ruleVersion、支持格式判断、来源排名 profile）。
- 尚未执行复制升级、v2 参数 HTTP、v2 冻结与重启等新增测试，属于1.1/1.4等实施任务。
- 本任务未修改业务代码；没有对用户 SQLite 进行演示操作、提交、推送、部署或正式规格同步。
- Notion 本轮入口 fetch 成功，但缺完整四库查询与全部关系/正文基线，scope.complete=false；只保存 .sdd/notion/runs/20261008-tournament-compatibility/，不进行远端写入。面板返回 queued，未证实已打开。

## 后续实施核验门槛

1. 任务1.1新增v2解析/服务端目录前，先写独立预期的默认值、非法参数、未知字段/跨赛事与超额人数失败测试；实际确认业务红，再最小实现及旧95项回归。
2. 任务1.4必须真实验证复制幂等、ID映射、旧digest不变、事务失败与重启；不能以本文的兼容设计代替测试。
3. 特定科隆/TI与双败feeder门槛仍由0.2/0.3/0.4约束，只阻塞相关运行和案例。
