# TI2026 候选计划与私有运行工程验证（2026-10-12）

0.3、7.2、10.2仍待完成。目录新增仅用于规划的`ti2026-observed-candidate-v1`，runtimeReady=false；已连接参数、编译计划、赛制图和赛程窗口，HTTP启动仍返回501。候选比赛写入、确认、对手选择HTTP/UI已接入，并通过隔离注入候选运行进行工程验证；这不证明正常启动、完整报名/导入或官方精确复现已交付，不宣称官方确定性算法、选择动作或抛硬币审计已取得。

## 编译计划和应用边界

固定16队、8晋级、BO3、4胜/4负阈值及5轮Swiss；6个稳定window key依次为5个swiss phase和1个elimination phase，后者使用pendingEliminationRound来源。组织者指定slot1–8为A组、9–16为B组，各组相邻slot构成明确首轮表；此候选席位协议不是取得了初始官方数值seed。参数schema禁止任意阈值、排序、BO和轮次覆写。

qualification出口引用selectedStanding/channel/index，表示附加赛完成后的有序资格，而不是Swiss前八rank；rank和qualification端口仍分别消费。图和赛程明确显示“附加淘汰赛”及其预约，避免伪造第6轮Swiss。前端只提供5轮选项、固定排名字段及候选公式说明，允许保存和冻结。目录与启动闸门均不声明可运行，通用Swiss工厂也直接拒绝该候选版本。

`ti-unit-candidate.js`将实际编译计划、组织者slot表、39场确认系列和5次对手选择绑定在同一可序列化状态中；每次操作复验当前version/hash、完整状态与actor/reason并clone返回。每轮所有比分、逐局胜者和时长齐全才确认，确认后自动生成唯一候选或保留未决同分/配对阻塞。5次选择齐全才产生第6个窗口的5场BO3，最终资格包括Swiss第9、11名，顺序为原Swiss排名1/2/3/4/5/6/9/11；附加赛不重算Swiss小分。通过runtimeSources输出的资格index为1–8，Swiss rank保留。

私有操作的audit不是权限授权，JSON序列化测试不是SQLite/HTTP重启验收。同分仅在完整排名确定后允许选择和输出资格；包括直通队伍的同分也保持保守阻塞，避免凭UUID编造最终种子顺序。当前没有coin裁定或人工多解配对应用操作。

## 候选HTTP/UI接入

逐局写入、确认、选择和actual-start使用现有真实会话与赛事能力。每次结果或开始时间变化重封候选hash/version，confirm和ti-opponent通过writePrepared复验整个操作聚合并原子提交。原生通用Swiss配对/排名/advance拒绝TI，公众runtime/schedule额外删除选择、确认、完赛审计actorId。具体请求及边界见ti-candidate-api.md。

测试在16名真实测试账号报名审批、冻结并锁定名单后确认正常start501，再由测试代码注入候选初始单元；后续39Swiss/5附加赛/14主赛全部通过真实HTTP操作。8资格实际经编译路由进入观察槽位的双败，冠军Spirit，合计58系列。注入仅位于测试，未增加公开启动绕过或环境开关。

页面接入逐局胜者/时长、提交记录采用、系列比分一致性、Swiss候选小分与资格独立展示、顺序选对手、专用确认原因和锁定状态。正常开赛面板对已知不可运行的冻结v2配置禁用启动。409保留完整本地草稿及原元数据，重读后明确采用服务器完整记录；避免旧局数据与新seriesId混合。

发现共享POST报分缓存可在撤销代报分权限后返回旧成功响应，已将当前参赛资格/报分能力复验放到write事务内、缓存读取之前。PATCH/confirm/choice沿用当前能力复验。新增失败后通过的专属用例，不将修复范围限于TI。

## 排名和首轮证据

`ti-standings.js`读取完整16队与确认的BO3系列/逐局胜者/时长，复验胜者、系列局数、比分、唯一series/game ID和时长；BigInt求和及floor比率避免总时长超过Number安全范围导致误差。按系列胜负、对手系列胜数、局胜率、对手局胜率、平均所有局时长排序。未决同分返回TI_COIN_TOSS_REQUIRED，保持同名次，不按初始seed、UUID或未说明语义的coinflip整数猜名次。

加权对手局胜率和整数floor吻合全部16行官方数据，但其精确公式未在已取得的官方正文中定义。模块version为`ti2026-weighted-observed-v1`、formulaStatus为observed-inference，不能据此替代证据门槛。

主代理点验原始Valve载荷的`nodes[0].name`为“Match 1.A”；归一化label一直直接来自node.name。fixture新增observedInitialPairing，保存8条原始官方标签/队伍对及JSON路径。A/B按这些标签解释，并由R2/R3同组、R4跨组实际配对互证；不是另获了独立初始数值seed表。两份原始载荷未提供逐轮排名快照、附加赛选择动作、coin语义/动作审计或Swiss种子到主赛槽位的显式映射。

## 配对候选

`ti-pairing-candidate.js`采用完整16队已确认系列重算排名。R1使用明确的组织者首轮表，不将所有零统计队伍随机排种。后续同战绩，R2/R3同初组、R4跨初组；先最少重赛，再按工程假设优化总绝对rank距离。R5仅当前1–3组的败者达到四负而真正淘汰，使用最大化；3–1及2–2组败者还可进入附加赛，使用最小化。

观察的R2–R5在该候选下都是唯一最优，距离分别12、14、8、13，每轮完整配对与实际数据吻合。R1属于组织者设表例外，不用未取得的coin顺序计算“初始最优距离”。独立只读探子给过R1任意coin排名的距离差及不一致总和，主代理未将其作为历史或算法证据。

