# 新对话接续 SDD 的提示词

将下面文本复制到位于 D:\Projects\RaceAdministration 的新对话：

```text
请使用 vibe-workflow 接续赛事管理平台的 SDD 工作流，先确认下一业务切片，不重复实施已完成变更。

项目 D:\Projects\RaceAdministration。先核查实际 Git 分支、未提交修改与 OpenSpec 活动变更；保留现有修改，不重新初始化、清理或自动提交/推送/部署。
亲自读取适用AGENTS.md、docs/PRD.md、docs/SDD.md、docs/handoff.md、docs/FORMAT-RESEARCH.md、openspec/config.yaml，再读取本轮所用技能。

首个change plan-tournament-structure 已完成22/22任务、26业务测试通过，正式规格已同步并归档：
openspec/changes/archive/2026-10-04-plan-tournament-structure。
读取其handoff.md与acceptance.md确认已完成边界和证据。它仅实现个人结构草稿、模板、静态校验、来源/池只读预演和冻结；runtimeReady=false，没有真实配对、报分/确认推进、网页或生产认证/持久化。真实业务接受未确认。

若当前没有另一个明确活动change，先与我收敛下一切片及相关未决项，再按实际OpenSpec技能规划，不替我默认选择整个产品范围。
保留整轮收齐→主办方确认→锁定→推进、退出继续配对且跨阶段延续、淘汰双方判负禁用等决定。Q14/Q21/Q22-A/Q24-C/Q25/Q26/Q27、Major具体版本和组队仍在相关切片前解决；淘汰双退出冲突不得擅自解决。

子代理仅探索/检索/核验，fork_turns="none"，不传角色，单轮不复用；派发后立即等待，未终态不推进或修改其范围。奠基文档与即将修改的代码由主代理亲读。
按技能阶段出口推进；核心行为逐次观察红→绿，切片评审时必要重构并回归。测试通过不等于真实业务接受；同步规格、归档与提交/推送分别记录。
```
