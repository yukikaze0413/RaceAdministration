# Design

## Context

动机及范围见proposal.md。现场backend/server.js只挂载旧/api/races和/api/test；raceController.js使用模块内数组，更新和ID行为未达到新结构要求。backend/package.json为CommonJS，仅依赖Express，test脚本是占位失败；没有前端、身份系统或数据库实现。
Node现场为v24.11.1。新模块与旧原型隔离，复用JavaScript运行时并不确认全平台技术栈。
用户选择个人、预设路由并开赛前冻结；研究E6/E7约束结构和预演。研究E1-E5用于未来赛制引擎选型，不作为本change配对测试承诺。
本设计必要：新增结构聚合、权限与原子冻结契约，不能省略设计。

## Goals / Non-Goals

**Goals:**
- 通过同一份结构输入完成保存、校验、模板复制、结构冻结和只读预演。
- 将确定性路由算法与存储、权限、输出适配分开；接口可被未来Web服务复用。
- 为每次成功/失败提供可观察结果，使用独立人工预期，明确并发、失败和未来输入限制。

**Non-Goals:**
- 本次不连接生产认证/数据库，不公开HTTP写入；本地演示使用显式测试授权适配，不把任意载荷role当可信权限。
- 不实现任何配对算法、赛果确认、实际路由提交或开赛。整轮收齐→确认→锁定→推进契约保留给后续运行change；预演不能代替它。
- 不用研究中的未冻结赛制解决Q24-C或计算排名。

## Decisions

### D1 以独立领域模块交付第一切片

计划backend/src/tournament-configuration/{domain,application,adapters}，测试backend/test/tournament-configuration/，JSON样例backend/examples/tournament-configuration/。
domain负责结构/输入解析、静态校验和路由预演；application负责授权、版本及幂等；adapters只提供内存原子仓库和本地文件演示。
选CommonJS与原生node:test，最小Node基线22 LTS或更高，避免为了结构逻辑引入框架。现场24可运行，但实施需验证目标Node版本。
替代：直接扩展raceController数组会混淆原型与新模型；先选ORM/前端会引入不影响本切片的未决项。本次不采用。
演示脚本将使用backend/scripts/tournament-configuration.js，命令为validate/preview/demo；demo在一个进程中演示创建、修改、冻结及冻结后拒绝修改，不承诺进程重启后内存持久化。

### D2 数据契约structure-v1/routing-v1

| 对象 | 关键字段及边界 |
|---|---|
| Configuration | id、tournamentId、version（正整数）、state（draft/structure-frozen）、entrantKind=individual、structureVersion、routingVersion、templateOrigin、stages/pools/routes |
| Stage | id、order（同赛事唯一正整数）、capacity、formatIntent、groups；没有组时stage本身为唯一输入容器 |
| Group | id、stageId、capacity；有组阶段的capacity等于各组容量之和；无跨阶段组引用 |
| Pool | id、capacity、sort；只接收来源，不是比赛阶段，不含真实赛果 |
| Route | id、source（stage+可选group或pool）、selector、quota、sort、target（stage+可选group或pool）、placement |
| Selector | rankRange闭区间、recordEquals{wins,losses,draws}、all（仅pool）；一条规则只用一种selector，不引入自由代码表达式 |
| Placement | 目标stage/group为{kind:seed/slot, positions:[正整数]}；目标pool不配置位置，以池全量排序产生新种子 |
| Snapshot | snapshotId、frozenFromVersion、冻结后version、结构数据、限制诊断、内容digest、时间/操作者、runtimeReady=false |
| Preview input | roster[{entrantId,initialSeed,exitState}]与sourceSnapshots[{sourceId,version,completed,rankingProfileId,recordProfileId,entries}] |
| Source entry | entrantId、rank、wins/losses/draws、points（按排序需要）；身份/初始种子/退出状态从roster引用，避免各阶段副本互相矛盾 |
| Diagnostic | code、severity（error/conditional/info）、objectId、routeId（可选）、path（JSON Pointer）、reason、details |

本切片Stage.formatIntent枚举single-elimination/double-elimination/round-robin/double-round-robin/fixed-swiss/major-like；都是意图，无ruleProfile或运行支持。
容量与quota为正整数；空草稿可暂存null/缺失待填字段，冻结前所有结构必需值必须完整。ID非空，字段白名单拒绝拼写错误。
Stage.order是配置依赖次序，不是时间排程。stage→stage依赖要求source.order<target.order；经pool仍要求所有上游阶段早于其所有下游阶段。pool链允许DAG且不得无来源循环。
初始名单只用于预演：entrantId唯一、initialSeed唯一且为正整数。相同参赛者可在不同顺序阶段的来源快照重复引用；同一来源/池/目标阶段内不得重复。
exitState只接受active/withdrawn/disqualified且原样传递，不在此模块触发处罚。

