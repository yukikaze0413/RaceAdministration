# SDD 工作流程

## 文档职责

- docs/PRD.md：产品范围、已确认决定、未决项。
- openspec/config.yaml：上下文与产物规则。
- openspec/changes/<change>/：proposal、specs、design、tasks。
- openspec/specs/：实施并同步后的正式规格。
- Notion：讨论入口、决定摘要、证据链接。实施任务以 change 内 tasks.md 为准。

Notion 当前按需人工同步，尚无自动或双向同步。

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
全平台技术栈尚未重新确认；本切片已配置原生node:test业务脚本。

## Git 规则

.gitignore 保存共享规则：依赖、秘密、缓存、构建、日志、测试输出。
.git/info/exclude 保存机器本地规则：个人工作目录、临时材料、旧教学路径。
PRD、OpenSpec 配置/规格/change/生成技能和可复现样例纳入 Git。
个人同步配置放 .local/，禁止将 Notion token 保存到版本库。

## Notion 工作台

[赛事管理系统｜SDD 工作台](https://app.notion.com/p/3edac01a7f2781c1a3b2d991dc2268de?pvs=204)

位于已有“赛事管理系统”条目下，沿用当前已连接工作空间。

## 本轮清理

工作分支：chore/openspec-restart，基线提交：9e7863b。
移除旧 .spec-workflow、docs/CURRICULUM.md、docs/LEARNING.md 和 docs/LESSON_*。
保留 backend 和旧 API 文档作为原型参考。
旧文件由基线 Git 提交保留，可用 git show 查看原文。

## 当前实施出口（2026-10-04）

三项正式规格已同步 openspec/specs/；活动change为空。验收与证据见归档目录 acceptance.md / evidence/。本切片 runtimeReady=false；真实用户接受未确认。后续业务切片需另行收敛与规划。
