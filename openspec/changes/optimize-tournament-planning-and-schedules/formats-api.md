# v2 格式目录与参数 API（任务 1.1）

2026-10-08。本切片提供服务端规则目录、严格参数解析、草稿保存及分层校验。页面接入、重复组生成/影响确认、显式复制升级与 v2 完整图编译/运行仍由后续任务实施。

## 目录

GET /api/v1/formats，需要登录。返回 format-catalog-v1、structure-v2/routing-v2，以及八个规则版本的 format、中文 label、defaults、parameterSchema、confirmationProfile 和 runtimeReady=false。参数 schema 采用 JSON Schema 的 object/array/integer/string/boolean、enum、minimum/maximum、uniqueItems/minItems 与 additionalProperties=false 子集；服务端使用同一描述校验，不依赖前端。

| ruleVersion | format | 每组人数×数量 / 每组晋级 |
|---|---|---|
| single-cut-v2 | single-elimination | 8×1 / 1 |
| gsl-classic-v1 | gsl | 4×4 / 2 |
| de-standard-v1 | double-elimination | upper 8×1 / 1，lower disabled |
| de-lower-entry-v1 | double-elimination | upper 8×1 / 1，lower disabled，可选 same/half |
| swiss-fixed-v1 | fixed-swiss | 16×1 / 8，4轮 |
| swiss-threshold-v1 | threshold-swiss | 16×1 / 8，3胜/3负 |
| round-robin-v2 | round-robin | 4×1 / 2，单循环 |
| double-round-robin-v2 | double-round-robin | 4×1 / 2，双循环 |

所有规则默认 BO3。seeding={kind:"seed",seedTableVersion:"recursive-v1"}；可选 slot。overrides 提供各格式允许的角色 BO 和 rounds={"1":1,"2":5}；仅接受 BO1/3/5/7。上述字段先持久化，实际对阵与BO执行仍等待对应运行任务。瑞士小分、循环积分、季军战/重置、败者入口、阈值等完整字段以目录 schema 和 parameters.md 为准。重复调用目录返回独立副本，修改返回对象不会污染后续验证。

## 保存

沿用 POST /api/v1/tournaments/:tid/configurations、PUT /:cid，载荷仍为 {payload,...expectedVersion}，会话/structure.edit、Idempotency-Key、乐观版本与事务边界保持原约定。

最小阶段请求：
```json
{
  "entrantKind":"individual",
  "structureVersion":"structure-v2",
  "routingVersion":"routing-v2",
  "stages":[{
    "id":"s1","name":"阶段一","order":1,
    "format":"single-elimination","ruleVersion":"single-cut-v2",
    "groups":[{"id":"g1","stageId":"s1"}]
  }],
  "pools":[],
  "routes":[]
}
```

groupSize/groupCount/qualifyCount/parameters 缺省从规则目录填充；null不是缺省值。阶段 capacity 与各组 capacity 由人数派生；如果显式提交，必须与派生值一致。双败人数为 upper+lower；half 为 N/2，same 为 N；单阶段总输入和所有独立根入口合计不得超过64，不把后续晋级重复加人。

业务未完整的字段类型合法草稿可以保存，但校验报告为非法。例8→3单败；half 下奇数 upper 的派生人数无法确定时 capacity=null，不保存虚假的半名选手；报告定位非法 groupSize。

本切片由调用者提供稳定 groups；自动生成/扩缩/影响确认属于1.2。基础 stage/group/pool 与 selector/placement 路由引用继续严格核验，共享现有引用检查；具名 upper/lower 出入口及新编译图契约属于3.1–3.3，不宣称本切片完成它们。

## 校验与错误

POST /:cid/validate 返回 structureValid、previewReady=false、runtimeReady=false，业务错误包含 FORMAT_PARAMETERS_INVALID 与精确参数路径。未知字段/类型、跨赛事、非法规则版本/赛制组合、超过64人的请求为422 INVALID_INPUT；失败不改变版本、结构或成功请求记录。

跨结构/路由版本原地 PUT 返回409 CONFIG_VERSION_UPGRADE_REQUIRED；显式复制另由1.4实现。旧 v1 冻结/运行保持原规则。任务3.1完成后，合法 v2 冻结返回200并保存完整plan/planDigest；非法 v2 先返回422 CONFIG_INVALID。编译契约见compiled-plan-api.md。实际运行支持仍false。规则目录存在不等于运行器已实现；不自动改变既有能力或冻结快照。

## 2026-10-09 单败实际运行更新
3.3/4.1/4.2已验收，single-cut-v2已开放实际运行；新目录及冻结报告runtimeReady=true。旧冻结字段不重写，启动按冻结计划和规则复核。入口与操作见entry-runtime-guide.md，完整证据见acceptance-entry-single.md。
