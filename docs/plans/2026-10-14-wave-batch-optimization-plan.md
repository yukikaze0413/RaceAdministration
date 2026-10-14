---
title: 画布新机制更新 - Plan
type: refactor
date: 2026-10-14
artifact_contract: ce-unified-plan/v1
execution: code
product_contract_source: ce-plan-bootstrap
---

# 画布新机制更新 - Plan

## 目标

更新整张画布的分组、验证和赛程机制。
交付 stage 框选、自动 wave 和 session 排期。
瑞士轮 round 整体映射到 wave。
本文件授权范围为规划，代码开发另行开始。

## 已确定的要求

- R1. wave 是同批不能冲突的基本赛程单位。
- R2. wave 不能跨直接 graph 或 stage。
- R3. 验证自动分组，并在图内统一编号。
- R4. wave 列出全部前置需求的 wave。
- R5. stage 由框选创建，并遵守严格阶段顺序。
- R6. session 在赛程页面组合 wave 和时间段。
- R7. round 仅用于瑞士轮，并完整属于一个 wave。
- R8. 修改图后，重新检查已保存的排期引用。

R1 至 R7 来自用户确定的定义。
R8 保证重新分组后不会错误引用同名编号。

## 定义

画布采用用户确定的 4 个概念。

| 概念 | 定义 | 创建位置 |
|---|---|---|
| stage（阶段） | 具有严格先后顺序的大分组 | 画布框选 |
| wave（批次） | 同批赛程不能冲突的基本赛程单位 | 验证时自动生成 |
| session（时段分组） | 容纳多个 wave 的小分组 | 赛程页面 |
| round（瑞士轮轮次） | 瑞士轮中的一轮比赛 | 瑞士轮组件 |

wave 不能跨所属 graph，也不能跨 stage。
wave 在所属 graph 内统一自动编号。
每个 wave 列出必须完成的前置 wave。
stage 1 全部完成后，stage 2 才能开始。
session 安排 wave 的执行顺序和时间段。
一个 round 只能属于一个 wave。

## 归属与标识

graph 指主图或一个具体 subgraph。
Match 属于直接容纳该 Match 的 graph。
嵌套 subgraph 的 Match 属于嵌套图。
graph 归属按直接 parentId 解析。

wave 使用 graphId、stageId 和稳定标识。
编号只用于显示，不能作为跨图引用。
同一图的编号不在 stage 边界重新起算。
不同图可以各自具有 wave 1。

stage 是框选产生的业务分组。
subgraph 是节点封装产生的结构容器。
stage 和 subgraph 分别保存归属。
同一 stage 可以覆盖主图和子图的赛程。
同一 wave 仍不能合并这些图的 Match。

stage 顺序按整张画布解释。
框选 subgraph 时，默认纳入内部赛程。
内部 Match 的有效 stage 必须能够查明。
重叠框选不能让 Match 同时属于多个 stage。
未归入 stage 的赛程在验证时提示分组。
以上是 stage 归属的建议规则。

## 数据结构

stage 和 session 是用户编辑的数据。
wave 是绑定图版本的验证产物。
Match 不保存手填 wave 编号。
旧 batch 字段仅供迁移审阅。

```ts
type Stage = {
  id: string;
  name: string;
  order: number;
  nodeIds: string[];
};

type SwissRound = {
  id: string;
  swissNodeId: string;
  number: number;
};

type Wave = {
  id: string;
  graphId: string;
  stageId: string;
  number: number;
  matchIds: string[];
  roundIds: string[];
  requiresWaveIds: string[];
};

type WavePlan = {
  graphVersion: number;
  graphDigest: string;
  plannerVersion: string;
  waves: Wave[];
  rounds: SwissRound[];
};

type Session = {
  id: string;
  name: string;
  waveIds: string[];
  timeRange?: {
    startAt: string;
    endAt: string;
  };
};

type Schedule = {
  wavePlanDigest: string;
  boundWavePlan: WavePlan;
  sessions: Session[];
};
```

graphId 使用主图标识或 subgraph 节点 ID。
Stage.order 是唯一正整数。
Stage.nodeIds 保存分组中的 Match 和 Swiss ID。
框选容器时，编辑命令展开实际赛程成员。
成员列表不保存隐式继承和覆盖例外。
验证按成员列表检查唯一 stage 归属。
SwissRound 使用节点 ID 和轮次确定身份。
Wave.id 与显示编号分开。

