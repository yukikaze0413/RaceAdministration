# 赛事管理系统

面向卡牌和格斗游戏的赛事管理平台，当前已实施赛事结构与配置校验的本地业务切片。

## 已确认方向

- 赛事系列包含独立赛事，每场赛事可组合多个比赛阶段。
- 注册用户可创建和参加赛事，个人中心区分两个入口。
- 选手和主办方可提交赛果；主办方可修改并手动确认推进。
- 优先生成正确对阵；自动排时间与已推进后的回滚改判后置。
- 使用模拟赛事和正常、边界、异常样例验收。

## 工作入口

- [产品需求草稿](docs/PRD.md)
- [SDD 流程](docs/SDD.md)
- [新对话启动提示词](docs/SDD-START-PROMPT.md)
- [规划交接](docs/handoff.md)
- [Notion 工作台](https://app.notion.com/p/3edac01a7f2781c1a3b2d991dc2268de?pvs=204)
- openspec/：正式规格唯一主流程；已初始化；首个规划为[赛事结构与配置校验](openspec/changes/archive/2026-10-04-plan-tournament-structure/proposal.md)，22/22任务已实施并归档，26测试通过；验收记录见归档目录。
- .agents/skills/：OpenSpec CLI 生成的项目技能。

## 当前代码

backend/ 隔离保留原有 Express 内存 CRUD 原型，同时已接入新平台账号、赛事资料、结构配置与SQLite持久化。
中文前端、本地认证、持久化和创建者权限已交付；个人报名、自定义收集表、实际单败/循环运行、协作者权限与整轮推进已交付。
[旧 API 示例](docs/API.md) 仅作参考；旧技术栈尚未重新确认。

旧流程、课程和学习笔记已移出当前工作树，可从 Git 历史恢复。
本轮没有自动提交、推送或安装业务依赖。

## 本地结构演示

在 backend 目录运行 npm test 与 npm run configuration:demo。validate/preview 命令、字段契约及手写预期见 [结构样例说明](backend/examples/tournament-configuration/README.md)。

支持个人草稿、模板、分层校验、路由预演与结构冻结；本切片未开赛，runtimeReady=false，未提供赛制配对、网页或生产认证/持久化。

## 全平台浏览器交付（2026-10-04）

中文前端和必要持久后端已接入；运行方式见 [frontend/README.md](frontend/README.md)，新接口与缺失业务错误边界见 [PLATFORM-API.md](docs/PLATFORM-API.md)。账号、系列/赛事资料与结构编辑/校验/模拟预演/冻结真实可用；报名、报分、赛制运行等未实现能力明确返回501。冻结不代表已开赛。

## 前端反馈SDD进度（2026-10-07）

活动[变更](openspec/changes/improve-account-input-and-game-presets/proposal.md)实施18/26：密码、分类→游戏、日期/时区与HTTP保存已修复；账户页统一工作台风格，先展示资料再按需编辑，头像/名称/用户名可修改、ID固定。注销仅删除当前拥有的赛事及关联数据，创建默认归本人。78后端/60前端/30Edge及build/typecheck通过。素材五项和完整出口三项仍未完成；见[任务](openspec/changes/improve-account-input-and-game-presets/tasks.md)与[最新账户验收](openspec/changes/improve-account-input-and-game-presets/acceptance-account-overview.md)。

## 赛事工作台（2026-10-07）

赛事管理新增卡片连线、可运行预设、报名与名单、协作者、对阵/赛果和整轮推进。历史结构演示的未开赛说明仅描述旧切片。当前能力与操作见[赛事操作说明](docs/TOURNAMENT-OPERATIONS-API.md)，工程验收95后端/60前端/41Edge见[验收记录](openspec/changes/implement-tournament-workbench/acceptance.md)。本地构建预览 http://127.0.0.1:5000 。新变更12/12完成，业务接受、正式规格同步与归档尚未进行。
