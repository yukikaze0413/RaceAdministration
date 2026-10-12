# 规则研究与证据门槛
2026-10-08读取；本文件区分已核实参考事实与尚未获取完整证据。未执行新增业务测试。

| 来源 | 已确认可用信息 | 缺口/使用边界 |
|---|---|---|
| [Valve Major补充规则](https://github.com/ValveSoftware/counter-strike_rules_and_regs/blob/main/major-supplemental-rulebook.md) | 32单位、三个16人Swiss；S1直邀16、S2/S3各直邀8；3胜3负、DS定义和种子继承 | 在线main非科隆当时冻结版本；需获取当时commit、完整配对表、赛事补充规则 |
| [ESL科隆更新2026-02-23](https://pro.eslgaming.com/tour/2026/02/iem-cologne-2026-stage-3-update/) | Stage3全BO3；S1六月2–5、S2六月6–9、S3六月11–15、Playoffs六月18–21 | 完整32单位种子、各场结果及Playoffs最终BO待数据核验 |
| [Toornament GSL](https://help.toornament.com/structures/introducing-the-bracket-group) | 4人每组、2人出线，多组重复模型 | 是产品规则参考，平台classic图自行显式定义 |
| [Toornament决赛](https://help.toornament.com/structures/double-finals) | 双败GF配置存在变体 | 不是所有赛事统一规则，平台reset明确冻结 |
| [Toornament Skip1stRound](https://help.toornament.com/structures/introducing-the-skip-1st-round) | 直接LB输入可用于上阶段成绩分流 | 不等于用户额外L=N/N÷2；不能直接套同一feeder |
| [Dota官方TI2026赛事介绍](https://www.youtube.com/watch?v=hC1V-oCh1r0) | 官方说明modified Swiss接双败，BO3/总决赛BO5 | 介绍不是完整规则，不能据此冻结具体Swiss退出与附加淘汰 |
| [TI2026 Liquipedia](https://liquipedia.net/dota2/The_International/2026) | 搜索可定位2026/TI15，完整open失败 | 完整数据尚未取得；当前搜索摘要存在组数/晋级解释不一致，仅作查找线索 |

排除colognemajor2026.com冒充官方来源：其部分摘要将Stage3描述成Playoffs，与ESL官方不一致。不使用2025的TI14来填TI15。
现有docs/FORMAT-RESEARCH.md的历史FIDE/卡牌来源不冒称2026现行规则；本变更通用BH明示platform版本，精确项目模板单独核验。

## 实施前证据交付
0.2：科隆32个参赛单位、初始seed及入口阶段、所有Swiss/淘汰比分、场次与实际时间、赛事当时规则版本/BO/配对表、来源hash，独立手算动态种子。先冻结JSON fixture与expected，后测试生成器。
0.3：TI15=TI2026完整modified Swiss、轮数、出轮条件、同分、附加淘汰（如果存在）、UB/LB种子、无reset或reset与GF BO；数据与规则交叉核实。缺口公开记录，受影响切片禁止冒称通过。
0.4：平台double-lower-entry的N4/8 L0/half/same独立feeder表和手算；Q1/2/3、reset两路径。不是让用户自行查规则，代理负责取得和核对。
这是明确的证据获取门槛，不是用“调研全部代码”代替规划；其他默认值/提醒/通用生成器不依赖TI证据。

## 2026-10-09原始数据补充（仍pending）

原始字节与读取日期/URL/SHA256已保存至`evidence/reference-sources/manifest.json`。抓取脚本对已有ID跳过，防止重新抓取静默覆盖冻结内容。

科隆：GitHub历史API查询`major-supplemental-rulebook.md`在2026-06-02前最后文件提交为`a22f91da503d3afc00045fdad339bc6a3cd19c98`（2025-08-05）；已冻结该commit原文。内容有Major32队/三次16Swiss、动态DS、首轮和后续配对优先表、继承种子，但邀请表仍标Winter2025，不能直接充当科隆完整赛事补充规则。2026-04-13的[PR41](https://github.com/ValveSoftware/counter-strike_rules_and_regs/pull/41)仍open，不能将其head视作已合并适用版。April6 VRS邀请排名原表已冻结，不直接把榜首32当完整科隆入口名单。0.2/7.1/10.1保持未完成。

TI：主代理实际读取[Steam官方2026公告](https://store.steampowered.com/oldnews/?appgroupname=Dota..&appids=570&feed=steam_community_announcements)，确认16队同战绩BO3、四胜直通/四负淘汰、三队直通+十队五场附加淘汰、8人双败及BO5总决赛。官方[TI15赛程](https://www.dota2.com/esports/ti15/schedule/19719/41)脚本使用[Valve联赛19719数据](https://www.dota2.com/webapi/IDOTA2League/GetLeagueData/v001?league_id=19719&delay_seconds=0)；完美世界2026专题脚本使用[官方分组赛程接口](https://www.dota2.com.cn/international2026/getMatchScheduleGrouped?schedule_key=ti2026&swiss_format=ti_road)。两站原始JSON已冻结。

整理结果`backend/test/fixtures/ti2026-official-observations-v1.json`：16个Valve参赛单位；Swiss实际39系列、附加淘汰5系列、双败14系列，共58。Valve有8个team_id=0的Swiss空占位，即使is_completed为true也必须排除。两站人工ID映射后58比分一对一一致，无复用/缺项。Valve字段scheduled_time与actual_time明确分开；中国matchTime语义不明，只保留原值，禁止写actualStartedAt。组metadata给max_rounds=5、win_loss_limit=4、直通3与附加10；这些观察不等同完整精确规则。

当时完整规则正文仍缺；2026-10-10取得正文后的更新见下节。公告BoomBoys、数据BETBOOM TEAM/BB等名字有差异，保留双方原名，不偷偷改写历史名称。0.3/7.2/10.2保持pending，模板不标运行支持。模拟87/34/35工程通过见acceptance-reference-simulations.md，与真实复现分开。

## 2026-10-10 官方规则正文与独立算术核验

主代理亲自完整读取 [TI2026 官方规则页](https://www.dota2.com/esports/ti15/tirules?l=english)，渲染标题为 The International 2026。保存原始 HTML 和另行人工转录的 `evidence/reference-sources/ti2026-rules-rendered.txt`；两者明确区分，页面没有版本发布日期。排序顺序为场胜、场负、对手场胜总数、自身局胜率、对手局胜率、平均局时长、抛硬币。第一轮组织者在两个组内安排；第二、三轮限原组，第四轮限另一组；第五轮败者淘汰比赛最大化排名距离。附加轮由最佳 3-2 队依次选择剩余 2-3 队；八个晋级队按最终 Swiss 排名选种。这些不再列为缺失正文。

`scripts/check-ti2026-observations.js` 独立于生产运行器重算 39 系列、97 个唯一局、16 队，场胜/负、对手场胜、自身局胜率和平均时长均与官方整数一致。对手胜局之和除以对手全部局数之和并向下取整，16 队也全部一致；直接算术平均则不能吻合。报告 `evidence/ti2026-arithmetic-check.json` 保留分子、分母、输入 nodeId。加权和取整仍是冻结数据推断，不称官方公布公式，不证明其他输入的规则。

剩余门槛收窄为官方初始分组/种子与首轮组织者记录、确定性配对优化及人工调整、同分公式精度的官方定义、主赛种子槽位和抛硬币裁定。继续收集并实现专用运行器前，不开放精确复现。

继续核验：官方前八比赛标签 `Match 1.A` 至 `Match 4.B` 可解释两组各八队，39场逐轮同战绩、R2/R3原组、R4跨组、无重复对手及4胜/4负停止全部成立。A/B是比赛标签解释，不冒称独立公布初始数值seed。三个直通和五个附加胜者完整确定；附加赛显示顺序不等于选择顺序，只能验证选择兼容，不能证明选择动作的先后。

八个晋级队按公布排序字段为 VISION、Liquid、Nigma、Spirit、IW、Falcons、BB、Yandex（此八队均在对手场胜字段之前或该字段分出先后，无需猜coin toss）。实际主赛node14–17种子对为 `[5,4]`、`[1,7]`、`[2,8]`、`[3,6]`。一项探子报告将BB/Yandex顺序颠倒并误称标准1-vs-8，主代理按原指标复核后纠正，独立脚本保留字面实际映射。规则正文只说按Swiss排名选种，没有明确要求1-vs-8；因此记录实际槽位，不将其直接判为违规，也不修改数据迎合通用签表。完整14节点feeder已保存，待专用运行器使用明确版本的实际首轮槽位表。

科隆只读定位发现 [Stage1](https://www.hltv.org/events/9028/iem-cologne-major-2026-stage-1)、[Stage2](https://www.hltv.org/events/9029/iem-cologne-major-2026-stage-2)、[Stage3/淘汰赛](https://www.hltv.org/events/8301/iem-cologne-major-2026) 和 [首轮公告](https://www.hltv.org/news/44679/iem-cologne-major-stage-1-opening-matchups-announced) 可提供队伍、赛果与日期。此处只是定位线索，主代理尚未冻结并逐项核验；事件页当前排名不当初始 seed，日期不当实际开赛时刻。Stage2 直接邀请集合由晋级名单集合差推得时必须标为推断。WP REST 401 不作绕过访问。

主代理随后点验三阶段Swiss表与首轮公告，确认表内BO1的13/16等是地图回合分，不是系列胜局数；需要独立保存地图分与1-0系列分。首轮公告原文明确起始时间/顺序为provisional，不得写入actualStartedAt。普通原始抓取Stage1返回403后停止；其余该域名自动抓取跳过，manifest的unavailableSources与已冻结sources分列，网页可读定位不冒称原始字节已冻结。

公开表事实已人工转录为 `backend/test/fixtures/cologne2026-historical-observations-v1.json`，三阶段Swiss各33、PO7共106系列；这是事实表的转录摘要，不是原始HTML快照。`scripts/check-cologne2026-observations.js` 独立验证16队各阶段记录、33唯一对手/系列、8晋级与下阶段集合、32唯一队、BO1地图分→系列1-0、七场单败及Falcons冠军/FURIA亚军，报告 `evidence/cologne2026-observations-check.json`。从集合差推得后阶段各8直邀仍标推断。

点验发现日期来源差异：[Spirit–9z详情](https://www.hltv.org/matches/2394986/spirit-vs-9z-iem-cologne-major-2026)和overview显示6月13，Results列表显示6月14；[Falcons–Vitality详情](https://www.hltv.org/matches/2394999/falcons-vs-vitality-iem-cologne-major-2026)显示6月19，Results列表显示6月20。转录用详情显示日期，另保存冲突，不把不明时区的20:55/21:25转成UTC或actual。已冻结ESL官方32名次表与各阶段淘汰分段及PO结果逐项吻合；完整官方种子/赛事补充规则/调整和逐场实际即时值门槛仍未满足，0.2/7.1/10.1不勾。

## 科隆配对候选的逐轮证明

主代理从 Valve 公开 `contents/live/2026` 实际文件清单定位并冻结 [May4全球排名](https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/live/2026/standings_global_2026_05_04.md)，git blob `32a9a4a31b2119916881cbfb5ebbb17fa50a6570`；不是将blob冒称commit。完整32参赛阵容按该表定位，重名9z用dgt/meyern、NRG用nitr0/oSee明确区分，原名/阵容/排名/点数全部保存于算术报告。June1表晚于5月21首轮公告，且不匹配；April6邀请排名也不匹配。

May4候选Stage1 seed为GL、B8、HEROIC、BB、BIG、M80、MIBR、SINNERS、NRG、TYLOO、Sharks、GG、Liquid、LV、Thunder、FlyQuest。按Valve首轮1v9至8v16全对应；上阶段最终record/DS/initialSeed排序后进入后段9–16，直邀按May4排名进入1–8，三阶段24首轮全部对应。用各轮确认后的当前对手胜负计算DS、R2/R3最高对最低合法、R4/R5选15行优先表首个无重赛行，三阶段全部15轮99场也对应。报告每轮保存before standings、期望与观察对阵，没有从生产生成器导出预期。

这证明该候选解释全部公开配对；ESL明确采用May4的日期公告、实际即时值及官方调整日志仍未取得，不将数据吻合替代这些缺口。独立静态 `cologne2026-pairing-expectations-v1.json` 来自历史观察与独立输入计算。Major版本随后完成目录、参数、专用策略和三宽度运行；同一赛事真实HTTP106场验证直邀/继承种子/Stage3 BO3/季后赛BO5及结果，详见`acceptance-major-runtime.md`。真实历史证据与完整案例演示终验尚待完成，7.1保持未勾选。

## TI候选计算与流水线（2026-10-11）

原始Valve首轮node.name实际含Match 1.A/B，归一化label直接保存原文；新增observedInitialPairing记录8首轮table和JSON路径。与独立初始seed表或组织者选择动作日志分开。原始Valve/CN载荷仍无逐轮排名快照、选择/coin动作或seed-to-slot明文映射。

私有统计profile `ti2026-weighted-observed-v1`重算全部16官方小分；加权floor是与数据吻合的推断，未决coin同分保留blocked。将最终统计方式应用于各轮之前的确认结果，并将“排名距离”量化为总abs rank差，R2–R5在同record、初组约束、先禁repeat条件下的最优距离12/14/8/13均唯一且对应实际对阵。R1明确使用organizer table，不能用未知coin排位推断首轮优化。R5只有当前1–3 band败者四负真淘汰才max；二二/三一败者仍能参加附加赛，保持min。

私有流水线实际覆盖39Swiss+5按排名顺序的兼容选择+14双败=58系列；显式观察槽位输入接入现有slot双败，14节点incoming及胜败feeder、决赛BO5无reset、8最终名次与源事实一致。多解/不可避repeat不自动裁定，输入version/hash/审计边界与统计不变性已测。选择的工程回放不冒充官方选择日志；加权公式、总距离定义、槽位输入仍按推断/观察分级，TI未注册完整runtime。详见`acceptance-ti-candidate.md`，0.3/7.2/10.2继续pending。

## TI编译计划与私有整合（2026-10-12）

目录新增不可运行的`ti2026-observed-candidate-v1`，明确候选统计公式与组织者slot表；五轮瑞士和附加淘汰赛分别编译为五个swiss窗口及一个elimination窗口，资格出口使用selectedStanding，禁止假定Swiss前八。参数、画布与预约三宽度实际保存/刷新/冻结通过；真实HTTP启动仍501。私有unit以该实际编译计划重放44场，最终资格保留Swiss ranks1/2/3/4/5/6/9/11；结果和选择输入的完整性、version/hash、不可变性、JSON序列化及未决coin阻塞已核验。该序列化不是数据库/HTTP重启证明，actor/reason也不是角色授权。

继续对官方域名进行窄范围证据查询。[ESL科隆公告](https://pro.eslgaming.com/tour/2025/08/iem-cologne-major-announcement/)说明邀请依据VRS，仍没有补齐May4实际采用日期及调整动作；赛后激励积分页不当作赛事种子或配对记录。TI搜索返回的2015规则页全部排除，不将TI15编号误配2015年。[当前TI规则入口](https://www.dota2.com/esports/ti15/tirules?l=english)仍是客户端渲染页，普通网页读取为0行，不替代此前主代理冻结的2026完整DOM正文；本次没有新增公式精度、确定性优化、选择或coin动作证据，0.2/0.3及精确复现门槛保持pending。

同日继续完成候选HTTP/UI：实际逐场写入39Swiss/97局和5附加赛，8资格经真实compiled connections进入观察槽位双败14场，合计58系列，Spirit冠军。选择按规则排名顺序记录为工程兼容动作，不冒充历史动作日志；逐场PATCH/POST、当前权限、prepared确认/choice、SQLite回滚和重启、公开脱敏均通过。三宽度真实UI完成44场及手机版本冲突元数据恢复，通用瑞士/Major回归通过。此处测试在已冻结/锁名单且正常start501后由测试代码注入候选，没有开放正常启动或reference-unit导入；正文没有新增官方公式证据，7.2/10.2不能仅因工程58场而勾选。详见ti-candidate-api.md与acceptance-ti-candidate.md。
