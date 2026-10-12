# Design

## Context
See proposal.md。当前structure.js严格限定stage的order/capacity/formatIntent/groups，新增字段不能直接塞入v1；runtime.js只有单败与单循环，单败每次生成下一轮直到冠军；progression.js依赖已结束来源并创建目标阶段。forms.tsx逐组添加空capacity；pages.tsx的useBlocker按pathname改变阻断配置内切页；graph.tsx只生成阶段/组卡片，并只检查目标端冲突。现有SQLite聚合、精确权限与幂等可复用。当前所有业务修改均未提交，保留前轮成果，不覆盖历史验收。

## Goals / Non-Goals
**Goals:** 一个版本化规则模型同时驱动参数表单、生成图、运行和展示；稳定引用使未来比赛可排时间；六模块可分片验收；不把规则标签等同运行支持。
**Non-Goals:** 自动排时求解器、团队成员报名、实时外部赛事抓取、比赛中改结构、确认后回滚、处罚/DQ引擎、生产部署。
D07原“时间排程后置”本次由用户范围扩为手动时间编排；自动排程仍后置。既有上下文的Q26按本变更dependency-wave-v1提出可审查规则，不追溯标为旧用户决定。

## Decisions
### 1. 新版模型与单一规则目录
structure-v2保存stage {id,name,order,groupCount,groupSize,qualifyCount,format,ruleVersion,parameters,groups}，capacity为派生；重复组实体有独立稳定ID与相同参数。routing-v2引用具名upper/lower/seed/slot入口和qualification/rank出口；保存未知字段仍拒绝。支持集由registry返回，不新增“标签即可开赛”分支。
新模块建议tournament-configuration/domain/formats/{registry,parameters,compile,validate}；operations/format-runners按ruleVersion分派。前端使用服务端规则目录/JSON schema与展示元数据，不再维护互相漂移的默认值。
选择v2而非扩展v1：旧快照digest与读取契约可保持。增加组保留旧ID；缩组先生成impact报告，再由明确确认事务应用，无自动断链。上限沿用64唯一参赛单位，多阶段重复计入不累计加人；N/L限制见parameters.md。

### 2. 结构编译与运行分离
compile(structure,rules)输出稳定比赛key、依赖DAG、确认批次、参赛来源表达式、晋级出口、条件GF2及轮次窗口。比赛key按configuration/group/role/round/index定义，与布局和显示名称无关。
静态淘汰/GSL/循环可画全部比赛；瑞士显示未来window，不伪造matchId或参赛者。配对确认后在window下产生真实match，历史key不复用。GF2为条件节点，未激活不算必须裁定比赛。
对阵来源用entrant、winner(matchKey)、loser(matchKey)、qualification(unitKey,channel,index)、pendingSwissRound表达。生成图不写真实比分；实际比赛与计划节点一致映射。
重复数量是生成实体的小参数，不仅循环渲染；拒绝前端独有quantity造成服务端实体数漂移。

### 3. 赛制选择与确定性
完整参数见parameters.md。单败Q>1返回资格集合；路由可按初始种子明确分配，不能捏造唯一竞技名次。GSL小图固定5场。双败L=N或N/2采用独立直接败者入口，并用显式feeder而非模糊“跳过首轮”套图。
标准LB每次drop用固定交叉表，平台选择不是唯一官方规则；先人工核验N4/8与3种L，再程序核验N16/32/64覆盖。direct-lower initialLosses=1但actualLosses=0，展示分别表达；一次实际败即淘汰。Q3输出UB1/LB2前沿，Q2输出UB1/LB1，Q1才GF。
瑞士在同积分/战绩候选图上做完整匹配；按字典序最小跨组代价、种子排序与冻结禁边求解，每次确认重算对手分。搜索工作移到事务前，携带inputVersion/hash；事务内重新检查版本/权限后应用，避免长计算锁库。确定性节点预算250000，达到预算返回PAIRING_SOLVER_LIMIT，不能当成不可满足证明。允许手工选择满足相同硬约束的完整配对并记录理由/输入hash；不提供静默放松按钮。Major官方if possible重赛策略仅由该规则版本冻结，不继承通用硬禁。
泛用瑞士同分采用平台BH或DS，使用精确整数比较。TI modified Swiss独立adapter/规则版本，不能硬编码成3胜3负后冒充TI。

### 4. 确认批次与混合入口
单败/循环/瑞士按组内轮；GSL三批次；双败按比赛依赖最大深度生成就绪wave，一人最多一场。波次表包含全部就绪必需比赛，整批裁定齐备后管理员确认；时间段不修改wave。
审批名单新增明确entryRef（stage/group/upper|lower/seed），支持后续阶段直邀与晋级混合。开赛验证整个冻结赛事64内唯一名单，后续阶段必须等所有路由来源就绪再合并直邀席位，不能因已有8直邀就提前开16人阶段。科隆S2/S3映射是本变化必要案例。
继承现有write的当前权限重检、expectedVersion、actor/key/fingerprint及SQLite事务；确认应用比赛、排名、路由与请求记录一起提交。旧锁定结果不改；异常输入不自动补胜者。
处罚/DQ运行仍不可用；若来源exitState存在，路由保留，不因退出拒入；淘汰双退出冲突仍阻塞，不能声称已实现自动处罚。

