# 时间计划接口

`GET /api/v1/tournaments/:tid/schedule` 遵守赛事可见性。返回 schedule、permissions、已冻结 configurations、当前 configuration 的结构/计划摘要、脱敏 runtime、runtimeVersion、items 和实时 validation。可用 configurationId 查询参数只读查看另一已冻结配置。公开投影不含 audit/requests/userId/actorId/报名答案；客户端草稿修改不能当作已保存报告，页面标出时间/运行版本。

`PUT /api/v1/tournaments/:tid/schedule` 需要当前 structure.edit、Idempotency-Key，正文 `{expectedVersion,payload,reason?}`。payload 为 `{configurationId,resources,windows,assignments}`：

- resources：`{id,name}`，ID赛事内唯一。
- windows：`{id,name?,startsAt,offsetMinutes,durationMinutes?,minRestMinutes?,streamUrl?,planKey?}`；startsAt 为带时区ISO即时值，规范化为UTC；offsetMinutes独立保存。默认预计60、休息0分钟。planKey仅引用未来瑞士轮次窗口。
- assignments：`{planKey,windowId,resourceId?,durationMinutes?,minRestMinutes?}`；每个具体比赛仅一条安排，时长/休息可覆盖窗口值。

新独立schedule_aggregates表migration2，版本/请求缓存/审计在该聚合内；不增加结构或运行版本。当前角色在成功键重放前复核。旧时间版本409；错误引用、字段、明确资源/身份/依赖冲突422且原计划/缓存/版本不变。未知身份与前置保留pending，不能宣称无冲突；条件已未激活信息为info。保存保留前一版安排审计、冻结structureDigest/planDigest；缓存成功请求在SQLite重启后仍返回同一结果。

`POST /api/v1/tournaments/:tid/matches/:mid/actual-start` 需要当前results.edit和运行expectedVersion/请求键。可传actualStartedAt（带时区ISO，不能未来）；省略则确认当前服务端时刻。只接受当前未锁定且非轮空比赛，既有实际时间不能覆盖。该动作改变运行版本，不改变时间计划版本。首个POST赛果提交也记录服务端实际开始，PATCH裁定本身使计划锁定但不编造开始时间。

operations写入在同一事务末尾重检已绑定时间计划；重检存储失败使运行及时间写入一同回滚。瑞士新配对不自动绑定或修改预约窗口；PAIRING_ASSIGNMENT_PENDING明确列出新对局。公开GET重新计算当前投影；resources/participants/dependencies的明确冲突标blocked，时间不自动修复。

注销预览token包含时间计划数据；时间计划变更使旧预览失效。删除自有赛事同步清时间表；他人赛事只清本人请求缓存/审计actor，保留比赛身份和已安排时间。时间表拥有赛事外键。
