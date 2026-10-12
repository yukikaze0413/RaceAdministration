# 当前续接（2026-10-12，28/36，继续直至全部完成）

用户优先反馈创建后打不开演示，已复现并修复 Vite5173 开发入口遗漏子空间 API 代理：原仅 `/api`，`/demos/<64hex>/api/v1/health` 返回200 text/html，前端 BAD_RESPONSE；增加仅子空间 API 的正则代理，页面仍由 Vite 提供。之前 reference-cases.spec.ts 用 dist 同源后端验收，未覆盖开发入口，不代表用户实例可打开。新 reference-demo-dev.spec.ts 加载实际 vite.config，只替换临时后端目标，三个可用示例真实 Edge 创建→进入→保存→刷新→重入→cookie路径均通过；全程临时 SQLite，不碰业务库。当前5173只读不存在实例探针已返回后端404“未找到此演示空间”，证明运行中的代理规则已加载。无须重新创建旧演示。3/3 Edge最终日志 reference-demo-dev-browser-final.log，前端93/93、类型/构建通过，验收记录 reference-demo-dev-acceptance.md；全部测试命令已结束。任务仍28/36，不把本次修复当历史证据闭环。

本次最新优先于下方：TI候选真实HTTP/UI协议已接入，正常start仍501/runtimeReady=false，未添加公开绕过或环境开关。`runtime-http.js`识别TI结果/确认/actual-start和新`POST /units/:uid/ti-opponent`；候选单元每次逐场写入/实际开始递增version+全statehash，confirm/choice走writePrepared并复验聚合/权限/时间。泛用pairing/ranking/advance禁止接管TI。新增unit.rule/entrants及最终rows draws0/pointswins供既有投影/路由，不改变统计候选；保留m.decision逐局字段/actor/reason及winner/loser outcome。公众移除elimination selection/completion、round confirmation actorId。

`ti-runtime-http.test.js`5项：测试真实16账号报名/审批/锁定，核验start501再仅测试注入候选runtime；39Swiss/5附加/观察slot映射路由14DE共58全部真实HTTP，Spirit冠军，8qual包含rank9/11；旧hash/不齐/SQLtrigger故障回滚/原键恢复，delegated POST和confirm撤权缓存403，tempSQLite真实close/reopen恢复metadata/hash/idempotency，actual-start不可未来/覆盖、generic pairing/ranking501。私有unit JSON测试仍5项。正常reference-unit导入/启动与官方动作记录未完成。

共享POST缓存当前角色缺口已用失败测试复现：write新增authorize回调在事务内缓存之前，runtime结果POST当前参赛或results.edit复验（含double-loss权限）；PATCH及prepared操作原有当前授权保持。role revocation不再绕过缓存。仅测试夹具高端口改动修复Windows port0随机落Fetch禁端口：新backend/test/helpers/http-listener.js，账号/时间/组/赛事/重启/server取端口用helper；3helper测试验证bounded busy/EACCES/error传播。密码夹具也改高范围，game-presets/formats等此前高范围保持。net port0只选child PORT并fetch，无必须port0语义，主代理亲读后改安全取端口。前两批backend失败仅bad port日志保留。

前端新增ti-runtime.tsx：逐局winner/duration，隐式稳定series/game IDs且采用既有记录保留ID；TI小分/Swissrank/qualification独立表；依次选对手/原因，专用确认当前unit.version/hash/reason。candidate不能double-loss，不能generic ranking/pairing。StartPanel已知v2 snapshot.runtimeReady=false禁启动（v1兼容不据旧false误禁）；逐局胜数一致性禁submit；409保留本地完整metadata，不以新server.seriesId拼接旧局，明确采用server或提交记录。MatchCard已导出供测试。6TI组件红绿通过。

当前最终后端322/322 `ti-runtime-backend-verified.log`，前端93/93 `ti-runtime-frontend-final.log`，typecheck/build `ti-runtime-build-final.log`通过。Edge `ti-runtime-browser-final.log`4/4：TI360/768/1440完整44场97局/5choices/确认刷新，360真实并发PATCH→UI409→重读保留→明确采用metadata→恢复观察时长后继续；三宽度无全页horizontal溢出，另九规则默认保存。`ti-runtime-swiss-browser-regression.log`9/9现有fixed/threshold/Major各三宽度完整运行。主代理查看ti-runtime-360.png。初批测试last轮选择器动态指向新轮误判锁定，nth固定历史轮修复，日志保留。独立ti_http_auth_review complete无实际缺陷，ti_ui_flow_review的启动/字段/冲突问题经主代理核对红绿及Edge修复，补实际开始/泛用协议测试。所有探子终态；所有此前shell session已消费，若下方新补最终target命令运行须消费。

新协议说明ti-candidate-api.md、acceptance-ti-candidate.md已更新；仍28/36，未提升TI支持或勾任务。下一步TI coin/多解与不可避repeat人工协议、真实时间及官方公式/优化/seed/动作来源、完整reference-unit四例与最终验收。Major仍缺真实时间/采用与调整日志及完整106演示浏览器。Notion依然prepared-only无远端写；不提交/部署/归档、不打开真实.data/platform.sqlite。

最终每个TI生命周期fixture注入前都先核验start501，`ti-runtime-http-lifecycle-final.log`5/5通过且session已消费；当前无运行shell session或探子。严格OpenSpec校验与diff检查通过。

最新优先于下方旧记录：TI目录新增planning-only `ti2026-observed-candidate-v1`，format threshold-swiss/runtimeReady=false，不加入support集合；BO3/16/8/4–4/5轮、6项候选排序fixed、seeding.slot/ti-organizer-slot-v1，firstPairing organizer-slot-pairs-v1。slot1–8 A/9–16 B，相邻成对是候选组织者显式表协议，不是官方初始数值seed证据。compiler五swiss windows+第六elimination/pendingEliminationRound、selectedStanding qualification.channel/index代替Swiss top8。前端参数5轮固定、固定排序/候选公式，图附加淘汰赛，schedule phase标签/预约已贯通。目录10项=原9可运行+TI候选不可运行；真实HTTP保存冻结/名单锁定/start501，generic createSwissUnit额外拒绝TI，不能误复用第6Swiss。

`ti-unit-candidate.js`新增私有可序列化unit：plan/entries strict、frozen slots/group/firstPairing、每次version/hash/全statehash+actor/reason、clone无results aliases；五确认轮消费39series/逐局winner/duration，再按rank选择五对手生成第6window5BO3，最终44比赛。资格按Swiss ranks1/2/3/4/5/6/9/11（不是之前误猜1/2/3/4/6/8/9/11），附加赛不改Swiss statistics；standings.qualification输出供runtimeSources，top8区分已验证。未决coin返回pairing-blocked，不猜UUID。5tests replay/atomic/incomplete/stale/tamper/serialize/locked/exactplan/generic拒绝/coin通过。JSON roundtrip不称SQL重启；audit不称权限授权；未接TI比赛HTTP/UI/人工coin/配对/选择操作，支持门槛仍关闭。

Major `major-v2-lifecycle.test.js`3项新专属HTTP全部通过，日志cologne-major-lifecycle.log：显式重赛audit/confirmed DS、旧hash/solverlimit非法例外/SQLtrigger回滚/原键恢复/current revocation/public脱敏、tempSQLite真实close/reopen主办重新登录持久化和幂等。人工aggregate/budget夹具明确非历史自然输入。acceptance-major-runtime已去除这项待办，源证据/106演示浏览器仍pending。

当前最终backend314/314（ti-unit-backend-final.log），frontend87/87（ti-plan-frontend-full.log），typecheck/build通过（ti-plan-build.log），EdgeTI三宽度3/3（ti-plan-browser-final.log），主代理看360截图；前两批selector失败日志保留，原生select改用getByRole combobox而不是exact getByLabel。独立只读ti_compiled_candidate_review complete无实际缺陷，完整rank未定则连直通同分也保守阻塞合理。reference cases pending文案已改为准确的已验证/缺口，不再声称比分尚未取得；此仅文案变更后仍需相关测试。acceptance-ti-candidate已更新。所有探子及shell session目前终态，用户要求继续全程，不能把本切片视为任务全完成。