Session.waveIds 保存用户选择的先后顺序。
同一 wave 只能出现在一个 session 中。
session 可以容纳不同图的 wave。
跨图、跨 stage 不合并 wave，只引用 wave。
session 能否跨 stage 尚未由用户限定。
建议允许跨 stage，但保持阶段完成要求。

WavePlan 和 Schedule 分别保存摘要。
重新验证改变 wave 成员后，旧引用可能失效。
赛程页面显示失效引用，要求重新分配。
系统不能用相同编号替换原 wave。

## 验证与自动分组

验证流程先检查图，再生成 wave。

1. 检查端口类型和图循环。
2. 解析主图与子图的真实端点。
3. 计算赛程的 graph 和 stage 归属。
4. 检查 stage 顺序是否违反比赛依赖。
5. 计算 Match 的前置结果和候选人员。
6. 将每个瑞士轮 round 作为整体调度单位。
7. 按 graph 和 stage 限制自动分组。
8. 检查同 wave 内的人员及结果依赖。
9. 生成跨 wave 的前置需求。
10. 检查 wave 依赖图是否存在循环。
11. 在各 graph 内按依赖顺序统一编号。
12. 保存绑定版本和摘要的 WavePlan。

同 wave 内不能存在结果先后依赖。
同 wave 内不能确定使用同一选手两次。
未来候选重叠时，建议保守拆分。
能证明互斥的候选不按重复人员处理。
同一 round 不因保守策略拆成多个 wave。
未知配对必须保留条件状态。

不同图的波次划分使用同一验证算法。
共同算法不意味着跨图合并 Match。
编号只反映图内顺序，不替代依赖关系。
同一版本和算法应生成相同分组及编号。

编辑时可以显示临时诊断。
临时诊断不作为正式 WavePlan。
最终验证自动生成并记录分组结果。
不再要求验证前手动分配或应用 wave。

## 前置需求

requiresWaveIds 至少覆盖以下需求：

- Match 输入依赖的上游比赛。
- 瑞士轮下一轮依赖的上一轮。
- 后续 stage 依赖的前一 stage 全部完成。
- 跨 wave 共享人员所需的执行先后。

结果依赖可以跨 graph。
stage 完成要求同样可以跨 graph。
全部前置 ID 必须能够定位对应 wave。
前置需求不是引用另一个图的同名编号。

前一 stage 的全部 wave 均为完成要求。
系统可用阶段完成节点汇总这些要求。
返回结果必须能够展开完整需求。
不能只等待晋级出口对应的比赛。

共享人员的两个 wave 不能无约束并行。
无结果依赖时，需要确定人员占用顺序。
建议按稳定调度顺序添加前置需求。
该建议需要保持已有结果依赖。
系统不能通过新增人员顺序制造循环。
无法建立顺序时，验证返回冲突诊断。

## Session 分配

赛程页面读取当前有效 WavePlan。
用户新建 session，并选择多个 wave。
session 内的列表顺序表达执行顺序。
时间段表示该 session 的可用时间范围。

安排时必须检查以下约束：

- 前置 wave 位于更早的可执行位置。
- 后一 stage 等待前一 stage 全部结束。
- 同一 wave 不重复安排。
- 两个 session 不因共享人员产生时间冲突。
- WavePlan 摘要与当前验证结果一致。

一个 session 可以安排前后依赖的 wave。
列表中必须先放前置 wave。
跨 session 的依赖必须检查时间顺序。
有依赖的 session 不能配置重叠执行。
无依赖且人员不冲突的 session 可并行。

时间段不足以证明全部比赛能完成。
验证时长需要比赛预计时长。
首版可以保留“时长待确认”诊断。
本计划不据时间范围推断实际耗时。

## 瑞士轮 Round

round 仅表示瑞士轮中的轮次。
单败和双败使用比赛名称表达竞技位置。
单败首轮不再使用 round 字段。

一个 round 整体归入一个 wave。
一个 wave 可以容纳多个 round。
这些 round 必须属于相同 graph 和 stage。
多个 round 还必须满足同批不冲突。

