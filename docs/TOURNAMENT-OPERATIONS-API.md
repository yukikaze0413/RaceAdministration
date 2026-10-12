# 赛事运行与报名接口

本次前缀仍为 /api/v1，沿用可信cookie会话、Origin、JSON、错误包裹与Idempotency-Key。
账号删除、旧结构快照与游戏素材的说明见 PLATFORM-API.md；本文件补充真实赛事能力。

## 页面验收入口

1. 赛事管理 → 赛制模板：使用单败、单循环、两组循环接淘汰的可运行预设，创建独立草稿。
2. 配置 → 赛制画布：选来源名次和目标席位连线，或使用等价连接表单；卡片标题拖动/方向键移动；缩放/平移和布局单独保存。
3. 配置 → 阶段与小组/选手池/晋级路由：完整参数编辑；先保存、校验再冻结。冻结不会开赛。
4. 赛事管理 → 协作者：按已注册用户名授权资料、结构、报名表、审批、裁定、确认；管理授权仅创建者。
5. 赛事管理 → 报名与名单：定义字段、保存、发布开放；参赛者在赛事主页→报名填写。审批设置唯一初始种子，多个初始组必须分配小组。
6. 锁定名单后，在整轮推进选择冻结配置，必要时修改阶段BO/平局规则，再开赛。
7. 赛果/比赛对阵：选手可提交自己的对阵；管理员留因裁定；全部裁定后确认整轮生成下一轮，最终显示冠军。
8. 同分待裁定时只调整并列顺序并留理由；旧锁定比赛不改分。处罚、组队、瑞士和双败仍未实现。

## 数据与操作契约

所有赛事操作状态有 version；管理写入携带 expectedVersion，过期409。写入需Idempotency-Key，相同actor/key与相同请求回放；同键异输入409。布局独立版本，不改变结构版本/digest。答案按发布时schemaVersion和稳定field.id保留。个人报名写入不要求全局expectedVersion，但schemaVersion须是当前发布版本。

| 方法与路径（赛事前缀 /tournaments/:tid） | 请求/用途 | 权限 |
|---|---|---|
| GET /runtime | version、rules、锁定状态、permissions、canSubmitMatchIds、runtime | 赛事可见 |
| GET /matches、/results、/standings；GET /rounds | 同一真实运行投影 | 可见；rounds需登录 |
| GET /registration-form | 编辑者看到草稿，其余看到最新已发布表 | 赛事可见 |
| PUT /registration-form | expectedVersion、fields | registrationSchema.edit |
| POST /registration-form/publish | expectedVersion，发布后开放 | registrationSchema.edit |
| POST /registrations | schemaVersion、answers；同账号更新待审批报名 | 当前用户 |
| GET /my-registration | 本人报名与提交时schema | 当前用户 |
| GET /registrations | version、名单与旧schema | registration.review |
| POST /registrations/:rid/approve | expectedVersion、seed、sourceId、approved；false拒绝 | registration.review |
| POST /roster/lock | expectedVersion；2–64已审批个人 | registration.review |
| GET /collaborators | 版本、能力清单与协作者 | 创建者 |
| POST /collaborators；PATCH /collaborators/:uid | expectedVersion、username或userId、permissions | 创建者 |
| DELETE /collaborators/:uid | expectedVersion | 创建者 |
| PUT /runtime-settings | expectedVersion、rules:[{stageId,bestOf,allowDraw,allowPlayerDoubleLoss}] | structure.edit，开赛前 |
| POST /start | expectedVersion、configurationId | rounds.confirm |
| POST /matches/:mid/results | expectedVersion、result | 当场选手或结果管理者 |
| PATCH /matches/:mid/results | expectedVersion、result、reason | results.edit |
| POST /rounds/:rid/confirm | expectedVersion | rounds.confirm |
| POST /units/:uid/ranking | expectedVersion、完整order、reason；只改并列 | rounds.confirm |
| GET/PUT /configurations/:cid/layout | PUT expectedVersion、positions:{id:{x,y}}、zoom、pan | structure.edit |
| POST /configurations/from-runtime-preset | presetId | structure.edit |
| GET /runtime-presets（无赛事前缀） | 3个可运行预设与版本 | 登录 |

字段：id/type/label/help/required/min/max/options/disabled；type为text/textarea/number/select/multiselect/checkbox。最多32字段，选项不重复。改变已发布字段type必须新建ID；停用不删除旧答案。
result为 {kind:"score",scores:[左,右]}；循环管理员可裁定 {kind:"double-loss"}，选手须规则允许；不以虚假0–0表示双方负。
裁定后仍须整轮确认。先提交或更正但未确认时不会产生下游。确认失败不留下部分排名/锁定/下一轮。

## 平台赛制版本

- single-elimination-v1：BO1/3/5/7，禁止平局和双方负。固定种子表；8槽为1/8/4/5/2/7/3/6；初始小组按全局种子排序后形成组内序列。显式下游seed和slot保留绝对位置。
- round-robin-v1：固定首位圆桌旋转，奇数休赛不计分。胜3/平1/负0，双方负0/0。积分相同看同分集合交手积分，再正常比分净胜局；不递归重算小积分；未破同分阻塞。
- 小组独立整轮确认；所有必需来源排名确定后按冻结路由执行，池按原规则合并排序。最终轮不产生空下一轮。
- 成绩继承不跨阶段，各阶段重计；退出/DQ未接入，本期普通赛事样例不验证处罚正确性。

## 独立验收命令

仓库根：node --test backend/test/platform/tournament-operations.test.js。
前端目录：npm run build，然后 npx playwright test e2e/tournament-workbench.spec.ts。
完整入口：后端npm test；前端npm test、npm run typecheck、npm run build、npm run e2e。
样例真实HTTP测试覆盖8人15场、6人5场、5人10场；独立手写预期见设计简报与测试中的固定断言。
测试只使用临时账号和独立SQLite；不会创建用户开发库的赛事。

## 数据删除与历史恢复

operations_aggregates新增赛事外键表。自有赛事注销先删除操作聚合；其他赛事清除本人报名答案与授权，已锁名单采用“已注销参赛者”匿名身份，原对阵/比分和entrantId保留。
注销范围token包含相关操作聚合，范围变化409后重新预览。现有跨账号旧结构引用保护仍保留，不自动清理他人配置审计。
SQLite重启保留版本、运行快照、已确认结果和成功幂等响应。生产备份/吞吐/多实例未验证；本轮没有部署或迁移用户真实库。

## 2026-10-09 v2实际运行更新
single-cut-v2、gsl-classic-v1、de-standard-v1、de-lower-entry-v1、swiss-fixed-v1、swiss-threshold-v1已接入实际运行。v2规则来自冻结parameters与compiled-plan，运行中不改BO。entryRef按配置/阶段/组/端口/位置绑定，后阶段全部来源齐备再合并直邀整体启动。
POST /units/:uid/pairing接收expectedVersion/inputVersion/inputHash/pairs/bye/reason，仅rounds.confirm且完整合法，不能放松禁重赛和轮空约束。Swiss计算事务外准备，事务内重新授权/版本/摘要检验；大points和BH可返回规范十进制字符串。
操作说明见OpenSpec变更的entry-runtime-guide.md、gsl-runtime-guide.md、de-runtime-guide.md、swiss-runtime-guide.md；官方科隆/TI专属adapter仍待证据，不冒称复刻。v1历史冻结及运行兼容保留。