仍28/36：0.2/0.3真实证据、7.1/7.2 exact adapter、10.1/10.2真实全流程、10.4四例、10.5终验。不提交/部署/归档，不打开.data/platform.sqlite。Notion仍T0+candidate prepared-only，无T2或外部写。下一步继续补官方规则/时间/seed与动作来源；TI真实写入/当前权限/事务幂等重启和页面接入，source未齐不得提升ready或勾选7.2。下方旧“TI不注册catalog”“Major生命周期尚未补”等由本段覆盖。

最新（优先于下方）：TI私有候选三个模块现在贯通58纯运行：`ti-pairing-candidate.js`每轮从confirmedSeries重算完整16，R1显式官方table，R2/3同组/R4跨组+同record，先少repeat再总abs rank距离；R5仅当前1–3淘汰band最大，别把2–2/3–1也max。真实R2/3/4/5距离12/14/8/13全部唯一最优，实际39配对全吻合；cooptimal状态pairing-choice-required（人工约束test2解）、unavoidable repeat状态rematch-approval-required，均不返回自动pairs；nodeBudget1测试solver-limit，不冒称unsat/optimal。每band最多保存256候选但准确计数/标truncated。私有candidate只检验当前aggregate/group约束，人工group边界测试明确不声称这是真实过去的分组/全部历史政策合法性；未来adapter需要冻结group/table、当前hash与保存历史复验。

`ti-elimination-candidate.js`create计算最终39Swiss stats，3四胜直通（1个4–0+2个4–1，不是3个4–0）/5三二/5二三；按Swissrank Spirit→IW→Falcons→Aurora→LGD依次任择剩余2–3，重赛选择可允许（“choose any”），记录repeat标识/actor/reason。version/hash+完整statehash复验，clone不可变；纯函数audit不会授角色，当前transaction权限尚无TI HTTP适配。收齐5choices+5BO3结果后8qual按原Swissrank VISION,Liquid,Nigma,Spirit,IW,Falcons,BB,Yandex，不改变Swiss stats/ranks。3tests旧hash/版本/chooser/reusedopp/tamper/audit/result不齐/draw/不可变/资格顺序全通过。

`ti-candidate-pipeline.test.js`逐轮候选消费39比分，再5选择/结果，qual用显式观察slotMapping [3,5,7,2,1,8,4,6]接已支持de-standard-v1 seeding.slot、GF5/noreset；14PO pairs/BO/incomingnode/winnerloserfeeder方向/8队official.standing全部一致，冠军Spirit7119388、亚军VISION9572001，39+5+14=58。此为private pipeline，不是TI完整HTTP/UI，映射是本例输入观察不是官方通用seedtable。sourcePlayoff standings的wins/losses全0不可用，测试只对standing名次及已冻结逐场事实。

17项TI专项通过，独立ti_candidate_state_review complete无实际缺陷（其“3个4–0”表述主代理已按code wins===4/源事实纠正），主代理最终`ti-candidate-backend-full.log`302/302。全部shell session已结束。`acceptance-ti-candidate.md`保存事实/假设/未接入边界。TI仍不注册catalog/HTTP/UI，tasks/module-plan 28/36。下一步完整TI计划和写入协议（逐局winner+duration）、Swiss5+附加赛特殊流程/人工ranking & choices、当前权限/幂等/rollback/restart/前端、明确slot衔接和reference-unit演示；缺公式/算法/官方动作记录保持pending。同时Major工程异常HTTP/重启覆盖也尚需补；Notion仍prepared-only无T2/remote写。

2026-10-11续接：TI新增私有 `format-runners/ti-standings.js` observedTiStandings，profile=ti2026-weighted-observed-v1/formulaStatus=observed-inference，未注册TI runtime。输入完整16字符串entrant IDs/确认Swiss BO3 series和逐局winner/duration，逐局胜数与系列比分复验、unique game/series、duration safeinteger，BigInt累加时长/比率floor防超安全范围。wins/losses→opponentWins→floorGWP→floor局数加权oppGWP→floor平均所有局时长；全同分status ranking-blocked/TI_COIN_TOSS_REQUIRED，不补初seed/按ID决定名次。`ti-standings.test.js`4/4（全部16官方统计字段/3直通、输入顺序不变异、coin阻塞、错误/重复games/比分和时长/大整数均值）。`ti-standings-backend-full.log`289/289；当前无运行session。

两只读raw TI元数据探子均complete：Valve有root16队standing0、最终standings、58实series/feeder/actual_time/scheduled_time；CN39+5+14及五score_list bands，没有逐轮ranking snapshot/选对手动作/seed-to-slot/coin语义审计。探子称初始A/B只是归一化内部label无raw标签不准确，主代理实际读取raw第1node确认`name: Match 1.A`，normalizer一直`label:n.name`。新增fixture `observedInitialPairing`8原始官方node名/对阵/sourceJSONpath，明确A/B从这些label解释、不是独立seed表；missing改精确“初始分组独立名单及种子/组织者裁定记录（官方节点标签与首轮实际对阵已保存）”。normalizer重跑仍58/58无冲突，独立checker验证8表和39分组/97局/16统计，无production imports。

ti_pair_distance_hypothesis_check探子complete独立每轮此前确认比分/加权floor/平均时长重算，R2无repeat最小总abs rank距离12、R3=14、R4=8、R5=13均与观察吻合，无R2–5同分coin需求。R5仅当前1–3 band loser4负真淘汰才最大化，3–1和2–2 loser仍可进附加赛，所以最小化。R5主代理私有stats点验before排位：Vision4–0 rank1；Spirit/Liquid/Aurora/Nigma3–1 ranks2–5；IW/BB/Falcons/Yandex/LGD/VG2–2 ranks6–11；Resilience/GL/XG/OG1–3 ranks12–15；HUL0–4 rank16，组距对应4+5+4=13。探子R1“coin任意排名距离44 vs最优18”不采用：R1官方明确organizer pairing例外，初始所有stats同分，无已证实coin顺序，R1只能使用已保存官方首轮表，不能用其虚构coin rank或总距离（其总和亦有算术不一致）当证据。

下一步私有TI候选配对：用observedTiStandings按confirmedSeries计算完整16排名；R1提供官方显式firstPairs和A/B标签输入（不自动seed）；R2/3同初组，R4跨组，全部同record；先最少repeat，再工程假设总abs rank差最小，R5仅1–3组最大。所有等价最优方案若>1应pairing-choice-required并留给有权限操作者，不按UUID自动选一份冒充官方算法；若不得不repeat需明确人工例外/审计，solver-limit不当unsat。这个distance定义与floor公式仍为数据吻合候选，TI不注册ready/7.2与0.3/10.2不勾。任务28/36、Notion T0/candidate prepared-only，无外部写。用户新“继续”是原任务续推。

最新追加（本段覆盖下方尚未注册/私有运行的旧状态）：major-cologne-2026-v1已进入registry/support，八通用+Major共9版本。schema限制16默认/8资格（validation/runtime/frontend强约束）、3/3、禁平/双方负、普通BO1/3、adv/elimination固定3、seeding=seed、fixed tiebreakers，rounds.schema={properties:{},additionalProperties:false}不允非空轮次覆写。frontend sizes/qualifiers/parametersValid/固定排序/role标签/例外确认都接入；参数组件12/12，重赛组件2/2，全前85/85，build/typecheck pass。规则目录测试count改9、运行ready白名单加Major；frontend captured DTO新增Major，不改变原8顺序。参数E2E默认保存测试现9规则，真实Swiss loop加入Major3宽度/elim3。首批浏览器新构建前加载旧dist，Major360超时、其余9pass；完成build后`cologne-major-browser-current.log`10/10（九默认+3版本×3width）通过。已看Major360全长图，33场全部纵向呈现/表格横向键盘测试通过。