### D3 有限路由语言与确定性排序

sort是非空有序字段列表，可使用sourcePriority（配置的完整来源顺序）、sourceRank、initialSeed、poolSeed、wins/losses/points。池合并若按points排序需所有输入rankingProfileId相同；跨来源按wins/losses排序需recordProfileId相同；数值有限，缺值失败。
initialSeed作为显式末级兜底可形成全序；不自动追加ID/随机数。poolSeed仅对已经重排的池输出可用，来源种子不能被误称为池种子。
执行顺序：
1. 验证结构和来源结果；按DAG找到路由所需全部来源及上游池输入。
2. 每条stage来源按selector筛选、按完整sort排序，再取quota人；不足即失败。并列rank筛选先保留所有满足者，再排序/取额。
3. 池等待所有输入。重复身份在池合并时（输出截取前）直接失败；全量排序生成1..N新种子。quota总和不得超过池capacity。
4. 池出路由按配置排序并取quota；每条映射第i个入选人→positions[i]。stage/group有独立输入位置空间；source或target的stage有组时路由必须指定group，容量归组、重复身份检查归整个stage。
5. 聚合目标检查重复身份/位置/超额；全部成功才返回allocations，失败返回诊断且allocations为空。输入完整但多余未入选者列在excluded，便于解释。
每个输出保留entrantId/exitState、source及sourceRank、initialSeed、可选poolSeed、target及positionKind/value。只转换声明的字段，不继承上一阶段积分到下一阶段。
替代：自由条件脚本无法安全静态核验；按数组顺序或ID隐式破同分无法解释晋级。本版不采用。
预演支持一个或多个目标及其完整上游闭包。没有池之前的模拟阶段结果不能从结构推导，必须由调用者提供。后续真实阶段执行需另行实现整轮锁定与来源结果读取。

### D4 分层校验与算法边界

解析校验负责非法类型/未知字段；静态业务校验负责：
- 同赛事引用、对象归属、order、DAG（拓扑失败返回循环路径）。
- 容量/quota/positions数量与范围；显式输入位置不重复；种子或槽位同一目标不允许混用，避免未知seed→slot映射下的隐性冲突。
- 来源同种selector可证明的区间交集/同记录重叠给error；不同selector的未来交集标conditional，在预演复查选中身份。同源多输出若不互斥，须调整筛选而非静默复制。
- 所有sort字段/顺序完备；不存在poolSeed前置使用或不可识别字段。
动态校验负责来源completed、版本、名单和数值、实际筛选交集、全序、名额和目标身份。
validate输出{configurationId,version,structureValid,previewReady,runtimeReady,diagnostics}；无样例previewReady=false。preview输出另含inputVersions、allocations、excluded，失败分配为空。
FORMAT_RUNTIME_UNAVAILABLE为info，不是静态error；动态未知为conditional，允许结构冻结但不能开赛。静态error阻止冻结。
所有赛制运行支持为空；请求真实配对返回RUN_NOT_SUPPORTED，不调用任何随机配对替代。deterministic pairing在本change无实现：确定性只覆盖结构标准化、诊断顺序和路由预演；赛制接入时冻结官方版本再独立规划。
诊断按path/code/routeId字典序稳定排序；配置hash递归对象键排序、语义数组顺序保留，JSON数字拒绝NaN/Infinity，不据对象属性原始顺序改变hash。

### D5 应用接口、授权与原子状态

接口不是HTTP路由；参数角色与信任边界如下：

| 接口 | 入参/结果 | 权限 |
|---|---|---|
| createDraft / instantiateTemplate | trustedContext, tournamentId, requestKey, payload / 当前草稿 | configure |
| getConfiguration | trustedContext, tournamentId, id / 深拷贝配置或快照 | view |
| replaceDraft | trustedContext, tournamentId, id, expectedVersion, requestKey, payload / version+1 | configure |
| validateConfiguration / previewRouting | trustedContext, tournamentId, id, expectedVersion, optional sources / 版本化报告 | view |
| freezeStructure | trustedContext, tournamentId, id, expectedVersion, requestKey / 同一冻结快照 | configure |

