# SDD 规划交接

更新时间：2026-10-03；目的：新对话接续需求与规划，不启动业务实现。

## 阅读顺序

亲读 PRD.md、SDD.md、本文、FORMAT-RESEARCH.md、../openspec/config.yaml。
[可复制提示词](SDD-START-PROMPT.md)。

## 实际状态

- 仓库：D:\Projects\RaceAdministration。
- 分支：chore/openspec-restart；HEAD：9e7863bbb2e086f303e353977204696eea0f52f2。
- 未提交：旧.spec-workflow和教学文件删除，README/.gitignore调整，OpenSpec配置/生成技能、PRD/流程/研究/交接文档新增或修改。
- .git/info/exclude本机规则已设置；正式文档和OpenSpec生成技能未被忽略。
- OpenSpec 1.13.2，spec-driven，Codex core；没有业务change、正式spec或tasks。
- 后端仅旧Express内存CRUD，没有本次业务实现，也没有有效业务测试证据。
- Notion工作台： https://app.notion.com/p/3edac01a7f2781c1a3b2d991dc2268de?pvs=204 。
- Notion当前人工同步，不是自动服务。没有提交、推送、部署。

## 已完成

清理旧流程/教学资料、分支创建、忽略规则、OpenSpec接入、Notion页面。
PRD由逐轮追加整理成完整产品文档，保留D01-D19与Q编号；未决项没有擅自作答。
FORMAT-RESEARCH.md只是初始官方来源和版本限制，不是深度调研完成。

## 最新关键规则

淘汰/瑞士整轮收齐→主办方确认→锁定→推进。
双败结果常驻于循环/瑞士，开关只限制选手提交；淘汰赛禁用双方判负。
退出者继续配对且自动失败，跨阶段状态延续；不可自动禁止进入后续阶段。
淘汰赛两退出者相遇仍有冲突。处罚撤销和自动结果不可修改的时间边界仍需明确。

## 下一步

1. 核查现场分支、未提交状态和OpenSpec根，不重复清理。
2. 读取PRD第10节，仅澄清首个change的范围和相关规则。
3. 补齐赛制参数/算法/边界矩阵；事实由代理调研，取舍由用户决定。
4. 范围明确后用openspec-propose创建正式规划，按CLIinstructions生成产物。
5. 结构与业务一致性校验，展示规划；本轮规划出口不实施。

主要决策：Q7首版赛制、Q8组队范围、Q19分配时机；技术栈在设计阶段评估。
所有未决项见PRD，不要求先全部解决才调研/规划，但不能把受影响实现标为就绪。

## 核验入口与限制

已实际执行过：git diff --check；openspec list --json；openspec list --specs --json；openspec doctor --json。
doctor正常仅说明根/关系健康；changes/specs为空，不代表业务规格通过。
业务测试未执行；不得宣称完整赛事或算法已验证。

Windows默认exec曾多次报helper_unknown_error: setup refresh had errors；apply_patch曾报工作路径包含reparse point。
受审批的PowerShell命令可读取/写入本项目。只读操作可重试，写操作先核查状态，不重复执行。
.git引用与exclude需要受审批写入。没有自动审批拒绝或用户审批待办。
中文文件使用明确UTF-8写入并核验。

## 子代理规则（用户要求的接续摘要）

只做探索/检索/核验；主代理负责代码、方案和最终验证。
fork_turns必须为none，省略角色等可选项，单轮不复用；最多10个并行。
派发后立即等待，影响任务的子代理未结束时不推进其他工作/不修改范围内文件。
只有终态算结束，过程MESSAGE不是终态。
奠基文档和将修改的代码必须主代理亲读；重探索可分解并行，核验按关键出处点验。

## 2026-10-04 接续记录

已由主代理完整读取五份启动文档、openspec/config.yaml、vibe-workflow与项目openspec-propose技能。
现场核验：分支chore/openspec-restart，HEAD 9e7863b；OpenSpec 1.13.2；list/context解析本仓库根，changes/specs为空，doctor healthy=true。
既有未提交清理及文档修改保留；无业务代码、提交或推送。
docs/FORMAT-RESEARCH.md更新至0.2：五类赛制与多阶段路由的参数、候选算法、失败边界及人工独立算例；这些不是已运行测试。
关键限制：BLAST在线规则没有明确年份，Austin PDF未完整取得；Major具体版本仍未冻结。不要混用网页与Austin摘要。已纠正16队瑞士首轮应8胜8负的算例笔误，未采纳证据不足的DAG防重赛/FIDE循环赛Buchholz禁用推论。
Notion工作台已追加2026-10-04进展摘要。

待答的两个聚焦问题（尚无答案，推荐不是决定）：
1. 首个change：赛事结构与配置校验（推荐），还是完整单败运行切片/其他范围？
2. 参赛单位与路由编辑：个人、开赛前预设并冻结（推荐），还是组队/阶段结束后可人工调整？
不重新采访已确认决定；若选结构切片，其他报分/判罚未决留后续。若选运行切片，再澄清受影响的Q14/Q22-A/Q24-C/Q25等。
尚未创建proposal/specs/design/tasks，也未执行change结构校验或规划出口一致性检查。范围答复后按CLI instructions创建产物，再结构校验和PRD→场景→任务→验证核对。
本轮已有git diff --check退出0（仅既有LF/CRLF提示）；新调研文件未跟踪，另做严格UTF-8/空白核验。无业务测试运行证据。