同一瑞士轮的相邻 round 有前后依赖。
相邻 round 因此不能归入同一 wave。
动态配对未生成时，保留整轮占位。
生成真实对阵后，成员继承所属 wave。
系统随后复验该轮的人员冲突。

当前 Swiss 只生成动态窗口和排名来源。
当前组件尚不能生成逐轮真实配对。
新结构不能把占位描述为已生成真实赛程。

## 编辑、保存与预览

推荐流程为：

1. 在画布创建比赛和子图。
2. 框选节点创建 stage。
3. 保存图。
4. 验证并自动生成 wave。
5. 在赛程页面创建 session。
6. 选择 wave 并配置时段。
7. 检查并保存 session 安排。
8. 查看赛程预览。

图修改后，原验证结果失效。
stage 修改也属于图修改。
封装或展开会改变 graph 归属。
这些操作可能改变 wave 分组。
Match ID 仍保持原值。

重新验证后，赛程页面检查 session 引用。
分组变化必须展示受影响的安排。
系统不得按新编号静默迁移安排。
session 修改不重新划分 wave。
session 修改只重新检查执行顺序和时间。

保存继续使用版本和幂等请求机制。
验证产物绑定保存版本及 graphDigest。
验证可以写产物，不改写比赛及连线。
预览必须读取对应版本的验证产物。

## 验收例子

| 场景 | 预期 |
|---|---|
| 主图和子图的独立比赛均无人员冲突 | 分为不同 wave |
| 同一图的两个 stage 各有比赛 | 不合并 wave，图内编号连续 |
| 两个子图各有 wave 1 | 使用不同 ID，引用不会碰撞 |
| 后一 stage 引用前一 stage 的一个胜者 | 仍等待前一 stage 全部结束 |
| 较早 stage 依赖较晚 stage 的结果 | 验证报告阶段顺序冲突 |
| 同图同 stage 的无冲突比赛 | 可以自动合并 wave |
| 同图同 stage 的比赛共享选手 | 拆分 wave，并产生占用顺序 |
| 两个子图的比赛共享选手 | 不合并 wave，并检查跨图占用顺序 |
| 一个 session 选择多个依赖 wave | 按前置需求排序 |
| session 时间违反跨组依赖 | 报告执行时间冲突 |
| 瑞士轮 round 1 和 round 2 | 分属不同 wave，后轮依赖前轮 |
| 两个独立瑞士轮的同轮比赛 | 同图同 stage 且不冲突时可共 wave |
| 封装后重新验证 | 重算图归属，并检查旧 session 引用 |
| 插入无新增比赛依赖的处理节点 | 不把处理节点当作新赛程单位 |

## 技术决策

- KTD1. 增加 canvas-v2 顶层 stages 字段。stage 不作为节点，也不复用 subgraph。对应 R2、R5。
- KTD2. 把来源分析和 wave 规划拆成纯函数。先求比赛依赖，再按 stage 和 graph 分组。对应 R1 至 R4、R7。
- KTD3. 验证缓存保存完整 WavePlan。校验失败不发布可排期产物。对应 R3、R4。
- KTD4. Wave.id 根据 graph、stage 和成员集合生成。编号不参与 ID。对应 R2、R3、R8。
- KTD5. session 使用独立排期版本及存储。排期不增加画布图版本。对应 R6、R8。
- KTD6. 保留旧草稿读取，提供显式迁移。转换后的图停用旧 batch 约束。对应 R1、R3、R8。

### 存储与版本

现有 planning_canvases.validation 存储验证产物。
新缓存包含 status、WavePlan 和产物摘要。
产物绑定画布版本、图摘要和算法版本。
动态配对使用 conditional 状态。
确定错误使用 invalid 状态。
旧缓存没有 WavePlan 时要求重新验证。

新增 planning_canvas_schedules 表。
每个画布保存一份 session 排期文档。
该文档包含版本、内容和 wavePlanDigest。
canvasId 外键删除时清理排期文档。
读写权限从所属画布的 ownerId 校验。
写入采用 expectedScheduleVersion 和请求键。
幂等指纹区分图保存和排期保存。

排期 GET 保留过期内容，并返回 stale 状态。
排期文档保存绑定时的完整 WavePlan 快照。
旧快照提供成员和依赖变化的比较依据。
新验证缓存不能覆盖排期文档中的快照。
排期 PUT 核对当前有效 WavePlan 摘要。
图改变不删除原 session 数据。
重新绑定需展示成员及依赖变化。
编号相同不能作为重新绑定依据。

