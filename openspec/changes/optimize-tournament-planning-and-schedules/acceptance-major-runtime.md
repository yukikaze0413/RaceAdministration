# 科隆 Major 运行工程验证（2026-10-10）

7.1、10.1保持未完成。`major-cologne-2026-v1`已注册目录及runtimeReady，完成参数页、三宽度操作和真实HTTP工程验证；真实历史时间、官方种子快照采用/调整记录与完整演示导入验收继续pending，不将工程吻合冒充官方资料完整。

## 已验证的运行行为

`major-runtime.test.js`使用冻结的历史事实比分与独立配对预期，逐场裁定并确认三个阶段，各33场，共99场。每轮实际配对与历史预期相同，Stage1/2普通比赛BO1、晋级/淘汰比赛BO3，Stage3全部BO3。各阶段最终16队胜负记录一致、实际8队晋级。

`major-v2-http.test.js`三项独立阶段回放实际执行配置创建/冻结/报名/审批/锁定/启动/比分/轮次确认及同键重试，逐轮比较历史对阵、BO与最终记录。第四项在同一赛事跑完整106场：32唯一参赛身份，Stage1直邀16、Stage2/3各8直邀；上段rank1–8按sourceRank升序映射下段seed9–16，后段直邀占1–8。每段实际bindings与独立初始种子完全一致。三段99场后接八强单败7场，决赛BO5、Falcons冠军、FURIA亚军。未写入或推断历史实际开赛时间。

参数页面只提供16人数、8晋级、普通BO1/3、晋级和淘汰BO3、固定排序，不提供轮次BO覆写；DTO将任何非空rounds覆写拒绝为INVALID_INPUT。默认普通BO3用于全BO3阶段；Stage1/2选择普通BO1即可。既有八通用规则保留，目录现为八通用加一个Major版本。

Major配对输入保留全部16队，包含已经晋级和淘汰的对手；输入摘要因此覆盖退场对手的当前胜负与DS。运行器拒绝偏离16队、3胜/3负、8晋级、5轮、禁平局/双方负、官方排序及BO配置的私有计划。通用瑞士版本仍使用自己的参数和配对政策。

## 重赛例外与审计

自动配对依次执行官方首轮表、R2/R3整组可完成性搜索及R4/R5的15行优先表。自动路径始终不允许重赛。人工裁定重新运行当前完整输入的专用政策，仅在搜索结果为unsat、明确allowRematch=true且原因非空时允许重赛；达到预算的solver-limit不等于无解。同战绩组、完整覆盖、inputVersion/hash、当前写权限与事务复验保持约束。

裁定后的轮次保存rematch标记，HTTP保存裁定人和原因。后续输入仅从已确认轮次的这些审计记录导出历史重赛授权；授权次数必须精确匹配双方对手历史，DS按每次实际交手贡献累加。缺授权、授权次数不一致、缺裁定人或伪造DS均拒绝。人工的重复历史和优先表耗尽测试是明确标注的人工聚合输入，不冒充合法历史赛事。

前端只在Major无重赛方案确实耗尽时提供“确认 Major 重赛例外”；完整参与者、同战绩组及原因齐全，勾选后方可提交。solver-limit和通用瑞士不提供例外。组件测试核验当前inputVersion/hash、expectedVersion及allowRematch请求。

`major-v2-lifecycle.test.js`新增3项专属HTTP生命周期验证：明确例外授权及审计/确认后重赛DS、旧hash/solver-limit拒绝非法例外/数据库故障回滚/原键重试/当前角色撤销和公众脱敏、独立临时SQLite关闭后重开应用并恢复计划/比分/摘要/幂等响应。人工优先表耗尽和预算阻塞夹具明确不冒充真实历史比赛或自然搜索耗尽；重启用稳定原主办身份重新登录，测试时钟前移避免人工未来限流记录影响。

## 验证证据

- `cologne-major-runtime-red.log`：接入前仍采用通用配对版本。
- `cologne-major-parameters-red.log`：接入前未拒绝偏离Major的阈值参数。
- `cologne-major-manual-red.log`：接入前人工配对可跨战绩组。
- `cologne-major-rematch-red.log`、`cologne-major-approved-history-red.log`：例外裁定及历史授权红灯记录。
- `cologne-major-approved-history-green.log`：21项专用政策测试通过。
- `cologne-major-manual-integration-green.log`：34项专用运行/政策及通用瑞士HTTP回归通过。
- `cologne-major-manual-backend-full.log`：281项后端全量回归通过，0失败。
- `cologne-major-full-event-http.log`：三独立阶段加同一赛事106场，4/4通过。
- `cologne-major-full-event-backend-final.log`：最新285项后端全量回归通过。
- `cologne-major-frontend-full.log`：85项前端测试通过；`cologne-major-build.log`：类型检查和正式构建通过。
- `cologne-major-browser-current.log`：当前构建Edge10/10，包括九规则默认参数保存/恢复、fixed/threshold/Major三版本在360/768/1440宽度的完整运行、排名和刷新，截图保存。Major单阶段每例33场；这些浏览器比赛是操作算例，不是106场历史比分浏览器回放。
- `cologne-major-lifecycle.log`：3项Major专属权限、例外、回滚、幂等和临时库重启验证通过。
- 独立只读核验确认完整名单摘要、授权次数、unsat门槛、审计来源与通用硬禁；主代理抽查关键源码并执行上述最终测试。

上一轮全量测试的失败为game-presets测试随机取得Fetch禁止端口，已将其测试夹具改为可重试的高端口范围。此前失败日志保留。真实数据库未打开或迁移。

首次浏览器批次`cologne-major-browser.log`在新构建完成前加载旧页面，Major360找不到新角色标签超时；其他9项通过。先完成新构建后重新运行整批，当前10项全部通过，不把初次结果写成全通过。独立目录/HTTP核验提出rounds覆写可能被保存的疑点，主代理读取实际schema并执行非法DTO，得到`/stages/0/parameters/overrides/rounds/1`未知字段拒绝；页面组件也确认不存在添加轮次BO控件，该疑点未成立。

## 待完成

完整106场历史比分演示导入与浏览器、全部赛事最终名次；官方种子快照采用/调整记录及真实历史时间证据。May4排名与全部历史配对一致仍不等于已取得ESL明确采用日期的公告。源证据任务0.2和四案例最终验收继续pending。