`backend/test/platform/major-v2-http.test.js`4项实际HTTP：Stage1/2/3各完整33，另同一32唯一赛事106全场。四阶段Major×3+single-cut、final5；直邀entryRef Stage1=16、后段各8。source rank1–8、sort sourceRank asc → targetseed9–16，Stage3→POseed1–8；各stagebindings逐一比独立firstcase初始seed，15轮99canonicalpairs/全部BO，再7PO/Falcons冠军FURIA亚军皆吻合。当前测试临时账号仍individual而非reference-unit演示导入；没写历史actualtime。日志`cologne-major-full-event-http.log`4/4，最后全back`cologne-major-full-event-backend-final.log`285/285；先前catalog全back284。所有command session已消费结束。

独立major_catalog_http_boundary_review complete，认可参数/HTTP106行为，疑称rounds覆写可保存：主代理实际读取schema+node parse非法Major override得INVALID_INPUT路径/stages/0/parameters/overrides/rounds/1，frontend12/12确认没有添加轮次BO控件，该疑点不成立，无为它放宽/重复实现。`acceptance-major-runtime.md`更新真实工程证据及pending边界。下一步7.1还需专属Major rematch HTTP撤权/rollback/restart、完整演示导入/历史UI/总排名+官方源采用/时间/override证据；继续TI精确adapter（已确认规则及58源在下方）。tasks/moduleplan仍28/36，7.1/10.1未勾；不得把当前通用UI左侧全胜33场当106历史UI。Notion当前T0/candidate保持prepared-only无远端写，不宣称两端一致。

最新工作（优先于下方旧运行状态）：Major私有运行接缝已加入swiss.js，完整16队含退场者+授权历史进入配对input/hash；major-cologne-2026-v1尚未注册catalog/runtimeReady。`major-runtime.test.js`三段实际历史比分各33全跑，99配对/BO/最终胜负和8晋级一致；拒绝不兼容冻结参数、人工跨战绩组。`validateMajorDecision`重新完整求解，只有unsat+明确allowRematch+非空reason才允重赛，ready/solver-limit不允；runtime HTTP fields接受allowRematch但generic版本明确拒绝这个字段。applyPairing保存rematch标记，HTTP保存actor/reason；confirmed历史repeat仅在这三项审计存在时导出authorizedRematches，pairMajor双方multiplicity必须=1+授权次数、DS逐次贡献。新独立只读major_manual_policy_audit complete未发现问题；主代理抽查源码并最终全测。21专用policy、5private runtime；34专项（包含generic HTTP权限/rollback/idem）通过。最后全量`cologne-major-manual-backend-full.log`281/281；此前`cologne-major-runtime-backend-full.log`278/278。所有shell session已结束。上一轮274全量failed只有game-presets随机低端口bad port，已将该测试fixture高端口重试，失败日志保留。

新记录`acceptance-major-runtime.md`明确仍缺catalog/专属HTTP/UI、真实跨阶段seed继承和7PO/106全场/真实时间/官方override证据，7.1/10.1不勾选。不要把private three-unit运行称为同一赛事三段HTTP验收。下一步亲读确切配置/集成代码，Major目录默认BO3且advance/elimination=3，可选择early defaultBO1；严格16/3/3/8/5及排序约束。种子路由必须source rank1–8（资格队），sort sourceRank asc，target seed9–16；上轮backend locator误说source9–16→target1–8，不能照抄。当前通用routing已经支持sourceRank排序，不需要先改生产routing；目标createSwissUnit使用position作为当前阶段initialSeed，保留原全赛事种子作provenance即可。将这条链路加入实际全赛事fixture测试后再作支持声明。

更新重点（优先于下方）：已定位/冻结官方May4 live全球榜，sourceID valve-cologne-may4-live，git blob32a9a4a31b2119916881cbfb5ebbb17fa50a6570（不是commit）。GitHub公开contents/live/2026 HTTP200直接文件目录只有月初版，05_18猜测单URL404停止，不日期网格。May4 Stage1排序GL,B8,HEROIC,BB,BIG,M80,MIBR,SINNERS,NRG,TYLOO,Sharks,GG,Liquid,LV,Thunder,FQ全部1v9…8v16吻合；按final record/DS/初seed继承为下段9–16、直邀May4名次1–8，三阶段24首轮及全部15轮99配对逐项吻合。check-cologne脚本/report保存全部before/expected/observed；ESL采用日期明确公告/actualtime/调整记录仍缺，任务不勾。May4全名单有重名9z/NRG，分别用dgt/meyern与nitr0/oSee明确辨认，报告原名/阵容/点数/globalrank保存。Source manifest现10raw +4HLTV unavailable。

新 `backend/src/platform/operations/format-runners/major-pairing.js` 实现Major独立配对策略，未注册registry/runtimeReady。R1固定table、R2/R3 highest-lowest整带可完成性回溯、R4/R5官方15行首无重赛，budget250k/blocked不放松。独立 `backend/test/fixtures/cologne2026-pairing-expectations-v1.json`当前version2：15轮全16完整历史输入+DS/初seed与HLTV观察expected，不导入生产；不是生成器倒推。major-pairing.test.js现在19测试（15历史+priorityexhaust+badinput+wholematching+historyDS），最新 `cologne-major-history-green.log`19/19。初始missingmodule red、nullrow red、fullhistory red保留。

只读独立major_pairing_policy_review complete：15行逐行完全对应、匹配/排序/输入不变正确；指出input只信DS和无效历史（opponents长度/未知/重复/互相一致）漏洞。主代理红→绿改为每轮必须完整16（含退场）名单；active人数16/16/16/12/6，opponents长度=win+loss、unique、全名单ID/互相引用、sumwins=sumlosses，DS从全16当前对手record重算后比较。fixture以历史比分独立重建全16input。18测试旧人工forbidden graph不是合法长度的输入，已替换为对称长度/DS一致的人工aggregate两轮8cycle整带回溯与4轮oddcomponents优先耗尽；注明不是历史/未验证逐轮实际对阵政策。当前历史重复硬拒绝，是未接入Major if-possible人工override之前的安全策略；后续精确adapter需要在无无重赛候选时独立允许有理由/审核/当前hash的rematch，并允许已授权历史重复及DS次数贡献，不偷偷继承generic硬禁。

接入下一步：registry新Major版本（threshold-swiss intent）/compile 16×3/3 BOprofile、runtime activate用完整standings跑Major（hash含退场对手）/manual fallback/继承seed路由、HTTP/重启/权限与UI。现Swiss pairingInput只有active rows，generic manualpair只pairing-blocked且硬禁rematch，需要专属分支，不能把19模块测试当7.1全部完成。预计全back274正在run session最新工具返回待消费，日志 `cologne-major-history-backend-full.log`；前一版本 `cologne-major-backend-full.log`273已通过。无前端变更，不新增UI验证虚报。不要再次读取所有基础文档，design/registry/swiss.js已亲读；需定位其它集成触点后亲读确切修改代码。

后续新增（本节优先）：目录升级原键重试缺陷已红→绿，`reference-demo-http.test.js`模拟cases.version++，原已提交body/key仍201同instance、新键旧version409/原键改body IDEMPOTENCY_CONFLICT。root POST在当前root授权/fields/key/confirmed后查原meta指纹，成功早返，不受新catalogversion阻断；新请求仍currentcataloggate。`reference-demo-catalog-retry-red/green.log`，修复后 `reference-demo-catalog-backend-final.log`255/255，`reference-demo-catalog-browser-final.log` lostresponse+重入真实Edge1/1，build/typecheck/strict通过。所有命令已结束，无运行session。

科隆新静态事实数据 `backend/test/fixtures/cologne2026-historical-observations-v1.json` 已落盘：3×33Swiss+7PO=106、各16名单、series scores/原display scores/日期/null actual/scheduled；BO1 raw13/16等是地图回合分，独立转系列1/0。不是原HTMLbytes，是公开事实表转录，URL+读取日+日期语义+conflicts保存。`scripts/check-cologne2026-observations.js`不导入生产，16每队Swiss记录/8晋级/阶段集合、后段集合差各8、32unique、PO单败7/BO5GF/Falcons冠军FURIA亚军全部一致，报告 `evidence/cologne2026-observations-check.json`。主代理用本地jsdom读取已冻结ESL32最终表，全部分段一致。三个新探子全terminal且不复用。Stage3 scout从Results表给Spirit–9z June14和Falcons–VitalityJune20，主代理点验match详情分别June13/June19；fixture用详情date并保留Results冲突，而不是静默纠正。HLTV比赛详情2394986与2394999可读，页面显示20:55/21:25但时区/实际含义不明，不写actualinstant。

