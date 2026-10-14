# Proposal

## Why
现有画布展示正式赛制编译结果，不能自由组合 Match、集合处理和子图。需要隔离测试入口验证新的规划接口，以及保存草稿、验证保存版本、占位赛程预览的完整链路。

## What Changes
- 新增独立的版本化组件图、席位/集合/映射/位置模板类型，以及原子连接和撤销重做。
- 支持 Match、Swiss、Pool、展开器、选择器、无输入种子生成器、嵌套子图与预设。
- 提供隔离草稿存储、保存版本验证与稳定 key 的占位预览；不写实际比分或统计。
- 新增独立测试界面，具备属性、连线表单、导航、真实端口锚点、诊断及样例。
- C1～C7 已于 2026-10-13 由用户确认；源需求见 docs/PRD-canvas-rebuild.md。正式工作台集成及真实运行后置。

## Capabilities
### New Capabilities
- `planning-canvas`: 独立组件图、编辑、持久化、验证及赛程预览。
### Modified Capabilities
无；旧结构和工作台契约不改写。

## Impact
新增 backend/src/planning-canvas、平台独立路由/存储及 frontend/src/features/planning-canvas；使用已有 React/SVG、认证、SQLite 和版本化赛制编译能力，不新增依赖。测试仅临时数据库，保留其他活动 change。