多份等价最优方案返回pairing-choice-required，不通过UUID选一份；必须重赛返回rematch-approval-required；搜索预算耗尽返回solver-limit，不声称最优或无解。最多保存每组256份候选，仍保留准确最优份数及truncated标识。两项边界测试的人工分组只测当前约束的多解/重赛阻塞，不冒充这些历史比赛的真实分组或完整运行历史合法性。

## 附加淘汰赛和主赛衔接

`ti-elimination-candidate.js`仅接受完成五轮后的3个四胜直通、5个3–2和5个2–3队伍。按最终Swiss排名的下一名3–2队伍依次选择剩余2–3对手；“任一剩余对手”允许此前已交手，不套用瑞士硬禁。保存重复对手标识、裁定人和原因，复验version/hash及完整状态。纯函数采用clone生成新状态；audit字符串不授予权限，未来HTTP仍须在事务内检查当前角色。

五场选择齐全且五个BO3决胜结果齐全才确认。三直通加五胜者产生8唯一资格，按原最终Swiss排名排列；附加赛比分不会改变Swiss小分或排名。重放选择的顺序遵循规则并与比赛配对兼容，但不是从源节点编号或开赛时间推断出的官方选择动作记录。

`ti-candidate-pipeline.test.js`实际逐轮读取候选并消费39场观察比分，随后完成5项排名顺序选择及附加赛结果，最后以明确的观察槽位映射`[3,5,7,2,1,8,4,6]`接入已有slot模式双败。该输入映射是本例显式观察，不宣称通用TI种子表。14个主赛节点的对阵、BO、incoming feeder及winner/loser方向全部吻合，决赛BO5且不重置；八队最终名次与官方表一致，冠军Team Spirit、亚军TEAM VISION。总计39+5+14=58系列，不是完整应用HTTP/浏览器回放。

## 验证

- `ti-standings-red.log`、`ti-pairing-candidate-red.log`、`ti-elimination-candidate-red.log`：实现前红灯。
- `ti-standings-green.log`：4项排名/输入/数值测试。
- `ti-elimination-candidate-green.log`：16项排名、配对和选择状态测试通过。
- `ti-candidate-pipeline.log`：58系列私有流水线回放通过。
- `ti-candidate-backend-full.log`：302项后端全量回归通过，0失败。
- 独立只读核验指定四测试文件17/17，未发现实际缺陷；主代理执行全量验证。科隆此前当前构建10项Edge、85前端及build证据仍有效，此次没有改动其运行代码。
- `ti-plan-frontend-red.log`、`ti-unit-candidate-red.log`：计划显示和私有整合实现前失败记录。
- `ti-unit-candidate-green.log`：5项真实44场回放、当前hash/完整结果/输入别名/冻结协议、序列化及资格来源、未决同分阻塞测试通过。
- `ti-plan-backend-full.log`：309项后端通过，包括3项Major生命周期与4项TI计划/真实HTTP启动闸门；`ti-unit-backend-final.log`：新增私有整合后314项后端全部通过。
- `ti-plan-frontend-full.log`：87项前端通过；`ti-plan-build.log`：类型检查与正式构建通过。
- `ti-plan-browser-final.log`：Edge三宽度保存/刷新/冻结、6窗口完整图和资格标签、附加淘汰赛预约保存/刷新全部通过，截图ti-plan-360/768/1440.png，主代理已检查360图。
- 独立只读ti_compiled_candidate_review未发现实际回归；前两批浏览器定位失败日志保留，原生下拉框改用可访问名称role定位后最终3/3通过。
- `ti-runtime-http-red.log`、`ti-cached-auth-red.log`、`ti-runtime-frontend-red.log`、`ti-runtime-ui-review-red.log`：接口未接入、缓存权限与界面边界红灯证据。
- `ti-runtime-http-lifecycle.log`：58系列、撤权缓存、真实临时SQLite重启、故障回滚4项通过；后续全量包含新增actual-start/通用协议禁止用例。
- `ti-runtime-backend-verified.log`：322项后端全部通过；`ti-runtime-frontend-final.log`：93项前端通过；`ti-runtime-build-final.log`：类型检查/构建通过。
- `ti-runtime-browser-final.log`：TI三宽度44场/97局、5次选择、确认/刷新/手机真实版本冲突恢复，以及9规则参数保存，共4项通过。`ti-runtime-swiss-browser-regression.log`：通用fixed/threshold/Major三宽度9项完整运行回归通过。主代理查看ti-runtime-360.png，页面无全页横向溢出断言通过。
- 初批TI浏览器已成功推进下一轮，但测试动态last选择器随后读到新轮而误判旧轮未锁；改为固定轮索引后全通过。失败日志保留。
- 后端前两批全回归分别遇到password及stage-groups夹具port0取得Fetch禁端口，均为bad port；统一低端口HTTP夹具到可重试高端口helper后322/322，helper新增忙端口/禁端口预算/其他错误传播3项验证。server启动测试也只用port0选择空闲端口，主代理读取其实际Fetch用途后改为高端口，不修改生产server语义。
- 两项独立只读核验：后端无实际缺陷；界面提出启动门槛、字段一致性及冲突问题。主代理核对后以红绿组件测试和真实Edge冲突流程修复；补actual-start和禁止通用裁定的真实HTTP覆盖。

后续仍需：TI人工coin和多解/重赛配对操作、官方历史时间与公众完整真实案例图、完整reference-unit演示导入和四案例终验；官方公式/算法/种子映射及选择和coin审计证据。正常启动继续关闭。未提交、部署、归档或访问真实数据库。