最新种子注意：已亲读Valve April6原排名top65，Stage1初始实际首轮与简单April6排名排序不符，不能用invitation April6代替pre-event。rulebook写pre-event **current global standing**，直邀先1–8、上阶段晋级按final DS/seed9–16。下一定位应找赛事当时实际pre-event VRS日期/ESL种子公告，不盲猜April6/最新event页面current#。真实历史adapter门槛仍待满足，整体不能Done。本轮刚做一条官方/HLTV集中搜索定位，需消费其结果继续。

最新工作：隔离示例入口/已有列表重入/原账号当前权限及提交前复验/独立cookie/敏感账号操作限制/注销预览/token和持久清理均实现。7项专项通过 `reference-demo-journal-green.log`。两个实际缺陷有红→绿：多实例最后关闭未清理（先关闭自己的child句柄，再在parentDB仍打开时sweep，closing不产生timer）；半段JSON清理意图（临时文件写入+fsync+rename原子发布，失败503并父SQL回滚）。文件系统操作仅准确64hex实例文件，不递归删除。父SQL回滚仍保留demo；busy文件保留journal，指数退避和重启/最后关闭恢复。指南 `reference-demo-guide.md`、专项验收 `acceptance-reference-demo.md`。

最新全量：`reference-demo-backend-final.log`255/255，`reference-demo-frontend-final.log`82/82，build/typecheck与strict通过。浏览器全批次 `reference-demo-all-browser-final.log`115通过（既有114+lostresponse），九例因待核验文案改变而test旧字符串失败；修改当前pending文案期望、保持不能创建断言后 `reference-demo-browser-copy-recheck.log`10/10通过。合计124个不同场景覆盖通过，不能把第一次批次冒写124/124。此前 `reference-demo-full-browser-final.log`10/10全时间安排也通过，87/34/35场每场都有时间，非只首轮。主代理查看暗影三宽截图；360列表，768/1440画布区域滚动，无页面横向溢出。后端旧http.test夹具listen0抽中bad-port，失败日志 `reference-demo-backend-bad-port.log`保留；仅改高端口bounded30选择，原断言保持，随后255通过。所有命令session已消费终态，无后台测试。

TI官方正文突破：已完整亲读 `https://www.dota2.com/esports/ti15/tirules?l=english`，title The International 2026，原始HTML manifest及单独DOM转录 `ti2026-rules-rendered.txt`。同分顺序、R1组织者A/B/R2R3原组/R4跨组/R5淘汰赛最大rank距离、3-2队按rank依次挑2-3对手、八队按Swiss最终rank种子和BO3/BO5pick-side优先全文已核验；不再称这些正文缺失。normalize-ti2026-evidence.js已更新verifiedRuleText与剩余缺口；仍pending。

独立 `scripts/check-ti2026-observations.js`（不导入生产）及 `evidence/ti2026-arithmetic-check.json`：16队39系列97唯一局无缺项，wins/losses/OMW/floor GWP/floor全局均时长全对应；对手全部胜局和/全部局数和floor也16/16对应，而算术平均不对应。加权/取整是数据推断，不冒称官方发布公式。A/B从首8个官方Match*.A/B标签解释，R2/R3同组/R4跨组、每轮同战绩、39无重赛、4胜/4负停止全对应。附加选择顺序只能兼容，没选择动作日志。八晋级按规则已分开到OMW排序：VISION,Liquid,Nigma,Spirit,IW,Falcons,BB,Yandex。PO实际node14–17为[5,4],[1,7],[2,8],[3,6]，不是1v8/2v7；一个探子误倒BB/Yandex，主代理按原值纠正。规则正文没明确1v8，保留实际槽位映射，不改数据。完整14feeder现已公开可核对。继续专用adapter前需决定显式实际槽位表和人工组织者裁定接缝；不把genericSwiss当TI精确版。

科隆HLTV四公开URL已有主代理点验3阶段Swiss表+首轮公告，研究追加；BO1 13/16等是地图回合分非系列比分，首轮时间provisional非actual。普通原始HTML Stage1请求403立即停，脚本skip整个HLTV域名，manifest.unavailableSources4条与已冻结9sources分开，不冒称原始字节取得，不再重试该域名/绕WP401。仍需主办方补充规则/入口种子/完整实际时间或明确missing，0.2/7.1/10.1不勾。

Notion技能已读取/按开关打开右面板。全4schema和无filter SQL has_more=false发现1root/0child/26workItems/4modules/0iterations，31record全部fetch正文/属性，保存新T0 `.sdd/notion/runs/20261010-tournament-reconciliation/baseline.json`及514本地文件哈希。这是映射核对的新基线，不能充当前段实施开始时不存在的T0。所有Notion仍是account18/26，当前赛事change无任务映射；candidate.json准备36任务与并行change登记，未远端写入，待完整T2/授权/合并/回读。配置开关不授权外部写入。不要改旧account进度。基线包含证据日志，T1/T2须重核本地新增hash变化。

所有本轮探子终态、只读、fork_turns=none不复用。用户要求全部完成，不切片最终答复；下一步真实专属adapter/历史fixture与系统四例验收/最终独立评审，以及Notion映射协调。仍28/36（0.2/0.3/7.1/7.2/10.1/10.2/10.4/10.5未完成）；没有提交/推送/部署/归档，没有打开真实.data/platform.sqlite。下方旧续接保留历史，以上本节覆盖旧运行session和缺口描述。

