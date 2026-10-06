# SDD 工作流程

## 文档职责

- docs/PRD.md：产品范围、已确认决定、未决项。
- openspec/config.yaml：上下文与产物规则。
- openspec/changes/<change>/：proposal、specs、design、tasks。
- openspec/specs/：实施并同步后的正式规格。
- Notion：讨论入口、决定摘要、证据链接。实施任务以 change 内 tasks.md 为准。

Notion 已按 notion-openspec-sdd-sync 接入阶段边界同步。任务开始保存 T0，阶段出口准备 T1、写前重读 T2；任何并发变化先三方定稿，逐项写入回读后保存下一基线。由 agent 调用，不是后台服务。

## 执行顺序

1. 确认切片业务规则，显式记录未决项。
2. 使用 CLI 生成技能创建 change，规格覆盖核心与失败场景。
3. 完成设计、任务、验证边界，核对 PRD → spec → tasks → 验证。
4. 结构校验并核对业务一致性；结构通过不等于业务验收。
5. 核心业务逐行为红→绿；切片评审时必要重构和回归。
6. 用模拟赛事验收，保存命令、结果、未验证限制。
7. 完成后同步规格并归档；提交、推送、业务接受分别记录。

初始化不代表需求批准。2026-10-04用户确认首个change为赛事结构与配置校验（个人、预设路由并开赛前冻结），正式规划位于openspec/changes/archive/2026-10-04-plan-tournament-structure；22/22任务已实施并归档，26测试通过。

## 当前环境

OpenSpec 1.13.2，spec-driven schema，Codex core profile，语言 zh-CN。
项目生成技能纳入 Git。backend 保留旧 Express 内存 CRUD 原型，并新增隔离的本地结构模块。
已交付React19/Vite中文前端、Express本地会话与Node SQLite持久化；后端node:test、前端Vitest与真实Edge Playwright。旧CRUD原型隔离保留。

## Git 规则

.gitignore 保存共享规则：依赖、秘密、缓存、构建、日志、测试输出。
.git/info/exclude 保存机器本地规则：个人工作目录、临时材料、旧教学路径。
PRD、OpenSpec 配置/规格/change/生成技能和可复现样例纳入 Git。
SDD 同步配置与稳定映射放 .sdd/notion/，可纳入 Git；runs/ 快照忽略。禁止保存 Notion token 或其他凭证。

## Notion 工作台

[SDD｜赛事管理系统｜项目工作台](https://app.notion.com/p/3efac01a7f2781aa8d53e8d3401115a6)

沿用已连接工作空间，独立副本四库/视图/关系已核对。旧摘要保留并链接新入口。详见 [稳定映射与核验记录](notion-sdd-map.md)。

## 本轮清理

工作分支：chore/openspec-restart，基线提交：9e7863b。
移除旧 .spec-workflow、docs/CURRICULUM.md、docs/LEARNING.md 和 docs/LESSON_*。
保留 backend 和旧 API 文档作为原型参考。
旧文件由基线 Git 提交保留，可用 git show 查看原文。

## 历史实施出口（2026-10-04）

三项正式规格已同步 openspec/specs/；活动change为空。验收与证据见归档目录 acceptance.md / evidence/。本切片 runtimeReady=false；真实用户接受未确认。后续业务切片需另行收敛与规划。

## 历史进度（2026-10-06）

plan-tournament-structure（22/22）与deliver-platform-frontend（43/43）已归档。活动变更improve-account-input-and-game-presets实施15/23（原1–4组重新核验，新增7.1/7.2）；密码、认证评估、日期和游戏目录兼容切片完成。最新70/58/26回归及build/typecheck通过，证据见acceptance-mobile-feedback.md；Notion主阶段15/23已回读，后补第58项组件证据仅本地。用户自己的手机复验和永久注销含义待澄清。下一项5.1素材文件与来源台账，第5–6组八项尚未完成，正式规格尚未同步/归档。入口见[任务](../openspec/changes/improve-account-input-and-game-presets/tasks.md)。

## 当前进度（2026-10-07）

活动变更18/26，账户资料总览/按需弹窗与当前所有权注销复核完成；78/60/30及build/typecheck、严格检查和实际LAN验证通过，Notion已回读一致。素材5.1–5.5及整变更出口6.1–6.3未完成，不提前同步正式规格/归档。用户已授权提交并推送当前分支；结果以Git为准。最新[验收记录](../openspec/changes/improve-account-input-and-game-presets/acceptance-account-overview.md)与[续接](../openspec/changes/improve-account-input-and-game-presets/handoff.md)。
