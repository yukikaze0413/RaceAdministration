# 赛事结构本地样例

个人参赛；结构与路由版本 structure-v1 / routing-v1。four-groups.json 包含 A 四组及 B/C 后续阶段，池是独立对象，不是阶段内小组。

本模块未开赛，不接 HTTP；授权由可信应用端口传入，JSON 的 role 不能授予权限。仓库为单进程内存，重启丢失；不代表生产认证或持久化。

## 契约与模板

模板 four-groups@1 与 pool@1 创建独立内部ID，引用及来源优先级同步改写，不包含真实名单或授权。结构白名单：entrantKind、structureVersion、routingVersion、templateOrigin、stages、pools、routes；对象字段详见 domain/structure.js。未知字段拒绝；容量/排序可缺失以暂存草稿，冻结前必须补齐。

sort 为 {field,direction,sources?} 数组，direction 为 asc/desc；sourcePriority 必须明确所有来源ID。路由 source/target 为 {stageId,groupId?} 或 {poolId}；分组阶段必须指定组。selector 为 rankRange{from,to}、recordEquals{wins,losses,draws}、池用 all。stage/group 目标 placement 为 {kind:seed|slot,positions:[...]}; pool 不配置 placement。

校验 error 阻断冻结；conditional 表示未来输入复核，允许结构冻结；info 保留运行不可用声明。structureValid 不表示 previewReady 或 runtimeReady。六类意图运行支持集为空，FORMAT_RUNTIME_UNAVAILABLE 始终可见。

错误包含 code/severity/objectId/routeId(若涉及路由)/path/reason/details；path 是 JSON Pointer，按 path/code/routeId 稳定排序。应用错误为 FORBIDDEN、INVALID_INPUT、NOT_FOUND、VERSION_CONFLICT、STRUCTURE_FROZEN、IDEMPOTENCY_CONFLICT、CONFIG_INVALID、SOURCE_NOT_READY、ROUTING_UNRESOLVED、RUN_NOT_SUPPORTED、STORE_FAILURE；静态细分码包括 DEPENDENCY_CYCLE、ORDER_INVALID、CAPACITY_EXCEEDED、POSITION_CONFLICT、PLACEMENT_KIND_CONFLICT、SELECTOR_OVERLAP、POOL_SEED_UNAVAILABLE 等。不同筛选的未来交集保留 SELECTOR_INTERSECTION_UNKNOWN。

## 预演

来源 sources 包含 roster[{entrantId,initialSeed,exitState}] 与 sourceSnapshots[{sourceId,version,completed,rankingProfileId,recordProfileId,entries}]；sourceId 为阶段ID或组ID。entry 是 {entrantId,rank,wins,losses,draws,points?}。字段值不补默认数字，战绩必须非负整数；rank 可以并列，但排序必须形成全序。

处理顺序为筛选→排序→截取固定名额→落位。池等待全部上游，先检查重复身份再全量排序生成 poolSeed；保留来源、sourceRank 和 initialSeed。按 points 排序要求统一 rankingProfileId，按 wins/losses 要求统一 recordProfileId。targetIds 可选地指定目标阶段/组，读取完整池上游闭包；未提供时预演全部路由。预演只读，不生成配对、比分或处罚。active/withdrawn/disqualified 原样携带；DQ冠军仍分配，不解决淘汰双退出冲突。

four-groups、record、pool 的 *.expected.json 是独立手写预期。pool 示例包含 DQ；record 用 p/q/r 的 3–0 选 p/q→slot1/8。预演失败 allocations 为空，不返回可应用的部分结果。

## 冻结与原子边界

| 当前状态 | 操作 | 结果 |
|---|---|---|
| draft | replaceDraft，版本匹配 | version+1，仍为draft |
| draft | freezeStructure，静态无error | version+1，structure-frozen，唯一快照 |
| structure-frozen | 修改/解冻/不同键再冻结 | 拒绝 |
| 任意 | 同键同请求重试且权限仍有效 | 返回原成功结果 |
| 任意 | 同键不同操作/载荷/版本 | IDEMPOTENCY_CONFLICT |

写键作用域为 tournamentId + actorId + requestKey，指纹包含操作、配置ID、expectedVersion及规范化JSON；对象键序不影响摘要，数组语义顺序保留。授权每次重新检查；重试成功记录早于版本检查。失败不保存成功记录。

单赛事异步互斥锁包围完整事务；候选副本完成后提交，快照、配置与幂等故障任何一步失败都丢弃候选副本。beforeCommit(candidate,step) 提供事务适配的故障检查点，step为 snapshot/configuration/idempotency；这不是生产数据库逐表写入。单进程内存保证不覆盖重启或多实例，未来适配器必须提供等价数据库事务、唯一幂等约束与并发控制。

快照记录结构、版本、templateOrigin、digest、时间、操作者和conditional/info限制；started=false、runtimeReady=false。冻结时内部重新验证，不信任先前只读报告。所有读取返回副本，修改响应对象不会修改存储。

## 运行命令

在 backend 目录运行（Node.js 22+；本次实际环境 v24.11.1，未另行验证22）：

```powershell
npm test
node --test test/tournament-configuration/*.test.js
node scripts/tournament-configuration.js validate examples/tournament-configuration/four-groups.json
node scripts/tournament-configuration.js preview examples/tournament-configuration/four-groups.json
node scripts/tournament-configuration.js preview examples/tournament-configuration/pool.json
node scripts/tournament-configuration.js validate examples/tournament-configuration/invalid.json
node scripts/tournament-configuration.js demo
```

JSON 包装为 {configuration,sources?,targetIds?}。CLI 显式构造仅本进程有效的授权对象；不从文件读取角色/凭据。成功退出0；非法结构、失败预演或命令错误退出1，stdout为JSON。validate 可只检验静态结构；preview 要求来源完整。demo 在同一进程创建、修改、预演、冻结并验证拒改；再次启动不保留内存。npm run configuration:demo 等价。

应用入口为 require('./src/tournament-configuration/application/service').createService({authorize,store?})。接口参数参照 [设计D5](../../../openspec/changes/archive/2026-10-04-plan-tournament-structure/design.md)；提供 expectedVersion 和 requestKey，previewRouting 的 sources 是上述模拟输入。不得将 authorize:()=>true 作为HTTP认证。
