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

backend/ 保留原有 Express 内存 CRUD 原型，不代表新平台功能已实现。
前端、认证、持久化、报名、赛制和权限系统尚未实现。
[旧 API 示例](docs/API.md) 仅作参考；旧技术栈尚未重新确认。

旧流程、课程和学习笔记已移出当前工作树，可从 Git 历史恢复。
本轮没有自动提交、推送或安装业务依赖。

## 本地结构演示

在 backend 目录运行 npm test 与 npm run configuration:demo。validate/preview 命令、字段契约及手写预期见 [结构样例说明](backend/examples/tournament-configuration/README.md)。

支持个人草稿、模板、分层校验、路由预演与结构冻结；本切片未开赛，runtimeReady=false，未提供赛制配对、网页或生产认证/持久化。

## 全平台浏览器交付（2026-10-04）

中文前端和必要持久后端已接入；运行方式见 [frontend/README.md](frontend/README.md)，新接口与缺失业务错误边界见 [PLATFORM-API.md](docs/PLATFORM-API.md)。账号、系列/赛事资料与结构编辑/校验/模拟预演/冻结真实可用；报名、报分、赛制运行等未实现能力明确返回501。冻结不代表已开赛。

## 前端反馈SDD进度（2026-10-05）

上一轮交付已提交1db793a。取消密码长度、成熟认证评估、日期时间选择和游戏/素材预设已登记[新规划](openspec/changes/improve-account-input-and-game-presets/proposal.md)，实施0/21，尚未修改业务行为；查看[任务列表](openspec/changes/improve-account-input-and-game-presets/tasks.md)。
