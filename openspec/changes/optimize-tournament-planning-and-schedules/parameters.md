# 阶段参数与规则目录（规划）
日期2026-10-08。用户确认败者组输入为额外参与者并已有一败。下列为本变更建议采用的平台规则，审批/实施前可审查；不会把平台算法冒称各赛事统一官方规则。

## 通用字段
| 字段 | 默认/范围/说明 |
|---|---|
| id/name/order | 稳定ID、可读名称、拓扑顺序；ID不由展示名推导 |
| format/ruleVersion | 显式赛制及算法版本，不由标签猜算法 |
| groupSize/groupCount/qualifyCount | 每组人数/重复数量/每组晋级人数；组数1–64，阶段输入与赛事唯一人数≤64 |
| groups | groupCount与实体组数量相等，已有组ID保留；重复创建后各组继承相同规则，本期不提供同阶段异构赛制 |
| seeding | seed或slot明确区分；seedTableVersion固定；禁止混用、重复、越界 |
| inputs | roster来源、上游晋级、直邀入口均有稳定ID；容量/必需席位与人数一致 |
| bestOf/default与overrides | BO1/3/5/7；按轮/比赛角色覆写，默认3；不支持偶数BO |
| points/tiebreakers | 仅积分赛显示，字段有完整中文名称、公式版本和有序列表 |
| allowDraw/allowPlayerDoubleLoss | 淘汰类始终false；固定瑞士/循环允许配置，阈值瑞士draw=false |
| confirmationProfile | group-round-v1或dependency-wave-v1；算法推导，不要求用户手填 |
| estimatedDuration/minRestMinutes | 时间计划单独保存，默认60/0分钟；不改变实际比分与结构 |
| graph/output | 由规则派生；输出为qualification集合/有序名次/胜负端口，不能把并列输出暗改名次 |

### 默认创建与交互
新建赛事默认私有；不自动选择游戏或开始时间，保留现有游戏预设与固定偏移。
添加阶段默认单败8人×1、晋级1、BO3、无季军战；选择格式后装入合法默认集。
选择GSL为4人×4、晋级2；循环为4×1、晋级2；双败8×1、L=0、Q=1、reset=false；瑞士默认为阈值16×1、W=L=3、正常输出8、BO3（Major模板另覆写）；固定瑞士默认16×1、R=4、Q=8。
使用合法选项列表减少非法输入；高级字段展开编辑；改变格式先展示重建影响。未保存状态基于规范化业务值而不是JS属性顺序。

## single-cut-v2
N 2–64，Q 1..N/2，N/Q=2^k(k≥1)。bracketMode=complete（默认）完整席位模式N及Q均为二次幂；bracketMode=segmented高级分段模式允许N/Q为二次幂、非二次幂Q并生成Q个相同大小的独立淘汰树（例12→3为3个4人树），不声称单一12人冠军签表。
seed映射复用固定递归表，树内不重排。N-Q场，log2(N/Q)轮。Q>1输出资格集合，后续路由可明确按初始种子排序；这只是落位顺序，不是竞技名次。
thirdPlace仅Q=1且N≥4，默认false；启用额外1场，与总决赛同一确认批次。决赛/季军BO可覆写。非轮空名单本期仅保留v1路径，新v2默认必须齐满；历史v1非二次幂轮空不改。
返回完整状态包括冠军/亚军/3–4并列或季军结果、资格集合、真实胜负、原种子。空槽/轮空无虚假数字比分。

## gsl-classic-v1
N=4 Q=2；组数默认4。种子首轮1–4、2–3。五场：
M1/M2首轮→M3胜者战=W(M1)/W(M2)、M4败者战=L(M1)/L(M2)→M5出线战=L(M3)/W(M4)。
批次[ M1,M2 ]、[ M3,M4 ]、[ M5 ]，各批次完整裁定后确认。第1=W(M3)、第2=W(M5)、第3=L(M5)、第4=L(M4)。M5可能重赛，是赛制允许的重赛；不能套用瑞士禁重赛约束。
字段：组数/种子、defaultBO、opening/winners/elimination/decider BO；无GF无reset无季军战。