---
# 前段续接（2026-10-09，28/36）
10.3已完成，见acceptance-reference-simulations.md：独立oracle脚本（不导入生产模块）、静态reference-cases-v1.json SHA2221bb17b521a9c62a9d6a7e6c355fab838e905c10e43487ae128f56cee00cad，暗影32人5轮+前8单败87场、GSL4×4接8DE两路径34/35场，三例各两次独立临时SQLite完整HTTP重放、逐场比分/对阵、Swiss每轮BH/积分/净胜局/排名、目标全排名/败数、时间UTC/offset/休息、快照/隐私均通过。reference-cases-ranked-final.log 9/9，reference-backend-full.log248通过，reference-frontend.log82通过，reference-build.log与strict通过，reference-browser-regression.log114真实Edge通过（这些全量验证在新演示入口实现前）。
实际32人R2暴露旧DFS先跨带搜到250001节点的solver-limit，已有reference-pairing-red.log；swiss-pairing.js先零费用同积分/记录合法完整匹配、seed字典序，零费证明全局最优，预算/unsat边界保持。两个独立只读核验complete：静态oracle逐场重算无差异；N4/N6全重赛图、N8 points/threshold随机各1000、N5/N7各500穷举对照无差异。只禁止Swiss重赛，GSL/DE正常复赛与GF2允许。
官方来源进一步取得并冻结原始字节/hash至evidence/reference-sources/manifest.json（脚本已保存source则跳过，不覆盖）：Valve Major赛事前最后文件commit a22f91da503d3afc00045fdad339bc6a3cd19c98，仍含Winter2025邀请表；PR41open不作已适用版。April6 VRS已存，不等于32赛事入口/seed。ESL固定2026页/cs/cologne2026/已存；通用/cs/COLOGNE/已变2027不能用。7月ESL规则更新不能倒当6月版本。完整赛事补充规则/逐场历史/入口seed仍缺，不勾0.2/7.1/10.1。
TI官方突破：Steam官方公告四胜/四负、十队5附加淘汰、8DE/BO5；主代理从官方公开页面JS定位Valve /webapi/IDOTA2League/GetLeagueData/v001?league_id=19719&delay_seconds=0与中国 /international2026/getMatchScheduleGrouped?schedule_key=ti2026&swiss_format=ti_road，完整原JSON冻结。normalize-ti2026-evidence.js（独立标准库）生成pending的ti2026-official-observations-v1.json：16队、实际Swiss39+附加5+DE14=58，排除Valve8个team_id=0即便completed=true空占位；人工双站ID映射、按pair+最近时间消歧后58比分一对一一致，保留名字差异/中国matchTime语义不明；不冒称按pair/比分即可唯一。独立crosscheck complete无具体误配。缺完整同分公式/精度/顺序文本、初始/后续配对、附加赛映射/主赛事seed与override；0.3/7.2/10.2仍pending。
当前10.4演示导入实现中，不勾选：新增backend/src/platform/reference/{cases,http}.js；root GET /reference-cases、POST /reference-demos显式confirmed/caseVersion1/expectedVersion0、当前真实session、SHA(actorId,key)实例ID/请求fingerprint。独立.reference-demos/<64hex>.sqlite存元数据及全部fakeadmin/event/draftconfiguration/submitted reference-units，一SQL事务；normal库行保持，无真实team-member signup。root /demos/:id mount独立createApp子应用，child cookie独立名字+Path前缀，主平台race_session不覆盖。reference-unit只v2 AST支持；createService默认guard拒绝，child内部allowReferenceUnits=true，v1保持individual。结构/validation两个v1 bridge仅用individual surrogate校验IDs，不改存储kind。createApp对子应用检查专属路径，在原user DB打开前拒绝错误路径。rootclose会关闭childDB。
前端shared/workspace.ts识别/demos/<hex64>前缀；api()添加前缀、BrowserRouter basename；错误重登录returnTo去前缀；全页隔离banner及返原空间链接。ReferenceCasesPage已加入root导航与受保护route，显式复选确认/创建/进入、版本冲突重读、lost-response原useWrite key重试；真实两案例pending不显示创建按钮。Child已提供16/32个submitted标签，用户通过原页面审批分配/锁定，非真实成员账户。
已新增reference-demo-http.test.js与reference-demo-restart.test.js：显式确认/版本/无登录/idem/异fingerprint/父库行无写入/childcookie/normal kind拒绝/pending拒绝/冻结referencekind；独立子库注入structure INSERT故障事务全回滚、原键恢复、改BO5/重启保留同一实例/current root session撤销401。reference-demo-persistence-recheck.log2/2通过。首次freeze bridge失败日志保留；一处test误读freeze响应.snapshot已修正为直接.structure。重启test原同port Undici复用旧socketfetch failed，改新高port验证持久化；原失败保留。
新Edge frontend/e2e/reference-cases.spec.ts有9个（3例×360/768/1440）完整创建/BO5→3保存/冻结/全部审批/锁名单/完整87/34/35逐场UI裁定确认/刷新/图真实confirmed数量/公开3视图/root登录与目录无demo，另1lost committed response原键恢复。正在运行session67942，日志reference-demo-browser-all.log，已前6通过；必须消费最终结果。首手机测试全流程34场已通过到末尾，仅错误测试按钮名“按赛制图”拖至240sec；实际名“赛制签表”已修正。旧失败日志/trace保留。新入口build/typecheck reference-demo-build.log通过，但新入口之后完整250 backend/前端/124Edge仍未执行，待改动稳定后最终运行。
下一步：消费67942结果、主代理看三宽度截图（尚未加新截图）；演示子空间时间UI批量完整安排/独立API重放integration、root/child权限隔离和注销兼容继续核验。当前需解决真实用户注销后的演示文件：root child mount虽在parentOwnerId不存在时404，但文件仍留；须安全清理并纳入deletion-preview/token且不在父SQL失败前删文件。演示root创建已有metadata，但刷新root示例页无已有demo列表/重入按钮；应补列表/当前owner重入或明确入口保持，避免可用性缺口。假演示管理员不能用随机密码登录/改敏感账号；原空间入口可重发独立cookie。未设计auto replay UI，不要凭fixedseed误称随机模拟按钮已实现。
所有探子均终态，只做只读定位核验、不复用。任务当前28/36，剩0.2/0.3、7.1/7.2、10.1/10.2/10.4/10.5。用户要求全部完成，不能切片最终答复。主代理代码/取舍/最终验证；派探子必须fork_turns=none，省角色等，派后立即wait直至全部相关终态，期间不推进或修改。
不打开/修改用户.data/platform.sqlite；测试全临时/内存。保留全部未提交其他变化；不安装/提交/推送/部署/归档。Notion无完整T0、未远端写入，仍待相关流程。无其他运行命令，67942浏览器仍需消费。

---# 当前续接（2026-10-09，27/36，继续直至全部完成）
9.1–9.3完成：独立schedule_aggregates migration2（不改结构/运行版本）、GET/PUT/current-role/原键/409、UTC+固定offset/资源/窗口/assignments、来源集合/前置+休息/资源冲突、Swiss配对产生同事务重检/不自动排时、actual-start及首次POST结果记录开始、已开始计划锁定、注销及重启、管理批量安排和公众三视图/筛选/手机按组折叠。详见schedule-guide.md、schedule-api.md、acceptance-schedule.md。
最终244后端、82前端、114真实Edge、build/typecheck/strict通过；公开标题/版本文案/按组折叠随后3宽度点验通过。两次后端bad-port失败保留，formats-v2-fixture改高端口有界选择后全量通过（不改密码断言）；图阶段Edge fixture也跳过Windows保留端口EACCES。未打开/修改用户开发SQLite。
独立两路时间核验完成：backend探子partial静态无确定缺陷、未跑测试；UI实际开始409旧版本问题已补重读并明确新版本重试，用真实另一场并发裁定验证。共享窗口锁定疑点通过另一未开始比赛取消并移到新窗口/台、已开始比赛保持验证，不解除共享窗口保护。所有探子已终态，不复用。
下一项0.2/0.3官方证据与10.3通用两样例、10.4/10.5最终验收。剩余9任务：0.2/0.3、7.1/7.2、10.1–10.5；不得用generic或2025替代官方2026，整体Done要两个真数据门槛齐全。原研究定位结果还不完整：ESL Cologne2026 Stage3全BO3公告/32名单页可读，Valve需要历史commit/VRS/完整配对与比分时间；TI2026主站/Steam/完美世界完整modified Swiss及数据仍需获取。
主代理已完整重读research.md、design.md、RC1–3 spec与acceptance-plan.md：样例entrantKind=reference-unit只隔离演示，显式创建独立演示赛事；测试始终临时SQLite。暗影32×5+前8单败=87 seed2026100801；GSL4×4五场+8人双败=34/35 seed2026100802，完整随机分数独立构造，不从生产生成器倒推断言。示例导入幂等/版本/真实库不写入仍未实现。
准备案例实现时需先决定独立演示库接缝（不要绕过参考单位隔离限制），并冻结独立fixture/expected；代码修改、方案和最终验证主代理负责，探子仅定位/独立核验。尚无正在运行命令或探子。
不安装/提交/推送/部署/归档；保留全部既有未提交成果和其他活动changes状态。Notion仍无完整T0基线、无远端写入，待依项目同步流程处理。

---# 当前续接（2026-10-09，24/36，继续直至全部完成）
8.1–8.3完成：完整小组子图、六类格式全图、实际planKey状态回填、独立布局、具名端口/表单/键盘等价连接，来源禁止复制、目标明确替换、64人布局、三宽度及409后切页保存。循环v2新增真实单/双循环运行器，与编译计划一致；N4/N5奇数休息、积分/H2H/人工排名和实际6/12场UI通过。
最终227后端、82前端、107真实Edge、build/typecheck通过；详见full-graph-guide.md、acceptance-full-graph.md与 graph-*-complete/final-pass.log。主代理已查看修复后768/1440图；360最新截图也需再点验。两路只读核验完成，疑点处置记录在验收文档。旧测试初读时序、v2/v1导航名、Windows保留端口失败日志保留；有界端口选择现在也跳过EACCES，不改生产规则。
当前9.1/9.2实施中：schedule/validation.js 与 items.js 及两个独立测试文件已红→绿，共7项；时间聚合/HTTP/实际开始/注销兼容尚未接入，不勾选9任务。下一步新增独立schedule_aggregates，基于冻结digest/planKey，structure.edit/current-role/idempotency/409；开始状态results.edit，首个POST报分记录actualStartedAt；实际配对生成事务内复核，无静默改时。
已完成两个时间模块定位探子，主代理亲自读database.js、state.js、operations/http.js、runtime-http.js、app.js、operations/deletion.js和注销profile片段；探子输出供接缝定位，不改代码。所有探子已终态，不能复用。
官方0.2/0.3、7.1/7.2和10.1/10.2证据门槛仍待完成；通用运行不冒称科隆/TI历史复现。10.3/10.4/10.5仍待。保留未提交成果、不改开发SQLite、不安装/提交/部署/归档；Notion未建立完整T0，未远端写入。

