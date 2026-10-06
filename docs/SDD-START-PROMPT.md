# 新对话接续 SDD 的提示词

将下面文本复制到位于 D:\Projects\RaceAdministration 的新对话：

```text
请使用 vibe-workflow 接续赛事管理平台的 SDD 工作流，优先核查活动变更 improve-account-input-and-game-presets，不重复实施已归档变更。

项目 D:\Projects\RaceAdministration。先核查实际 Git 分支、未提交修改与 OpenSpec 活动变更；保留现有修改，不重新初始化、清理或自动提交/推送/部署。
亲自读取适用AGENTS.md、docs/PRD.md、docs/SDD.md、docs/handoff.md、docs/FORMAT-RESEARCH.md、openspec/config.yaml，再读取本轮所用技能。
先读 .sdd/notion/config.json、mapping.json 和 docs/notion-sdd-map.md，使用 notion-openspec-sdd-sync 打开实际工作台并完整读取新 T0；阶段出口准备 T1、写前 T2，发现相关并发变化先展示三方差异定稿。不要用历史快照覆盖 Notion，也不要将 Notion Done 自动勾成 OpenSpec 完成。

读取Git确认当前HEAD与远端分支，提交前基线为e09ed528。活动change improve-account-input-and-game-presets实施18/26；7.3–7.5已按2026-10-07新要求重核，账户先只读总览再按需弹窗、风格统一工作台，注销仅删除当前拥有赛事，创建默认归本人。78后端/60前端/30Edge、build/typecheck、严格校验和实际LAN360验证通过；见acceptance-account-overview.md与最新tasks/handoff。Notion18/26已完整回读，截图/源代码/文档证据与配置映射纳入本轮提交，本地原始同步快照/浏览器临时输出不提交。用户已授权将本轮成果commit并push到当前chore/openspec-restart；执行结果查看Git日志与远端，后续新提交/部署仍按后续授权。下一项5.1素材台账，再5.2–5.5及6.1–6.3整变更出口。原版/WB通用和死灵/吸血鬼/梦魇并列已确认，不重复询问。

历史首个change plan-tournament-structure 已完成22/22任务、26业务测试通过，正式规格已同步并归档：
openspec/changes/archive/2026-10-04-plan-tournament-structure。
读取其handoff.md与acceptance.md确认已完成边界和证据。它仅实现个人结构草稿、模板、静态校验、来源/池只读预演和冻结；runtimeReady=false，当时没有真实配对、报分/确认推进、网页或生产认证/持久化。后续deliver-platform-frontend已补全网页与本地认证/持久化、43/43任务及42/25/8测试并归档；当前仍无真实比赛运行。真实业务接受未确认。

若当前没有另一个明确活动change，先与我收敛下一切片及相关未决项，再按实际OpenSpec技能规划，不替我默认选择整个产品范围。
保留整轮收齐→主办方确认→锁定→推进、退出继续配对且跨阶段延续、淘汰双方判负禁用等决定。Q14/Q21/Q22-A/Q24-C/Q25/Q26/Q27、Major具体版本和组队仍在相关切片前解决；淘汰双退出冲突不得擅自解决。

子代理仅探索/检索/核验，fork_turns="none"，不传角色，单轮不复用；派发后立即等待，未终态不推进或修改其范围。奠基文档与即将修改的代码由主代理亲读。
按技能阶段出口推进；核心行为逐次观察红→绿，切片评审时必要重构并回归。测试通过不等于真实业务接受；同步规格、归档与提交/推送分别记录。
```