### 接口职责

| 接口 | 更新内容 |
|---|---|
| POST /planning-canvas/edit | 增加 stage 创建、成员转移、重排和删除 |
| POST /planning-canvas/migrate | 返回 v1 到 v2 的候选图和迁移摘要，不写库 |
| POST /planning-canvas/analyze | 返回编辑诊断，不发布正式 WavePlan |
| POST /planning-canvases/:id/validate | 自动生成并保存完整验证产物 |
| POST /planning-canvases/:id/preview | 读取该版本的 WavePlan，不重新划分 |
| GET /planning-canvases/:id/schedule | 返回 session、排期版本和失效状态 |
| PUT /planning-canvases/:id/schedule | 检查 wave 引用、顺序、时段和请求键 |

排期保存还需检查画布版本和产物摘要。
版本冲突返回 409，并保留本地内容。
无权限请求不能读取历史幂等结果。

### 依赖和分组算法

算法先构造赛程单位依赖图。
Match 和 Swiss round 是赛程单位。
已知轮空只转发依赖，不占人员批次。
Pool、选择器和展开器不增加赛程单位。

先检查 stage 顺序与结果依赖是否矛盾。
然后按稳定拓扑顺序处理赛程单位。
同图、同 stage 的就绪单位才尝试合并。
内部有依赖或人员冲突时，另建 wave。
未知人员候选使用条件诊断。

共享人员的占用顺序按全局拓扑位置确定。
拓扑就绪队列使用稳定排序键。
键顺序为 stage.order、graphId、赛程单位 ID。
Swiss 单位 ID 包含瑞士节点 ID 和轮次。
节点数组和边数组顺序不参与裁决。
不同图的编号不用于决定该顺序。
跨图占用也产生明确的前置 wave。
合并后再次检查 wave 依赖图。
出现合并导致的循环时拆分该组。
真正的阶段或结果循环返回验证错误。

requiresWaveIds 保存结果、阶段和占用需求。
依赖记录另附来源，供界面解释。
编号使用各 graph 内的稳定拓扑顺序。
同一图跨 stage 继续编号，不重新起算。
首版不承诺生成最少 wave。

### Stage 成员与画布操作

框选只选择当前可见 graph 的节点。
点击“创建阶段”保存选中的节点 ID。
选中 subgraph 时，阶段归属覆盖后代。
已有独立归属的后代必须展示冲突。
转移成员先展示受影响赛程，再整体应用。
清单显示每场比赛的原 stage 和目标 stage。
用户选择整体转移或取消。
转移从旧成员列表移除相同赛程 ID。
一次转移只产生一次撤销快照。

删除节点同步清理 stage 引用。
封装和展开继续引用实际赛程 ID。
容器变化不重写 stage 成员身份。
这些操作保持 Match ID，不保证 Wave.id。
删除 stage 不删除比赛，成员成为未分组。
调整 stage 顺序后重新验证。

stage 框的位置根据成员计算。
stage 框不改变 parentId 或连线边界。
当前平移手势保持原行为。
矩形框选使用单独模式，并支持取消。

### Session 顺序与时段

session 列表保存选定 wave 的先后顺序。
页面提供上移、下移和移动到其他 session。
依赖倒置显示前置位置，并阻止有效保存。
用户可预览按依赖重排的结果。
用户应用重排后才修改本地列表。
不同 session 可以并行，但需检查依赖。
有跨 session 前置需求时，必须配置先后。
未安排的前置 wave 返回待排期诊断。

timeRange 使用带 UTC 偏移的 ISO 时间。
结束时间必须晚于开始时间。
跨 session 比较先换算为 UTC。
缺时段可以保存草稿，但不能标记时间通过。
有依赖的时段按 endAt ≤ startAt 检查。
首版按整个 session 时段保守检查重叠。
没有比赛时长时，保留容量待确认状态。

失效行展示旧成员和旧前置需求。
替换候选按旧赛程成员交集推荐。
推荐不能使用相同编号直接匹配。
用户可删除旧引用，选择当前一个或多个 wave。
替换保留 session 名称和时间段。
替换后立即重算成员、依赖和时间诊断。
尚未修复的引用保留在本地失效列表。
全部引用修复后才能绑定当前产物保存。
缺时间段可以保存，但保持时间待确认。

