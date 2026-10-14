# 画布项目删除与 Stage 操作计划

> 执行方式：主代理按任务修改代码；子代理仅探索和核验。

**目标：** 项目可删除；Stage 与 Subgraph 共用左侧操作区，支持快捷键、选择和属性编辑。

**架构：** 保留 Stage 数据模型和图编辑接口。阶段选择独立于组件多选。项目删除复用权限、版本和请求键检查。

**技术：** React、TypeScript、Express、SQLite、Vitest、Node test、Playwright。

**需求来源：** 本轮用户的 3 项要求。

## 约束

- Stage 成员沿用比赛和瑞士轮；选择子图时纳入内部赛程。
- 删除 Stage 或移除成员必须保留组件和连线。
- 图编辑保留撤销、重做、显式保存和成员转移确认。
- 项目删除必须显示名称及不可恢复后果。
- 快捷键不得在输入框内触发。

## 任务 1：项目删除

文件：`backend/src/planning-canvas/http.js`、`frontend/src/features/planning-canvas/index.tsx`。

接口：`DELETE /planning-canvases/:id`，请求体含 `expectedVersion`，使用 `Idempotency-Key`。返回 `{id, deleted: true}`。

- [x] 增加测试，覆盖权限、版本冲突、请求重放、排期级联删除。
- [x] 确认删除接口测试因接口缺失而失败。
- [x] 增加事务删除、确认框和删除后列表刷新。
- [x] 删除当前项目后进入空白项目；删除其他项目保留当前草稿。

## 任务 2：Stage 属性与选择

文件：`stages.tsx`、`view.tsx`、`index.tsx`、`style.css`、`backend/src/planning-canvas/graph.js`。

接口：沿用 `updateStage`、`reorderStages`、`deleteStage`。`updateStage.selected=[]` 支持清空成员。

- [x] 增加测试，覆盖标题选中、移除最后成员、名称和顺序编辑、仅删除分组。
- [x] 确认缺失行为导致测试失败。
- [x] 新增阶段属性组件；显示成员名称、类型及增删入口。
- [x] 阶段标题和左侧阶段列表支持选择及选中样式。

## 任务 3：入口、快捷键与验收

- [x] 创建入口移到 Subgraph 下方，提供 `Ctrl/⌘+Shift+G`。
- [x] 输入框内不触发快捷键；选中阶段时 Delete 仅删除阶段。
- [x] 浏览器验证创建、选择、属性编辑、成员增删和项目删除。
- [x] 运行前后端测试、类型检查、构建和画布浏览器测试。
- [x] 更新操作说明和交接记录，记录实际验证结果。

## 核验重点

- 删除请求重试不能因项目已删除而失败。
- 切换项目或撤销后不能保留失效阶段选择。
- 空阶段仍能通过左侧列表选中和删除。
- 标题可点击且不阻挡组件拖拽、连线及框选。
- 版本冲突或网络失败保留本地草稿和原删除请求。

## 验证记录

2026-10-15：

- 后端 `npm test`：361/361 通过。
- 前端 `npm test`：96/96 通过。
- 前端 `npm run build`：类型检查和构建通过。
- 画布浏览器测试：24/24 通过，覆盖 360、768、1440 像素宽度。
- 删除响应丢失后用原请求重试，最终进入空白项目。
- 独立代码核验未发现可证实的功能问题。
- 界面截图：`output/playwright/canvas-stage-properties-1440.png`。

构建仍提示超过 500 kB 的输出包。