---# 当前续接（2026-10-09，21/36，继续直至全部完成）
5.1–5.4通用Swiss验收完成，tasks已勾选。最终219后端、73前端、79真实Edge/build/typecheck/strict通过。独立solver/statistics complete并实际14/14；atomic/UI complete发现numeric points仍允许小数/不安全数，已限制v2为安全整数或canonical decimal（v1 finite number保留），有拒绝/零allocations回归。第一次后端密码随机bad-port日志保留；前端字段同步读取失败独立11/11诊断通过后补await，完整73通过。
见swiss-runtime-guide.md/acceptance-swiss.md。默认250000节点困难例（两个15人孤立奇分量）250001返回solver-limit实际2.5sec通过。Swiss6条三宽度全流程+6条manual ranking/pairing/lost-response原key全通过；手机表挤压已改760宽横滚/可focus键盘ArrowRight测试通过，局部表截图已个人看清姓名战绩。表列名刚改名次/资格并显式标晋级/淘汰；只有copy变化，build再次通过，后续图全回归接续覆盖，不重复所有测试。
当前8.1–8.3开始。亲读design、CW6/CW7、SC1–3、PR5全规格；GraphEditor全代码、extras.js布局全代码、RouteForms整段、forms.references、compile RR段、app完整及旧round-robin完整代码已读。完整计划从保存validate报告plan/冻结snapshot.plan获取，图尚不消费。计划新增v2完整图，保留v1GraphEditor行为。v2 round-robin两个版本当前未开放，需循环图/真实key一致时补适配（compile已有全场次，旧round-robin可复用但新points/双循环/排名需正确冻结）。
两graph接缝探子complete无运行：frontend GraphEditor props(payload/disabled/onChange/url/onLayoutDirty)，阶段/组/池节点；saveSessionLayout只过滤stage/group/pool ID，RouteForms references无named port会丢。后端extras.layout allowed ID只stage/group/pool，coords±10000；layout自身version+1，write外围{version:false}仍opsversion+1；探子关于外围version默认校验表述不准确，主代理全文已点验。stage-groups影响/裁剪只旧stage/group/pool，完整match keys需要扩展并保持BO-only位置。
后续图策略尚未实施：编译DTO完整match/window与input/output keys、确定性格式布局（DE分区/RR轮次矩阵/Swiss未来窗口），overviews+group subgraph与自动/对齐/折叠/排序/独立layout保存；新具名端口表单/键盘source唯一、target冲突明确替换。draft未保存完整plan需只读preview接口（非冻结、不写比分）；public bracket从runtime.plan脱敏project。需要先TDD再实现。所有agents均terminal，不复用；无运行shell session。
剩15任务：0.2/0.3官方证据2，7专属2，8图3，9时间3，10案例5。官方探子partial线索仍未冻结/核实完整；主代理Dota220508网页find无Swiss/轮文本，相关探子声称完整细节暂不采信。Notion完整实时T0与同步待核验。不提交/部署/归档/用户SQLite修改，持续全部目标，不逐切片最终答复。
# 当前续接（2026-10-09，17/36，继续直至全部完成）
6.1/6.2/6.3双败完成。最终192后端、73前端、build/typecheck、67真实Edge完整通过。15三宽度双败专项通过，360标准GF2未激活/768half激活/1440same激活代表截图已由主代理查看。见de-runtime-guide.md/acceptance-de.md。独立DE核验partial（静态/手算完成，测试spawn EPERM），无可复现缺陷；主代理完整测试实际通过，不冒称独立完整执行。新增多种固定随机左右结果性质验证，N4–64合法入口Q前沿与真实历史一致。
当前5.1–5.4瑞士实施开始。亲读runtime.js/runtime-http.js/state.js/runtime-v2.js、参数瑞士部分。新swiss-pairing-v2.test.js 4行为红测已写，swiss-pairing-red.log因尚缺swiss-pairing.js模块失败。下一步实现 format-runners/swiss-pairing.js：硬禁重赛、first top-bottom、未bye最低分/最大seed优先、全匹配最小float BigInt成本、250000节点预算区分unsat/solver-limit；之后stats/动态运行、事务外求解+输入hash/version复验、人工配对/排名与UI。
无运行shell session。此前summary里的DE/GSL sessions都已结束。tasks17/36，其余官方0.2/0.3/7/历史案例，Swiss5，图8，时间9，验收10继续。Notion基线同步待核验。用户要求全部完成，不逐切片终止，不自动提交/部署/归档。

---
# 当前续接（2026-10-09，14/36，继续直至全部完成）
4.3 GSL完成，182后端/73前端/build/typecheck/52真实Edge完整通过，三宽度GSL截图已查看。独立gsl_runtime_contract_check complete，无实际缺陷。见gsl-runtime-guide.md/acceptance-gsl.md。tasks已勾选4.3；前面的3.3/4.1/4.2为177/73/49全回归，见entry-runtime-guide.md/acceptance-entry-single.md。
当前6.1–6.3双败实施中，尚未勾选。de-v2.test.js 4领域涵盖N4/8三入口Q1/2/3手算、具体N8cross feeder、reset两路径、N16/32/64身份/败数；de-v2-http.test.js实际18组合（N4/8×3入口×3Q）完整通过，GF1下胜触发GF2。de-http-red.log为501红测；开放后de-runtime-green.log 5/5。support.js现支持single/GSL/de-standard/de-lower-entry。共享权限/回滚重启测试已参数化到四规则；de-backend-final.log全191通过。
前端新增败者直邀真实历史说明、条件GF2未激活说明；修正DE输入默认positionKind跟随冻结选择。parameters.spec.ts追加15个三宽度×五DE路径（disabled noreset、reset UB赢、reset LB赢、half/same reset LB赢）浏览器；helper approveSingleRosterUI新增upperCount分配两端口。
正在跑DE浏览器session45547，日志de-browser.log。首轮测试1min超时因确认后动态当前轮定位仍读旧波次，测试已改第wave+1轮精确标题等待；不是业务红。不要重复旧模糊定位。build de-build.log通过。此浏览器完成后看三宽度代表截图，独立DE评审、全前端/67Edge/strict/diff再勾6.1–6.3->17/36，再Swiss5与图8/时间9/案例10。
两官方探子均partial已终态，不复用。科隆找到ESL官方最终32队/HLTV各阶段及结果页、Valve历史commit和VRS仍缺；TI找到Dota中国活动/赛果页、Steam、动态专题，精确同分/附加赛种子/实际时间仍缺。主代理已web打开ESL Stage3更新和Dota中国20260731/220508，后一正文find瑞士/轮均无匹配，探子关于该页完整Swiss描述暂不采信；不可把代理报告直接当冻结证据。0.2/0.3/7.1/7.2/10.1/10.2仍pending。research.md未追加新事实，继续获取验证而非宣称永久阻断。
用户要求全部完成，不能再次仅切片最终答复。下一项按依赖持续实现，无提交/部署/归档/用户SQLite修改；Notion完整基线同步仍待核验。

---
# 当前续接（2026-10-09，13/36，继续直至全部完成）
3.3/4.1/4.2完成：配置命名空间entryRef、后阶段直邀与全部来源齐备整体启动、单败N→Q与季军战实际运行。见entry-runtime-guide.md、acceptance-entry-single.md。177后端、73前端、build/typecheck、49真实Edge全回归通过。32唯一身份领域示例与12身份HTTP缩例如实区分，尚非科隆官方复刻。
审批配置切换竞态真实红测并修复等待/失败保护及保存后入口草稿更新；三宽度实际季军战截图已查看。两项独立核验完成，缺placement疑虑经复现已被现有校验阻断并补回归。
当前继续4.3 GSL。gsl-v2.test.js新增A/B/C/D五场三波次/每场BO测试；绝对slot红测已修复compile.js使用seeds(4)，2/2领域通过。尚未开放GSL runtimeSupported，需实际HTTP、权限/并发/重启及三宽度UI后方勾选。
下一步GSL HTTP，然后Swiss/DE、图/时间、官方资料与四案例。剩余23任务，无提交/部署/归档，无用户数据库操作；Notion完整基线与同步仍待核验。当前无环境阻断。