## de-standard-v1 / de-lower-entry-v1
upperSize=N二次幂2–64；lowerEntryMode=disabled/same/half，lowerSize=L分别0/N/N/2只读；每组总人数T=N+L≤64。qualified=1/2/3，其中Q=3仅N≥4；组数受总人数上限约束。初始败数upper=0、direct-lower=1单独记录，不创建一条假的既往比分。
种子入口upper/lower分别唯一，跨入口身份不可重复。败者直接入口L=N时先打lower预选N→N/2；L=N/2无预选；预选胜者与UB首轮N/2个败者在下一LB接入轮配对，之后LB幸存数量与标准表对应。L=0走标准首轮败者互打。lower预选与UB首轮可同批但其后继必须等整批确认。
UB按固定种子淘汰图；标准LB按交替consolidation与drop轮生成，upper第r轮败者与对应LB存活者接入，drop映射由版本化交叉feeder表确定。固定图允许后期必要重赛，不声称全程禁重赛；每批一人最多一场，无循环，无孤立必需席位。
Q=3：停在UB冠军1人及LB决赛前2人；Q=2：停在UB冠军1与LB冠军1，不打GF；Q=1打GF。
finalReset默认false：GF1任意方胜即冠军；true则LB冠军赢GF1才产生GF2。reset仅Q=1；GF/GF2 BO默认继承、可统一覆写。Q2/3输出upper/lower资格通道；相同LB前沿未交手者并列，不捏造第2/3名。
平台LB映射与直接输入语义不等同Toornament的Skip1stRound。本变更必须人工列出N=4/8和L=0/N/2/N三类feeder期望，过独立核验后才能标版本可运行。

## swiss-fixed-v1
N=2–64；R=1..N−1(偶数N)或1..N(奇数N)；Q=1..N，默认N=16 R=4 Q=8。胜/平/负/双方负积分默认3/1/0/0；可选allowDraw默认false。bye计满胜积分、胜场1但没有局比分，每人最多一次满分bye。
firstPairing=top-bottom（稳定种子表）；后续同积分优先、硬禁重赛、跨积分允许最小差float。固定规则优先序：完整配对可行→最小跨分差→种子配对顺序；不依赖数据库遍历/账号ID。
bye从未获bye者中按积分最低、初始种子最低优先取（较大seed），再求完整匹配；无解保留阻塞而非重复轮空。每次完整匹配求解设确定性搜索节点上限，达到上限为solver-limit而非无解证明。
排序points desc→BH-points-v1 desc→netGames desc→initialSeed asc，用户可移除最终seed而启用manual-with-reason。BH-points-v1为已实际交手对手在本阶段当前积分之和；bye贡献0；双方负仍有实际对手；重赛若在某允许版本出现按每次交手计。该简化平台BH不冒称FIDE/Pokémon规则。
净胜局为已裁定正常数字比分之差，bye/双方负不贡献；所有小分公开公式和来源。最终依排序取Q，已确认轮赛果不重算改分。

## swiss-threshold-v1 / cologne-major-2026待证据冻结
N默认16，W=L=3；generic阈值允许W/L 1–5，N2–64，但动态名额仅正常模板能预估；最大W+L−1轮。胜一场+1胜，负+1负，双方负两方各+1负；bye+1胜无局比分。达到W/L者不再参加本阶段配对；阶段结束与跨阶段等待所有来源分开。
draw禁用；full-point bye每人至多一次；通用阈值同战绩优先并允许冻结的最小差float，硬禁重赛；达到阈值人数不同于固定quota时阻塞路由并指出人数差。
通用默认排序record→DS-wl-v1→initialSeed；DS为每次实际交手对手当前胜数减负数之和，bye=0。不得混用BH-points与DS。通用BO默认3，advancement/eliminationBO可覆写3。
科隆精确模板：三次16人瑞士（共32个不同单位，S2/S3各8直邀），3胜3负；前两阶段普通BO1、晋级/淘汰BO3；Stage3全BO3。首轮表、后续指定配对表与例外、最终阶段继承种子、Playoffs BO必须在task0.2冻结比赛当时官方规则版本，不用实时main分支冒充当时版本。模板未完成前返回不支持。
TI15版本不采用本通用阈值模板，必须另冻结modified Swiss、附加淘汰与双败衔接；完整规则未核验前此特定版本禁止运行，不影响平台瑞士实施。

## round-robin-v2 / double-round-robin-v2
N2–64，组数默认1，Q1..N，默认N4 Q2；cycleCount=1/2。复用圆桌旋转，双循环第二腿交换双方；奇数休赛不加积分，无虚假轮空胜。
默认3/1/0/0、允许平局false、固定同积分集合交手积分→净胜局→留因裁定；交手规则为一次固定集合，不递归重算。积分可编辑为非负整数且胜>平≥负；不同分制排名不直接合池比较。
doubleLoss管理员/系统可用，选手开关独立。撤权、名单锁、公开隐私与永久轮锁继续沿用旧版本契约。

## 案例标识
canonical caseId：cologne-major-2026、ti-2026（显示TI15（2026））、shadow-cup-sim-v1、gsl-double-sim-v1；数据fixture/规则adapter/测试使用同一标识，展示别名不改变ID。
