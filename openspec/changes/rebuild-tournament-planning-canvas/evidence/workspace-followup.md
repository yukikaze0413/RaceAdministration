# 2026-10-13 工作区后续验收

用户要求：参考 Comfy 提高空间利用率、移动连接/诊断、参赛来源两个主要出口、清空、多项目切换和最终 winner 子图出口。

完成：整窗深色工作区，紧凑顶部项目/保存工具，左侧组件库，右侧参数/连接/诊断/结果停靠区；窄屏先画布再滚动工具。来源默认显示初始席位集合与初始种子，已连接旧席位端口保留。清空可取消/撤销，保存更新同一草稿；项目切换提供保存/舍弃/取消。封装自动暴露末端未连接 W，嵌套保持来源和计划身份，预设保留固定 qualification 端口。旧自定义子图可通过参数面板补齐缺失末端 W。

验证结果：

- `frontend npm run build`：类型检查和构建通过；已有大 chunk 提示。
- `backend npm test`：348/348，通过。
- `frontend npm test`：最终重跑94/94，19文件通过。首次与其他完整验证并发运行时配置参数用例2项失败；单独13/13及完整重跑94/94通过，未修改该模块或用例。
- `npx playwright test e2e/canvas-lab.spec.ts`：12/12，通过；三宽度实际端点对齐，无页面水平溢出；1440画布宽>850、高>500；双来源出口；清空确认取消/撤销/保存重载且ID不变；项目保存/取消/舍弃切换；两个草稿互不覆盖；七场比赛仅末端M7 W输出；旧子图补齐并保存。
- `openspec validate rebuild-tournament-planning-canvas --strict` 和 `openspec validate planning-canvas --type spec --strict`：通过。
- `git diff --check`：通过。
- WHUT-WLAN `http://10.82.238.254:5010/canvas-lab`：新版静态构建；独立预览进程更新，不改业务库/防火墙范围。

截图：`output/playwright/canvas-workspace-1440.png`、`canvas-lab-1440.png`、`canvas-lab-768.png`、`canvas-lab-360.png`。已亲自检查1440及360布局。

之前 evidence/ 的测试计数和源码哈希属于前次验收，保留，不用本轮结果覆盖历史记录。