每次先检查可信授权端口authorize(context,tournamentId,action)。本地示例由启动脚本显式构造context；JSON不能携带有效grant。没有对应授权一律拒绝。
错误契约：FORBIDDEN、INVALID_INPUT、NOT_FOUND、VERSION_CONFLICT、STRUCTURE_FROZEN、IDEMPOTENCY_CONFLICT、CONFIG_INVALID、SOURCE_NOT_READY、ROUTING_UNRESOLVED、RUN_NOT_SUPPORTED、STORE_FAILURE；诊断细节仅在授权后返回。
原子仓库port以单赛事事务处理该赛事配置映射及共享幂等记录；内存适配通过每赛事串行互斥锁保护整个异步操作，事务在候选副本上执行，成功才交换赛事聚合，失败注入不改变原状态。创建新配置也在此锁内，避免相同幂等键跨实例重复创建。
写操作幂等作用域为tournamentId+actorId+requestKey，指纹包括操作、配置ID、expectedVersion及规范化payload。模板首次实例化产生ID并保存在原结果中，重试不重新生成。相同键不同指纹拒绝。
冻结处理顺序：授权→查幂等成功记录（同指纹可返回，先于版本检查）→原子读取→expectedVersion→draft状态→静态复验→建立不可变副本与摘要→草稿状态/版本+1→快照及幂等记录一起提交。审计元数据与记录一并保存；失败不留成功幂等条目。
不同键再次冻结返回STRUCTURE_FROZEN；同键重试返回原快照。同版本编辑vs冻结只允许一方成功。replaceDraft同样进行compare-and-swap且拒绝冻结对象。
所有接口先用显式tournamentId授权，再在该赛事内查配置ID，不能先读取其他赛事配置确定归属。requestRuntime只作为受view授权的不可用运行请求边界，始终返回RUN_NOT_SUPPORTED，无执行副作用。只读校验/预演读取一个深拷贝版本快照，expectedVersion不匹配拒绝；计算中即使草稿发生后续编辑，报告仍标注被读取版本，不能拿报告替代冻结内部复验。
不产生后台任务、通知或自动同步副作用。生产数据库适配未来必须提供等价原子保证，不能靠进程内锁宣称跨实例正确。

### D6 独立样例与行为验证

手写fixtures存输入和单独expected文件，预期不得调用被测路由生成器。
主要算例：E6四组冠军分流与3–0→slot1/8；额外A/B池合并（源优先级A/B，输出新seed1/2）；DQ冠军跨阶段状态延续。
错误集E7：容量不足、重复槽、重复身份、循环、缺来源；再加并列名次、不可比积分、输入数组排列、模板副本隔离、版本冲突及冻结故障。
将PRD→规格→任务→验证关联保存在tasks.md，无第二份执行清单。实施时逐行为确认红→绿，切片评审时必要重构再回归；本轮只规划，未运行这些测试。
计划命令：在backend运行node --test test/tournament-configuration/*.test.js；node scripts/tournament-configuration.js validate <fixture.json>；preview <fixture.json>；demo。CLI JSON报告与应用接口一致，失败exit 1，成功exit 0；不输出凭据或把样例权限暴露为HTTP认证。
完整平台模拟比赛、五类赛制配对及真实用户验收留后续，不能用此命令声称完赛已验证。

## Risks / Trade-offs

- [静态校验不能预测赛果] → conditional保留至快照并在预演/未来运行复查，绝不给runtimeReady=true。
- [只交付本地领域切片，不能网页办赛] → 演示和文档明确此边界；后续平台接入单独规划。
- [内存适配不能保证重启持久化和跨进程并发] → 本切片限制单进程，未来持久化适配必须重新核验事务。
- [成绩字段跨赛制不可比] → 显式规则标识和严格缺值/同分错误，池全序由配置提供。
- [模板升级悄悄改赛事] → 快照保留模板版本，实例深拷贝且不自动升级。
- [未来淘汰处罚冲突] → 本版仅携带退出状态；不推导胜者、排名或特殊比分。

## Migration Plan

新模块、样例和测试独立加入，不迁移旧races数组，不改变旧API。先按任务切片验证，再演示配置闭环；不部署生产服务。
撤销仅移除新模块及对应测试/脚本；没有真实赛事数据写入。已冻结样例不能靠解冻改路由，需新建草稿实例重新演示。
未来将结构快照接入真实赛事之前，必须规划身份/持久化、具体赛制规则及实际开赛门槛；本版无兼容未知规则自动升级。未来运行规则须以单独版本化启动配置引用此结构快照，不修改已冻结结构；激活与完整赛制参数冻结由对应change定义。

## Open Questions

无阻止本切片的未决项。以下仅影响后续change：组队报名；Q12-T全平台栈；Q14报分冲突；Q21/Q22-A/Q24-C/Q25处罚及退出结算；Q26实际推进单位；各赛制Q27和Major冻结版本。它们不授权在本change添加运行实现。