### 5. 草稿与画布
配置级editor session托管结构及布局草稿，子路由切页复用；useBlocker判断tid/cid改变而不是pathname不同。规范化字段值计算dirty，恢复原值可清除；网络重读不卸载表单。beforeunload只在真实修改时。
浏览缩放/折叠属于view state；显式移动/对齐/保存布局属于layout draft。保存后离开先等待保存成功；冻结要求当前结构已保存并复验。409给局部字段对比，明确选择本地/远端，不自动覆盖。
stage总览按拓扑层从左到右，group稳定顺序从上到下；子图按格式布局：单败轮列/分段树、双败UB/LB分区、GSL三列、循环矩阵、瑞士轮列与战绩带。确定性排序采用稳定对象顺序，依赖端口/路由名额一致。无需新增通用Comfy节点引擎；React/SVG先复用，若64人图性能不达标才评估布局库并记决策。
连线前检查来源名额消费、目标席位、身份闭包/池引用、容量/环；服务器同规则复验；所有位冲突要求明确替换而非最后写覆盖。允许胜败两个端口各一次。

### 6. 手动时间计划与展示
单独schedule_aggregates表（赛事外键，version/data/request cache），避免每次排时间与赛果竞争相同版本。计划{windows,resources,assignments}绑定configuration snapshot digest/planKey。GET赛事schedule用于公开合法投影，PUT带expectedVersion/幂等；编辑复用structure.edit（时间为结构编排能力），启动/确认仍rounds.confirm。
时间存UTC即时值并带固定offset展示、durationMinutes>0、minRestMinutes≥0；只允许http(s)直播URL。资源ID稳定、赛事内唯一；window可引用未知瑞士轮，assignment具体比赛另处理。
检查：确定参与者/可能来源集合交集、比赛台、前置预计结束+休息、实际状态。明确冲突拒绝，未知配对窗口标needs-roster-validation（不可宣布无冲突）；真实配对生成后重新校验，若冲突标阻塞且不自动移动时间。已开始比赛不可修改计划；允许通过results.edit显式标记actualStartedAt，首个选手提交结果也自动表示已开始；来源记录不用预计开始时间擅自等同实际开赛。
冻结后允许改变未来时间，不改变structure digest，保留旧assignments审计。注销清理自身赛事时间表；他人赛事脱敏引用沿用操作聚合隐私原则。
展示提供赛制图/按轮/时间段三视图，移动端按组折叠并在窗口下列并行比赛，不强迫横向拖动画布。日期筛选、时区标识、台/组过滤、待安排列表；结果页与时间页使用同一公开projection。

### 7. 参考数据与验收
来源矩阵见research.md，验收步骤见acceptance-plan.md。fixture有entrantKind=reference-unit仅隔离演示；战队名为参赛单位标签，不接管真实团队账号。用户启动样例需显式创建独立演示赛事；测试永远临时SQLite。
真实复现分三项分别报告：规则符合、历史结果/排名一致、官方手工配对覆盖；历史调整用override+reason记录，不以篡改算法匹配历史。科隆冻结当时rulebook commit而不是未来main；TI精确模板在source证据完整前不标支持。
不选择“先截图再补算法”，参数、图、运行、时间一致性才计切片完成。

## Risks / Trade-offs
[跨版本规格尚未同步] → 不自动归档旧change；实施前读取其delta与当前源，对照迁移测试。
[双败直接输入不是统一标准] → 平台单独规则版本、三类feeder独立期望与无环/身份校验。
[瑞士匹配复杂度] → 节点预算及明确solver-limit、确定性和可审计人工完整配对。
[官方网页冲突/改版] → 原始版本/哈希，无法核实任务保持pending。
[未来占位隐藏时间冲突] → 可能参与者集合/窗口标记，真实配对后重新核验。
[默认限制影响旧6人赛] → 历史v1保持、v2默认齐满，未齐名单留在v1，不强制升级。
[手动时间修改被误解回滚] → 独立版本，只修改尚未开始比赛；锁定比分永久保留。

## Migration Plan
实施前备份已有SQLite但不自动生产部署。新增v2解析与registry，v1路径不动；新增时间表migration无数据破坏。显式复制升级保留来源、ID映射与原配置；新增字段不落入旧snapshot。先通过旧回归、复制/重启/事务失败，再逐赛制开放能力。回退关闭v2能力，保留新表与v2数据为只读，不删除或转换旧比分。
新版本结构和全部规则必须在开赛时冻结到runtime，开赛后禁止修改format参数；time plan独立。
