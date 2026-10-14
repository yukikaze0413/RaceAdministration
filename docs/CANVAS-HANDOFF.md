# 画布交接记录

记录日期：2026-10-14。
当前代码使用 stage、wave 和 session。
用户最新修正尚未实施。

## 下一次聊天先处理

1. 说明 stage 1 的增删改查入口。
   当前入口是右侧“Stage · 阶段”面板。
   支持创建、改名、加入成员、排序和删除。
   当前面板没有单独移除成员的按钮。
   需要核对成员查询和移除的使用方式。
2. 把 wave 编号改为整个画布统一编号。
   用户要求只有 wave 1、wave 2，不分主次。
   当前代码仍按各图分别编号，尚未修正。
   先核对这次修正是否涉及跨图合并。
   原规则禁止同一 wave 跨图或跨 stage。
3. 列出当前瑞士轮各参数的作用。
   核对属性面板、规则注册表和验证逻辑。
   区分实际作用与动态配对占位。

## 当前功能

- canvas-v2 使用 stage、wave 和 session。
- stage 采用全画布严格顺序。
- 验证自动分配 wave，并保存完整 WavePlan。
- session 在赛程预览中编辑和独立保存。
- 瑞士轮每轮映射到一个 wave。
- 瑞士轮实际配对仍是动态占位。
- 旧草稿迁移先生成候选，再由用户应用。
- 迁移后需要保存并验证。

“迁移新机制”在左侧“组件”栏顶部。
该按钮仅在 canvas-v1 草稿中显示。
新项目和当前样例使用 canvas-v2。

## 主要文件

- 操作说明：`docs/PLANNING-CANVAS.md`。
- 设计计划：`docs/plans/2026-10-14-wave-batch-optimization-plan.md`。
- 新机制规格：`openspec/changes/refactor-planning-canvas-wave-scheduling/`。
- 原画布规格：`openspec/changes/rebuild-tournament-planning-canvas/`。
- wave 分配：`backend/src/planning-canvas/waves.js`。
- 分析单位：`backend/src/planning-canvas/analysis.js`。
- 图操作：`backend/src/planning-canvas/graph.js`。
- 排期保存：`backend/src/planning-canvas/http.js`。
- 阶段面板：`frontend/src/features/planning-canvas/stages.tsx`。
- 瑞士轮属性：`frontend/src/features/planning-canvas/properties.tsx`。
- session 编辑：`frontend/src/features/planning-canvas/session-editor.tsx`。

## 验证记录

本次提交前已有以下验证结果。
证据见新机制变更的 `acceptance.md`。

- 后端测试：358/358 通过。
- 前端测试：95/95 通过。
- 前端类型检查和构建通过。
- Edge 浏览器测试：22/22 通过。
- OpenSpec 严格校验通过。

新机制任务完成 9/9。
主规格已同步，变更尚未归档。
归档时需处理已同步的 ADDED 条目。

## 预览与本地文件

本机入口：<http://127.0.0.1:5010/canvas-lab>。
校园入口：<http://10.82.238.254:5010/canvas-lab>。
校园 IP 可能随网络变化。
预览脚本：`scripts/canvas-lab-preview.js`。
预览数据库：`output/local-preview/canvas-lab.sqlite`。
WLAN 2 的临时规则只开放 TCP 5010。
远端来源范围为 LocalSubnet。

预览数据库、截图和临时日志不纳入本次提交。
研究下载目录 `.research/` 不纳入本次提交。
提交只保存在本地，未推送或发布。
