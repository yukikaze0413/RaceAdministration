# Notion 与 OpenSpec 映射

核验日期：2026-10-05。范围：赛事管理系统完整 SDD 登记与当前反馈待办。

- [项目工作台](https://app.notion.com/p/3efac01a7f2781aa8d53e8d3401115a6)
- [主项目 / 当前规划正文](https://app.notion.com/p/3f0ac01a7f27818e93fbd1f14def2177?pvs=204)
- [旧摘要入口](https://app.notion.com/p/3edac01a7f2781c1a3b2d991dc2268de)，已添加新工作台入口，下方原记录保留为历史。

配置：`.sdd/notion/config.json`，已启用 `phase-boundary`、同步技能与启动面板。由 agent 在 SDD 阶段边界读取、比较、写回；没有后台同步服务。配置开关不代替外部操作授权或并发冲突定稿。

机器可读映射：`.sdd/notion/mapping.json`。它使用真实回读 ID；不按标题猜测，不保存凭证。运行快照：`.sdd/notion/runs/20261005-notion-bind/`，默认不纳入 Git。

## 数据源与归属

| 库 | 副本 data source ID |
|---|---|
| projects | `73fac01a-7f27-8337-869c-8786a7a0d4fb` |
| iterations | `104ac01a-7f27-82f7-9659-870894b70bec` |
| workItems | `6e6ac01a-7f27-83b8-a6ad-072cbbd7ff0b` |
| modules | `fecac01a-7f27-82da-a391-877e9630421e` |

主项目 ID：`3f0ac01a-7f27-818e-93fb-d1f14def2177`；父项目为空；无子项目。当前21工作项和四个增量模块均归属此项目；无实际 Sprint，迭代库为空。全部视图及关系已核对为副本 ID。

## change 登记

| change | 阶段 | 完成证据 |
|---|---|---|
| improve-account-input-and-game-presets | OpenSpec 规划，实施 0/21 | planning-validation.json；本轮 strict validate 通过 |
| plan-tournament-structure | 已归档，22/22 | 归档 acceptance.md、handoff.md、evidence/；26 领域测试 |
| deliver-platform-frontend | 已归档，43/43 | 归档 acceptance.md、evidence/；42 后端、25 前端、8 Edge、build/typecheck |

历史 change 在 Notion 主项目正文登记，保留本地归档路径和证据；未重复创建历史任务为当前待办。历史测试不是当前改进的新验收。真实用户业务接受未确认；runtimeReady=false、started=false，未推送或部署。

## 当前任务 ID

| Task | Notion ID | 场景 |
|---|---|---|
| 1.1 | [3f0ac01a-7f27-811e-b1ef-f672171e7bae](https://app.notion.com/p/3f0ac01a7f27811eb1eff672171e7bae) | 综合研究或出口任务，无单一场景；任务已映射 |
| 1.2 | [3f0ac01a-7f27-8112-9a32-fd8529eaf784](https://app.notion.com/p/3f0ac01a7f2781129a32fd8529eaf784) | 综合研究或出口任务，无单一场景；任务已映射 |
| 2.1 | [3f0ac01a-7f27-8170-90e6-eb9fcb7fb3ee](https://app.notion.com/p/3f0ac01a7f27817090e6eb9fcb7fb3ee) | account-session / 短密码与长密码 |
| 2.2 | [3f0ac01a-7f27-815e-8cf9-f0876a4634a1](https://app.notion.com/p/3f0ac01a7f27815e8cf9f0876a4634a1) | account-session / 空值与资源上限 |
| 2.3 | [3f0ac01a-7f27-81d4-8750-d05e7cec3078](https://app.notion.com/p/3f0ac01a7f2781d48750d05e7cec3078) | account-session / 短密码与长密码 |
| 3.1 | [3f0ac01a-7f27-8195-8ca9-ef912a7ce9d8](https://app.notion.com/p/3f0ac01a7f2781958ca9ef912a7ce9d8) | friendly-datetime-input / 浏览器时区不同 |
| 3.2 | [3f0ac01a-7f27-8119-bba5-e787907f8167](https://app.notion.com/p/3f0ac01a7f278119bba5e787907f8167) | friendly-datetime-input / 非法日期与冲突 |
| 3.3 | [3f0ac01a-7f27-811a-aa77-d5fe1f30e775](https://app.notion.com/p/3f0ac01a7f27811aaa77d5fe1f30e775) | friendly-datetime-input / 移动端与键盘 |
| 3.4 | [3f0ac01a-7f27-811e-93a9-c5ee0d0a32a9](https://app.notion.com/p/3f0ac01a7f27811e93a9c5ee0d0a32a9) | friendly-datetime-input / 选择与编辑 |
| 4.1 | [3f0ac01a-7f27-8125-b5d0-d6ccb9590535](https://app.notion.com/p/3f0ac01a7f278125b5d0d6ccb9590535) | game-presets / 统一影之诗与职业并列 |
| 4.2 | [3f0ac01a-7f27-813d-b5ae-d0182ecd94d3](https://app.notion.com/p/3f0ac01a7f27813db5aed0182ecd94d3) | tournament-catalog / 游戏预设创建与旧赛事 |
| 4.3 | [3f0ac01a-7f27-8181-a0f1-dcc5f3dc92d3](https://app.notion.com/p/3f0ac01a7f278181a0f1dcc5f3dc92d3) | tournament-catalog / 按游戏筛选 |
| 4.4 | [3f0ac01a-7f27-8190-8ea3-c294ebfbc5f1](https://app.notion.com/p/3f0ac01a7f2781908ea3c294ebfbc5f1) | tournament-catalog / 游戏预设创建与旧赛事 |
| 5.1 | [3f0ac01a-7f27-8197-9e3a-d4a6fb331285](https://app.notion.com/p/3f0ac01a7f2781979e3ad4a6fb331285) | game-presets / 查看样例素材 |
| 5.2 | [3f0ac01a-7f27-811a-8a58-e2a472b1c503](https://app.notion.com/p/3f0ac01a7f27811a8a58e2a472b1c503) | game-presets / 尚未取得立绘 |
| 5.3 | [3f0ac01a-7f27-8127-b11e-fabae91965c4](https://app.notion.com/p/3f0ac01a7f278127b11efabae91965c4) | game-presets / 跨来源卡片ID不冲突 |
| 5.4 | [3f0ac01a-7f27-81de-b413-fa4785d9810a](https://app.notion.com/p/3f0ac01a7f2781deb413fa4785d9810a) | game-presets / 图像失败 |
| 5.5 | [3f0ac01a-7f27-8194-888b-ffab8bd8fbe7](https://app.notion.com/p/3f0ac01a7f278194888bffab8bd8fbe7) | game-presets / 查看样例素材 |
| 6.1 | [3f0ac01a-7f27-8100-8372-cfc502056f86](https://app.notion.com/p/3f0ac01a7f2781008372cfc502056f86) | 综合研究或出口任务，无单一场景；任务已映射 |
| 6.2 | [3f0ac01a-7f27-81bb-8f61-ca8bbb7d0ba2](https://app.notion.com/p/3f0ac01a7f2781bb8f61ca8bbb7d0ba2) | 综合研究或出口任务，无单一场景；任务已映射 |
| 6.3 | [3f0ac01a-7f27-81ca-95f6-ee0f6a370576](https://app.notion.com/p/3f0ac01a7f2781ca95f6ee0f6a370576) | 综合研究或出口任务，无单一场景；任务已映射 |

所有工作项仍为 Backlog；Owner、优先级、Sprint、Points、实际开始与完成日尚未分配，不据创建记录推进实施。

## 增量模块

- account-session：[3f0ac01a-7f27-8125-916d-d04fffb8113c](https://app.notion.com/p/3f0ac01a7f278125916dd04fffb8113c)；关联 tasks 1.1, 2.1, 2.2, 2.3。
- friendly-datetime-input：[3f0ac01a-7f27-8119-998b-f5e68c1d826c](https://app.notion.com/p/3f0ac01a7f278119998bf5e68c1d826c)；关联 tasks 1.2, 3.1, 3.2, 3.3, 3.4。
- tournament-catalog：[3f0ac01a-7f27-813f-8670-c8487ad57a20](https://app.notion.com/p/3f0ac01a7f27813f8670c8487ad57a20)；关联 tasks 4.2, 4.3, 4.4。
- game-presets：[3f0ac01a-7f27-8141-aeb0-eae5df14a08d](https://app.notion.com/p/3f0ac01a7f278141aeb0eae5df14a08d)；关联 tasks 4.1, 5.1, 5.2, 5.3, 5.4, 5.5。

模块统计本轮反馈增量，Not Started、0%，不表示既有账号/目录能力不存在。模块为 capability 汇总，无强制一对一任务。综合集成/出口任务6.1–6.3归属主项目。

## 同步与续做

1. 续做先读配置和本映射，按技能打开工作台；重新发现四库完整范围及正文，保存新的 T0 和本地文件哈希，不用历史快照代替实时读取。
2. 阶段出口准备 T1；写前重读同一范围保存 T2。任何 Notion 变化都展示 B/N/L 三方差异，由用户定稿；本地哈希变化则重审候选。
3. 最小写入，逐项回读；部分失败保留真实成功/失败，不撤销他人修改，也不标一致。
4. Done / OpenSpec 勾选须由实现、测试、评审和验收证据支持；Notion 声明本身不是证据。规格同步、归档、提交/推送、部署与用户接受分别记录。
5. 快照只是审计证据；不得据其自动反向覆盖 Notion。

本次 T0/T2 范围一致，未发生真实并发冲突，三方合并未实测。21条任务的任务编号、原始验收标准、归属及正文均回读；Notion 自动将本地 .md 文件名识别为网址的内容已改为代码格式。正式规格八项及活动 change 严格校验通过；未运行新增业务测试、未改变任何实施勾选。


## 2026-10-05实施阶段同步（5/21）

上方Backlog/0%为首次建档历史。当前主项目阶段实施，1.1、1.2、2.1–2.3五项Done，实际开始/完成日2026-10-05；其余16项Backlog。账号模块4/4（100%，Done），日期模块1/5（20%，In Progress），其他模块仍0%。无Sprint、估点或负责人分配。

完成范围和真实53/27/13回归见acceptance-password.md。四库完整集合及26页写前回读没有外部变化；成功输出及本地哈希已核验后更新OpenSpec。审计目录.sdd/notion/runs/20261005-password-slice/。行查询额度耗尽时使用无筛选视图并遍历has_more=false完成集合核验；没有真实并发冲突，三方合并仍未实测。

## 2026-10-05日期切片阶段同步（9/21）

四条3.1–3.4工作项Done，日期模块完成度1；主项目实施9/21，第4–6组12项仍Backlog。使用现有稳定ID最小写入并逐页回读，完整范围无外部变化；审计见.sdd/notion/runs/20261005-datetime-slice/。并发合并未实测，最新验收见acceptance-datetime.md。

## 2026-10-06游戏目录切片阶段同步（13/21）

上方0/21建档表和5/21、9/21阶段内容均为历史。当前完成1.1、1.2、2.1–2.3、3.1–3.4、4.1–4.4，四条新增工作项Done、目录模块3/3（100%，Done）、游戏与素材模块1/6（约16.7%，In Progress），账号与日期模块均100%。第5–6组八项Backlog，主项目阶段实施。

完整四库/26页T0与候选T1后写前T2范围一致，无外部并发变化；行查询额度耗尽后用无筛选视图遍历到has_more=false。七页面最小写入、逐页回读及本地哈希核验成功，审计.sdd/notion/runs/20261006-game-slice/（baseline-full.json、candidate.json、prewrite-full.json、write-verification.json、readback-*）。文件路径自动链接已修正为代码格式。并发合并未实测。真实66/55/25回归、build/typecheck、严格校验及切片核验见acceptance-games.md / review-games.md。未提交/推送/部署，不提前同步正式规格或归档。

## 2026-10-06手机验收修订（15/23）

原13/21保留为历史工程证据。新任务7.1真实HTTP手机保存 → 3f1ac01a-7f27-81fd-a5fd-c9c7cd368f25；7.2修改密码与主动退出 → 3f1ac01a-7f27-81c9-a0af-caf76c9ffab5。主项目23工作项、15 Done、账号关联5/5；日期和目录任务重新核验并更新证据。完整四库/26既有页面T0、T1、T2无外部变化，新两页及六个既有页面逐页回读成功，审计.sdd/notion/runs/20261006-mobile-feedback/。永久删除含义待答。

远端主阶段记录70/57/26，后补“此刻”跨午夜组件第58项在本地验收和日志保存，未声称其已经远端写回。三方并发合并未实测；未提交/推送/生产部署或归档。