## 实施单元

### U0. 建立规格变更

- 依赖：无。
- 产物：新建 refactor-planning-canvas-wave-scheduling 变更。
- 范围：proposal、design、planning-canvas 差量规格和 tasks。
- 工作：把 R1 至 R8 及 KTD1 至 KTD6 写入规格。
- 验收：严格校验通过，现有重建变更的完成记录不重置。

旧重建变更保留原验收证据。
新变更说明被替代的 batch 行为。
主规格同步在新行为验收后执行。

### U1. 图模型和 Stage 编辑

- 依赖：U0。
- 文件：backend/src/planning-canvas/graph.js、samples.js，以及前端 types.ts。
- 工作：落实 KTD1、KTD6，增加 stage 编辑动作和严格解析。
- 验收：重复归属报错；跨阶段编号所需元数据保存完整。
- 测试：成员转移可取消；删除 stage 保留比赛；封装与展开保留有效归属。

迁移默认把原赛程归入 stage 1。
该默认值必须出现在迁移预览中。
用户保存迁移后才写入数据库。
加载 v1 时保留原图，显示迁移入口。
调用 migrate 后展示分组和旧 batch 变化。
取消不改变本地原图及保存版本。
应用只更新本地候选图并支持撤销。
原保存接口用 expectedVersion 写入 v2。
数据库新增表按独立迁移版本创建。
旧画布行不随数据库初始化自动改写。
旧 batch 原文保留在迁移摘要中。
新预设只创建比赛依赖，不写固定 batch。
新手动比赛未分组时提示加入 stage。

### U2. 来源、比赛依赖与 Swiss Round

- 依赖：U1。
- 文件：backend/src/planning-canvas/evaluate.js；新增 analysis.js。
- 工作：落实 KTD2，提取与 batch 无关的分析结果。
- 验收：嵌套边界指向真实 Match，round 整体形成调度单位。
- 测试：Pool 不增加单位；轮空转发；Swiss 下游等待结束；阶段反向依赖报错。

先增加能暴露旧深度问题的测试。
再替换批次分析，避免用图节点深度排程。
瑞士轮占位不宣称已生成真实配对。

### U3. Wave 生成器

- 依赖：U2。
- 文件：新增 backend/src/planning-canvas/waves.js 和 canvas-waves.test.js。
- 工作：落实 KTD2、KTD4，生成分组、编号及完整依赖。
- 验收：R1 至 R4、R7 有独立断言。
- 测试：不能跨 graph/stage；局部 wave 1 不碰撞；同图跨阶段继续编号。
- 测试：人员重叠分组；互斥来源；阶段全量等待；合并后无依赖循环。

重复验证同一图时比较完整输出。
调整节点数组顺序不能改变分组及编号。
调整跨图节点顺序不能改变人员占用依赖。
新算法版本变化后，旧产物不能直接复用。

### U4. 验证缓存与预览接口

- 依赖：U3。
- 文件：backend/src/planning-canvas/http.js、graph.js 和 canvas-http.test.js。
- 工作：落实 KTD3，预览读取已保存的验证产物。
- 验收：验证生成 wave，但不改变图版本或图内容。
- 测试：旧缓存拒绝排期；版本变化使产物失效；失败验证不发布可用计划。

移除编辑收尾的旧 batch 重复拒绝。
端口类型、边界和结构循环仍立即拒绝。
排期问题交由分析和最终验证诊断。

### U5. Stage 框选与验证结果界面

- 依赖：U1、U4。
- 文件：前端 view.tsx、index.tsx、properties.tsx、style.css 和 types.ts。
- 工作：增加矩形框选、阶段管理和只读 wave 结果。
- 验收：stage 框选不封装节点；Ctrl 多选和现有 subgraph 功能仍可用。
- 测试：创建、转移、重排、删除、撤销及保存重载。
- 测试：不同图显示独立编号，前置需求可以定位。

Match 参数移除新图的手填 batch 入口。
Swiss 参数保留竞技 round 配置。
单败和双败不增加 round 字段。

### U6. Session 存储与检查