---
# 当前续接（2026-10-09，10/36，继续直至全部完成）
3.2完成：具名输出/upperlower独立入口、名额范围唯一消费、目标席位/容量、rank与资格不同、池seed范围、实际池链跨活动targets重身份整体零allocations；编译connections绑定unit/pool，保存前拒绝已知非法路由。详见routing-v2-api.md。
最终158/158后端、44/44真实Edge通过。首次slot默认语义过严15失败，定位既有明确slot路由后修正并保留red日志；未改原兼容测试。参数草稿允许不完整不是路由绕过；PR5正确规格独立complete核验无领域/API阻断，partial/错change评审如实处置。
下一项3.3：registration.entryRef支持后续直邀、具名输入、64唯一、所有来源完成再整体启目标。现有start/createUnit/progression仅v1；需接v2编译runner基础，再与4.1单败实际运行共同验收（3.3不能只添字段就勾选）。当前已亲读registration.js/runtime-http.js/progression.js。下一步亲读runtime.js与相关执行规格/接口，红→绿。
已完成0.1/0.4/1.1–1.4/2.1–2.2/3.1–3.2，剩余26任务持续推进；不提交/部署/归档。Notion完整实时基线仍待核验。普通沙箱读写可用，子进程全测试通过自动审批可用，当前无阻断。

---
# 当前续接（2026-10-09，9/36，继续直至全部完成）
0.4双败N4/N8三入口/Q1/2/3/reset手算表经独立complete核验；3.1八规则完整编译计划、稳定key、来源AST、具名unit输入/资格通道、明确wave确认契约、条件GF2、Swiss未来窗口已接入validate与freeze。v1无plan字段且六人固定hash不变。
见double-elimination-feeders.md和compiled-plan-api.md。最终146/146后端、73/73前端、build/typecheck通过，parameters真实Edge25/25通过。两路独立评审完成，已修正完整截断种子和通道索引，明确BO与half feeder映射和批次。未宣称实际运行已开放。
下一项3.2具名路由/名额唯一消费/池链身份、3.3entryRef混合直邀；随后单败/GSL/Swiss/DE运行及图/时间/四案例，剩余27任务继续。
普通沙箱读写已恢复，子进程仍EPERM；自动审批曾因额度失败未执行一次命令，后来项目完整测试审批成功，当前无阻断。真实测试仍临时SQLite，无提交/部署/归档；Notion完整实时基线待建立。

---
# 当前续接（2026-10-09，7/36，继续直至全部完成）
2.1/2.2完成：配置级session跨参数/结构/布局子页保留、真实tid/cid离开判断、canonical dirty、beforeunload和保存/舍弃/留下；参数影响确认等待用户选择，保存失败不放行，409显式比较恢复；冻结前结构/布局分别处理并采用真实新版本。
最终73前端单元、build/typecheck、44真实Edge全回归通过，三宽度截图主代理已查看。帮助与验收见editor-session-guide.md、acceptance-editor-session.md；独立核验及partial意见处置、一次编辑恢复与全回归如实记录。
下一项3.1：稳定planKey、来源表达式、具名端口、确认波次/条件节点的完整编译契约；随后3.2/3.3与各格式运行。v2冻结目前仍501，来源预演未实现，不冒称开赛。全部剩余29任务按依赖继续，不逐切片终止。
保留现有未提交成果，不改用户SQLite，不安装/提交/部署/归档。Notion未建立完整实时T0，待同步。普通沙箱helper仍故障，已授权项目require_escalated命令可用。

---
# 当前续接（2026-10-08，5/36，用户要求继续至全部完成）
1.4已完成，API /configurations/:cid/copy-upgrade 显式独立v2副本+upgradeOrigin映射；原配置/名单/冻结不改。无组生成单组并补group引用，stage/group/pool/route/sourcePriority统一映射。6人保留不完整诊断；异构/未知规则拒绝。映射对象无原型避免__proto__合法ID失败；元数据剥离结构payload并随编辑保留。
130后端/69前端/29真实Edge回归通过，复制三宽度/dirty禁复制/响应丢失同键重试、SQL回滚与重启已核验；详见copy-upgrade-guide.md及evidence/upgrade-*-final.log。
下一步2.1/2.2：配置级session保留结构/参数/布局跨子页，blocker仅tid/cid离开；canonical真实差异，view缩放不dirty；离开保存/舍弃/留下，失败/409保留，冻结前处理草稿。后续仍32→31项依赖任务，包括官方科隆/TI来源门槛，用户最新请求授权继续实施所有剩余项，不逐切片停止。
当前分支/未提交成果保留；未操作开发DB/安装/提交/部署/归档，Notion仍待同步；普通沙箱helper故障，require_escalated项目命令可用。前端GraphEditor当前组件内持有layout，切页即丢；v1 reducer仍挂载跨页但blocker按path拦截，v2目前各tab都是参数页面且无离开提醒。

---
# 当前续接（2026-10-08，4/36）
任务1.3完成：新建赛制配置走v2；旧空草稿/v1保持原路径。服务器默认集、格式高级字段、合法数量/64人预算、总输入/晋级摘要、阶段恢复、影响确认/取消、409读取比较/显式保留或替换、响应丢失原键重试已接入。见parameter-editor-guide.md及acceptance-parameters.md。
前端全回归69/69、真实Edge7/7及旧平台/工作台合计26/26通过，类型/构建与strict通过；三宽度截图主代理已查看。独立两路核验后修复N降2清季军BO、非法积分禁保存、读取最新版本并发锁；干净修复核验无本切片阻断。
测试fixture低端口过滤循环已改高端口有界重试，首次label精确定位失败改combobox可访问名称；最终浏览器证据通过。环境/fixture故障不充当业务红→绿。
下一项1.4显式复制v1草稿升级与引用映射（旧六人单败/冻结digest不能覆盖）；随后2.1/2.2配置会话及离页保存。当前v2各配置tab呈现参数页，完整图编译/运行仍待3.1及后续，不宣称可开赛。
未操作用户SQLite、安装、提交/推送/部署、主规格同步/归档；Notion无完整T0/远端写入，仍待同步。普通沙箱helper故障，项目require_escalated实施/测试可用，无审核拒绝。保留其他活动change和既有未提交改动。

---
# 当前续接（2026-10-08，3/36）
任务1.2已完成：默认独立组生成、旧组ID稳定增组、请求幂等、只读缩组/换格式影响计划、确认令牌及结构/报名/布局同事务应用。API见stage-groups-api.md；验收、独立核验处置及最终124/124后端证据见acceptance-stage-groups.md。
新接口POST /configurations/:cid/stages、/stages/:sid/plan、/stages/:sid/apply。缩组/真实重建要求明确确认，依赖变化令牌失效；普通PUT不能绕过。清报名sourceId需registration.review且原成功键重放复核撤权；保留答案，锁定名单/关联runtime不改。无变更只读计划不写。
纯BO/overrides改动不清连线与名单；布局报告区分removed/retained，只删除消失节点。独立影响评审返回partial漏列布局意见已处理，事务权限评审无阻断；修正后的干净点验无阻断。
最终全后端124/124、strict/diff/format检查通过。首次122全回归旧TO7 fixture fetch bad port导致1失败，原日志保留；完整重跑122通过，最终增加2个评审修复测试后124通过。该偶发端口问题没有改fixture或宣称已修复。
下一项1.3：前端参数页面/格式相关字段、合法数量、人数和晋级摘要、真实HTTP接入与409草稿保留，三宽度实际保存；其次1.4显式复制升级。当前没有页面接入和v2真实运行，完整图编译门槛仍在3.1。
未操作用户SQLite、安装依赖、提交/推送/部署/主规格同步/归档。Notion本轮无完整T0、无远端写入，保持待同步；旧工作台12/12、账户素材18/26保留各自状态。普通沙箱helper故障仍在，已授权require_escalated项目实施和测试可用，无审核拒绝。