- 依赖：U4。
- 文件：database.js；新增 planning-canvas/schedule.js、schedule-http.js。
- 工作：落实 KTD5，独立保存排期并检查顺序和时段。
- 验收：修改 session 不增加图版本；stale 内容可读但不能标记有效。
- 测试：权限、409、幂等重试、重启恢复及画布删除清理。
- 测试：前置未排、依赖倒置、重复 wave、时段重叠和缺时段。
- 测试：重验证覆盖缓存后，旧快照仍可比较成员和依赖。

排期接口在 app.js 注册。
不复用正式赛事的 schedule_aggregates。
测试只打开临时 SQLite。

### U7. Session 页面与失效恢复

- 依赖：U5、U6。
- 文件：前端 preview-page.tsx、preview-page.css；新增 session-editor.tsx。
- 工作：在现有赛程页面增加 session 编辑区。
- 验收：wave 可选择、排序、移除和配置时间段。
- 测试：跨图选择；前置提示；独立保存；重新验证后的失效引用修复。
- 测试：替换失效引用保留时段；仍有失效引用时不绑定当前产物。

未安排 wave 显示在待排期列表。
结果筛选区分 stage、graph、wave 和 session。
同名 wave 标签附所属 graph。
保留日期分组和比赛行展示。
未定时内容不能混入已定时列表。

### U8. 回归与交付

- 依赖：U1 至 U7。
- 文件：canvas 领域/接口测试、frontend/e2e/canvas-lab.spec.ts 和操作说明。
- 工作：核验迁移和完整使用流程，更新规格证据。
- 验收：定义表和验收例子全部有证据。
- 浏览器：360、768、1440 像素宽度可完成框选、验证和排期。

领域测试按行为先建立断言，再修改代码。
前端测试检查实际操作和数据结果。
清理试验代码后再声明开发完成。

## 交付顺序

| 交付 | 单元 | 用户可操作的结果 |
|---|---|---|
| A：分组和验证 | U0 至 U5 | 框选 stage，保存后验证自动生成 wave |
| B：赛程安排 | U6、U7 | 创建 session，安排顺序和时段 |
| C：完整验收 | U8 | 迁移、重启、异常和浏览器证据完整 |

A 可以单独验收，不宣称 session 已完成。
B 可以先测试接口，再接入页面。
正式开发结束以 C 的门槛为准。

## 验证入口

以下命令用于开发验收，本轮不执行。

| 范围 | 命令 | 结果要求 |
|---|---|---|
| 领域与接口 | backend 下 node --test test/tournament-configuration/canvas-*.test.js test/platform/canvas-*.test.js | U1 至 U4、U6 的行为通过 |
| 后端回归 | backend 下 npm test | 旧正式赛事行为无回归 |
| 前端 | frontend 下 npm test、npm run build | 编辑、排期及类型通过 |
| 浏览器 | frontend 下 npx playwright test e2e/canvas-lab.spec.ts | 完整流程与 3 个宽度通过 |
| 规格 | openspec validate refactor-planning-canvas-wave-scheduling --strict | 差量规格与任务一致 |

## 完成标准

- R1 至 R8 均有领域或浏览器验收证据。
- 保存、验证产物和 session 排期版本可分别核对。
- 旧草稿能预览迁移、取消及保存后重载。
- 不靠显示编号匹配旧排期引用。
- 新界面不存在手填 wave 或单败 round 入口。
- owner 权限、版本冲突和幂等行为没有回归。
- 操作说明和 OpenSpec 验收证据更新完成。

## 待明确的细节

用户已确定概念和分配时机。
以下细节采用本文件中的建议：

- stage 顺序覆盖整张画布。
- 框选 subgraph 默认纳入内部赛程。
- session 可跨 stage，但遵守阶段顺序。
- 候选人员重叠默认保守拆分。
- 跨 wave 的共享人员产生顺序要求。

这些规则不改变用户确定的概念。
开发前需要把规则写入规格及验收条目。

## 代码依据

- backend/src/planning-canvas/graph.js：图结构及候选编辑。
- backend/src/planning-canvas/evaluate.js：候选来源及批次诊断。
- backend/src/planning-canvas/samples.js：预设的旧 batch。
- backend/src/planning-canvas/http.js：验证缓存及版本门槛。
- frontend/src/features/planning-canvas/preview-page.tsx：赛程预览。