---

# 当前续接（2026-10-08，2/36）
已完成1.1版本化赛制目录、v2基础解析与服务端参数/defaults；目录GET /api/v1/formats需登录，八规则明确runtimeReady=false。接口和边界见formats-api.md，红→绿、独立核验处置与最终109/109后端回归见acceptance-formats-v2.md。
现有v1读写/冻结/运行保留；原地跨结构版本替换409，显式复制仍待1.4。v2参数草稿可保存校验，完整图编译前冻结501且不留snapshot；非法参数先422。
下一项1.2：重复组自动实体生成/稳定ID/增组幂等、缩组及换格式影响报告与明确确认原子应用；1.3参数页面和1.4复制升级随后。默认GSL4组目前由调用方提供4个稳定组，不宣称自动生成接口已完成。上游新具名入口/编译3.1–3.3尚未接入。
参数与HTTP两项独立只读核验完成；odd half草稿问题已复现修复，routes缺失TypeError报告经主代理复现不成立。后补BO轮次与schema独立副本由主代理红→绿及最终全回归验证。
普通sandbox helper故障仍在，require_escalated的已授权项目实施/测试可用，无审核拒绝。本轮未改前端/运行浏览器，也未修改现有SQLite、安装依赖、提交/推送/部署/同步正式规格/归档。
Notion完整T0本轮未建立，未写远端；历史不完整快照不替代本轮实时基线，保持待核验。旧工作台12/12与素材18/26保持原状态。

---

# 当前续接（2026-10-08，1/36）
用户要求推进赛事SDD，本轮接续optimize-tournament-planning-and-schedules，完成任务0.1。版本字段、v1/v2迁移边界、运行版本、来源入口及兼容样例见compatibility.md。
主代理亲读前后规格与关键实现；两项只读探子完成定位及独立核验，无阻断，三处源码引用精度已修正。最终后端95/95、0失败，日志evidence/compatibility-backend.txt；只证明旧规则兼容基线，不是v2新行为测试。
本轮仅新增兼容记录及更新任务/交接，未修改业务代码或现有SQLite；未提交、推送、部署、主规格同步或归档。前序工作台12/12、账户素材18/26保持各自状态。
下一项1.1：版本化格式目录、v2解析和服务端参数/defaults，按业务红→绿实施；2.1/2.2也已满足0.1前置。任务0.2科隆、0.3TI、0.4双败feeder仍未完成，只约束各自后续任务。新增v2复制/冻摘要/HTTP/故障重启尚未测试。
Notion同步待核验：本轮入口fetch成功，缺完整四库查询、关联发现与全部正文/schema基线，scope.complete=false；审计.sdd/notion/runs/20261008-tournament-compatibility/。无远端写入，面板返回queued，不宣称打开或两端一致。
普通沙箱仍无法启动；require_escalated项目读取、文档写入及后端测试通过自动审批可用，无审核拒绝。

---

# 规划交接（2026-10-08）
用户要求完成六模块计划，已创建optimize-tournament-planning-and-schedules；proposal、8份delta spec、design、tasks（0/36）、parameters、research、module-plan、acceptance-plan齐全，严格校验通过。
主入口module-plan.md；默认值/人数/数量、提醒、专属赛制与运行、画布、时间赛程、四案例均有任务/场景/验收。
用户唯一新增明确决定：额外败者输入已有一败；其余平台参数细节为可审查设计选择，不追溯冒称官方统一规则。
实施顺序0.1→1/2→3→4/5/6→8/9→10；特定规则0.2科隆、0.3TI、0.4双败feeder证据冻结门槛分别约束对应任务。真实案例资料未完整取得，禁止标复现通过；默认值和提醒不被这些资料阻塞。
独立只读核验已发生，处置见acceptance-plan.md末节：33场算式质疑经人工枚举不采纳；canonical ID与分段单败语义已明确。
此前implement-tournament-workbench 12/12及improve-account-input-and-game-presets 18/26不改写、不归档；未修改业务代码、未跑新增业务测试、未提交/部署。
普通sandbox helper失败，require_escalated只读/项目文档写入自动审批可用，无审核拒绝。
Notion：本轮fetch仅工作台入口（工具正文as-of为2026-10-05，缺完整四库/关系/正文集合与完整性保证），面板工具返回queued，不宣称已打开。scope.complete=false，无本轮远端写入；旧快照不替代实时完整基线。下次同步先完整T0/T1/T2及回读。
下一阶段在用户请求实施后使用项目openspec-apply-change，先读本change任务依赖，不自动按CLI isComplete把工程标完成。CLI此字段在规划阶段表示工件存在，不代表36任务完成。

# 瑞士续接补充（2026-10-09，仍17/36）
5.1–5.4进行中，均未勾选。新format-runners/swiss-pairing.js（纯求解硬禁重赛/最小float/bye/250000预算）、swiss-standings.js（BigInt精确points/BH、DS/net/bye/manualties）、swiss.js（fixed/threshold动态单位、来源hash/version、人工完整合法配对、资格数量异常不造人）已接入runtime-v2/runtime.js。
state.js新增writePrepared：授权/缓存/版本preflight→事务外prepare克隆state→事务内再次权限、版本、完整输入hash复验原子应用。start/round confirm/ranking及manual pairing已接writePrepared，result edits仍原write。纯prepared-operation测试证实事务外db.isTransaction=false、缓存不重求解、旧版本拒绝、SQL回滚+原key可重试。Swiss节点有planKey由window生成，未来Schedule复验待9。
POST /units/:uid/pairing新增完整pairs/bye/inputVersion/inputHash/reason；硬禁重赛/dup/已获bye/首轮冻表不放松；当前rounds.confirm权限，公开round.pairing.decision去actorId。ranking人工结束Swiss重建qualification。公开大积分为decimal string（仅v2 sources points新增规范decimal，BigInt比较；v1 finite number不变）；routing-v2新大点数准确排序红→绿。Swiss source profile绑定冻结参数hash，不合池比较不同分制。
当前support包含single/GSL/DE双版本/Swiss双版本，仅round-robin两个v2仍未开。Swiss实际HTTP固定8×3=12、threshold16×W3L3=33、missing/locked/idem均通过；人工HTTP模拟solver-budget blocked fixture（不冒称8人简单例自然触预算），验证oldhash/dup/rollback/原key/撤权原成功key403及匿名脱敏。six规则共享ER5权限/事务/重启参数化。swiss-backend-interim.log 213/213通过，但之后新profilehash测试和frontend修改需最终重跑。
前端competition新PairingDecision中文逐场选双方+bye+reason，不用JSON表单；ranking规则/points/BH/DS/net/seed与对手小分来源、双方负和qualificationMismatch警示；大表仍table-scroll。参数threshold elimination标签改淘汰战BO。params.spec新增时钟隔15min每8注册（保留生产限流），Swiss6条三宽度创建/冻结/审批/运行/刷新，count16可测。
当前browser session87309? 以上实际工具返回为下一条session，请以最新工具结果为准。日志swiss-browser.log，6条Swiss。第一次spinbutton轮数定位错误，改combobox；第二次固定3条通过，阈值因手写counts第三轮错误6失败，正确三胜三负为8/8/8/6/3已改，正在重跑（不是业务red）。swiss-build.log通过，小分对手来源UI最后编辑尚未再次build，先等浏览器完再build/runmanual UI。
需要：6条Swiss截图个人看；新增异常/完整人工配对/同分切线真实Edge测试（含mobile），纯manual cutoff HTTP与不同分制/大积分实际运行/solverlimit真实困难例独立核验，prepare过程中撤权/版本hash复验；two narrow scouts reviewer后全back/front/build/约75Edge/strict。Swiss指南验收/任务5勾选仍待。剩余图8/时间9/官方0.2/0.3/7/案例10/Notion同步继续，不最终答复切片。
