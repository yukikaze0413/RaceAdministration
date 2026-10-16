# 逐项验收

状态：本地编辑及无版本号命名已完成；真机验收未关闭。
记录日期：2026-10-16，实施基线为 bad02fb。
提交及推送状态以 Git 记录为准。
测试使用内存或临时数据库；性能测量只读读取预览草稿。

## 基线

| 范围 | 结果 | 证据 |
|---|---|---|
| 后端 npm test | 400/400 通过 | output/tmp/canvas-baseline-backend.log |
| 前端 npm test | 119/119 通过 | output/tmp/canvas-baseline-frontend.log |
| 新增共享核心测试 | 预期失败：共享核心尚未构建 | canvas-browser-core.test.js |

基线测试在沙箱外执行。
沙箱内 HTTP 监听和测试子进程失败不计作业务失败。

## ComfyUI 参考版本

- ComfyUI_frontend：bc5735c42eb95deec96136fce807833bca2037ed。
- ComfyUI：29e28e2b488e7739c351c331d73da25aa435da5c。
- 版本通过官方仓库 git ls-remote HEAD 核对。

固定源码入口：

- [前端节点创建](https://github.com/Comfy-Org/ComfyUI_frontend/blob/bc5735c42eb95deec96136fce807833bca2037ed/src/services/litegraphService.ts)。
- [前端接口](https://github.com/Comfy-Org/ComfyUI_frontend/blob/bc5735c42eb95deec96136fce807833bca2037ed/src/scripts/api.ts)。
- [工作流序列化](https://github.com/Comfy-Org/ComfyUI_frontend/blob/bc5735c42eb95deec96136fce807833bca2037ed/src/utils/executionUtil.ts)。
- [后端服务](https://github.com/Comfy-Org/ComfyUI/blob/29e28e2b488e7739c351c331d73da25aa435da5c/server.py)。

## 动作及独立预期

| 动作 | 手写预期 | 当前测试入口 |
|---|---|---|
| 新建 Match | 增加 1 个节点，A/B/W/L 端口存在，原图不变 | canvas-graph、canvas-browser-core |
| 重复连线 | 不增加连线，不改旧关系 | canvas-graph、canvas-port-selection |
| 替换连接 | 原子替换占用输入与单席位输出 | canvas-graph、canvas-boundaries |
| 非法或循环连线 | 拒绝候选，旧图保留 | canvas-graph、canvas-http |
| 选择器补集关闭 | 先显示影响，确认后一起移除失效下游边 | canvas-current-format |
| 展开器容量 | 从集合推导，不保存数量参数 | canvas-current-format |
| Stage 子集拆分 | 新建阶段，其他成员保持 | canvas-stage-grouping |
| Stage 归并 | 加入最低顺序阶段，清理空阶段 | canvas-stage-components |
| Stage 编号 | 复用最小可用编号，保持历史最大值 | canvas-stage-numbers |
| 子图封装和展开 | 保持比赛身份，重映射边界和外部连接 | canvas-boundaries、canvas-planning |
| 属性修改 | 自动生效，保存包含最终值 | properties、canvas-auto-properties |
| 排名组件 | Swiss 与循环赛规则、占位及轮次保持 | canvas-ranking-rounds |
| 保存、预览和排期 | 权限、幂等、版本和产物摘要继续由后端检查 | canvas-http、canvas-schedule |

## 已确定的命名与范围

用户于 2026-10-16 要求清理旧画布，并取消当前名称的版本后缀。
当前标识为 canvas、canvas-editor、canvas-plan。
旧格式不能用新请求键编辑或保存。
旧名称只用于已保存数据转换及拒绝测试。
计划不再要求恢复旧格式或兼容 Worker。
已有 canvas-v2 数据在启动时原子改名，验证及排期摘要同步更新。
主规格已更新本次命名要求；本地编辑规格尚未整体同步，变更尚未归档。

## 任务证据

下表按原计划逐项记录，未完成项保留原编号。

| 任务 | 结果 | 代码与验收依据 |
|---|---|---|
| 1.1 | 通过 | 上表列出手写预期；canvas-current-format 固定旧格式拒绝基线 |
| 1.2 | 通过 | scripts/profile-canvas-latency.cjs；合成图及 4 份只读草稿副本，每种网络 30 次 |
| 1.3 | 通过 | 官方提交已固定；Match、属性自动生效及当前排名组件进入测试基线 |
| 2.1 | 通过 | ESM、CommonJS、声明构建；verify-canvas-core 检查平台依赖；干净产物重建成功 |
| 2.2 | 通过 | 后端 graph、StageNumbers、参数 schema 复用 shared/planning-canvas；后端 405 项通过 |
| 2.3 | 通过 | 当前格式原子编辑、Stage、子图及影响确认通过；用户已取消旧格式迁移要求 |
| 2.4 | 通过 | 旧格式拒绝用例通过；旧条件分支已清理，不恢复兼容 Worker |
| 2.5 | 通过 | 目录含协议、规则版本及模板；3 种预设重映射、未知规则及协议不匹配测试通过 |
| 3.1 | 通过 | editor-state 管理代次、修订和快照；历史使用本地图；连续编辑、撤销及切换测试通过 |
| 3.2 | 通过 | deriveEditorModel 无来源值或 WavePlan；端口与容量由结构推导 |
| 3.3 | 通过 | canvas-fixture 为全部画布浏览器流程审计请求；连线、删除和撤销不依赖远端编辑 |
| 3.4 | 通过 | docs/PLANNING-CANVAS.md 区分编辑、分析、保存及验证；属性和视图单元测试通过 |
| 4.1 | 通过 | 数值和名称缓冲保留；席位及映射 blur 提交；立即保存、非法输入与连续输入通过 |
| 4.2 | 通过 | Stage 分组、子集拆分、最低顺序归并、编号重载及子图代表用例通过 |
| 4.3 | 通过 | 预设、封装、展开、转自定义、边界、补集及缩容确认用例通过 |
| 4.4 | 通过 | 加载后边界补齐已本地化；当前前端不调用 migrate；旧格式迁移入口保持移除 |
| 4.5 | 通过 | 属性 HTTP 队列及逐次编辑锁已移除；保存确认锁保留；全部浏览器流程审计请求 |
| 5.1 | 通过 | analysis-state 与分析草稿按钮；乱序、失败、过期及分析期间编辑用例通过 |
| 5.2 | 通过 | 当前请求的代次、修订及项目归属通过；撤销、清空、切换和身份响应已测 |
| 5.3 | 通过 | 保存快照、expectedVersion、原键重试、409、401、不同账号拒绝与同账号恢复通过 |
| 5.4 | 通过 | 后端 405 项覆盖结构、参数、权限、幂等、摘要与存储拒绝；客户端未移除后端检查 |
| 5.5 | 通过 | 多宽度验证、预览、Session、失效引用修复及顺序检查通过 |
| 5.6 | 通过 | 操作说明已更新；浏览器执行保存、验证、预览和排期流程；构建说明在共享包 README |
| 6.1 | 通过 | 脏状态移出渲染期序列化；端口索引、相对偏移缓存及逐帧拖动；一次撤销恢复节点与连线 |
| 6.2 | 通过 | 全部画布浏览器流程阻断 edit/migrate；普通流程阻断 analyze；主动分析次数单独断言 |
| 6.3 | 通过 | 36/144 节点，本机和 100 毫秒、1 Mbps 双向模拟网络；每组预热 3 次后测 30 次 |
| 6.4 | 未完成 | 360/768/1440 桌面视口已测并截图；实际手机校园网未测 |
| 6.5 | 通过 | 后端、前端、构建及画布浏览器回归已执行；命令与日志见下表 |
| 6.6 | 未完成 | 差量严格校验及独立只读评审完成；真机未测，本地编辑规格未整体同步或归档 |
| 7.1 | 通过 | 格式、编辑协议及预览计划键已统一，类型、样例和全部画布回归通过 |
| 7.2 | 通过 | canvas-naming 专项 4/4；验证、排期、缓存重试、重复启动、过期状态与失败回滚通过 |
| 7.3 | 通过 | 隔离预览已备份并重启；4 份草稿的内容、owner、版本、验证状态及请求数量保持 |
| 7.4 | 通过 | 后端 409/409、前端 129/129、浏览器 42/42、构建、严格校验和独立只读评审通过 |

更新后的计划共 33 项：31 项通过，2 项未完成。
剩余 2 项为真机验收与本地编辑规格收尾。

## 自动化验证

| 检查 | 结果与证据 |
|---|---|
| backend / npm test | 409/409；output/tmp/canvas-naming-backend.log |
| frontend / npm test | 129/129；output/tmp/canvas-naming-frontend.log |
| frontend / npm run build | 类型检查及生产构建通过；output/tmp/canvas-naming-build.log |
| 浏览器回归 | 42/42；output/tmp/canvas-naming-e2e.log；每个流程附 canvas-request-audit |
| 共享产物 | node scripts/verify-canvas-core.cjs 通过；ESM 无 Node、HTTP、存储或分析器依赖 |
| 干净构建 | 移走生成目录后，直接加载 editor-catalog 自动重建两个入口；再加载领域解析和 StageNumbers 成功 |
| OpenSpec | openspec validate move-canvas-editing-to-browser --strict 通过 |
| 补丁检查 | git diff --check 通过 |

生产构建仍提示主脚本超过 500 KB。
当前脚本约 629 KB，压缩后约 191 KB。
提示不影响构建成功；本次未拆分应用路由包。

## 性能与环境

环境为 Windows、Node.js 24.11.1、Edge 155.0.4283.45。
参考视口为 1440 × 1000 像素。
模拟网络为 100 毫秒延迟、上传和下载各 125000 字节/秒。
初始化完成后才施加网络限制。
指标为新增节点进入 DOM 后，再等待 2 次 requestAnimationFrame。
脚本另记录点击处理、DOM 提交和绘制代理耗时。
普通编辑没有网络请求，网络阶段记录为 0。
绘制代理不代表屏幕扫描或真实手机帧耗时。

完整数据见 output/playwright/canvas-local-latency.json。

| 图 | 本机第 95 百分位 | 模拟网络第 95 百分位 | 阈值 |
|---|---:|---:|---:|
| 合成 36 节点 | 26.4 毫秒 | 26.2 毫秒 | 100 毫秒 |
| 合成 144 节点 | 34.3 毫秒 | 36.9 毫秒 | 150 毫秒 |
| 副本 16 节点 | 27.8 毫秒 | 26.7 毫秒 | 100 毫秒 |
| 副本 11 节点 | 27.1 毫秒 | 27.9 毫秒 | 100 毫秒 |
| 副本 29 节点 | 26.7 毫秒 | 26.7 毫秒 | 100 毫秒 |
| 副本 4 节点 | 28.2 毫秒 | 28.0 毫秒 | 100 毫秒 |

12 种配置均通过，普通编辑请求总数为 0。
合成图为 36 节点、60 条边，以及 144 节点、240 条边。
真实副本分别含 16、11、29、4 个节点。
副本中的子图会隐藏内部节点，数据另列 visible_nodes。
测量不写入原预览数据库。

## 独立评审与修复

只读评审覆盖共享规则、构建入口、本地状态、请求归属及验收缺口。
评审发现的构建缺口已修复：所有后端直接入口先检查共享包。
构建检查核对源码签名和两个产物目录。
预构建部署沿用已有产物；源码重建需前端 TypeScript 依赖。

追加评审发现旧身份的成功响应缺少归属检查。
新增失败测试复现后，已在 API 成功返回前检查身份代次。
浏览器另测 401 保留草稿、不同账号拒绝和原账号恢复保存。

完整浏览器回归曾发现父级 input 捕获事件重置受控输入。
修复为 change 捕获后，失败的 8 项专项全部通过。
拖动测试曾使用缩放前的固定点击偏移，已改为标题中心点。
测试用例和产品缺陷分别记录，未把失败当作通过。

## 多宽度与真机

- 截图：output/playwright/canvas-local-360.png。
- 截图：output/playwright/canvas-local-768.png。
- 截图：output/playwright/canvas-local-1440.png。
- 3 种宽度均有保存、验证、预览及 Session 回归。
- 真机型号、浏览器、图规模及新增耗时：待用户补充。

隔离预览已更新，入口为 http://10.82.238.254:5010/canvas-lab。
只重启已确认的 scripts/canvas-lab-preview.js 进程。
预览使用原隔离数据库，未清理账号或草稿。

## 本次命名转换

启动转换记录为 schema_migrations 第 5 项。
转换和摘要核对位于 backend/src/platform/storage/canvas-naming.js。
幂等缓存保留原请求指纹，重试核对相同快照，不能改内容后复用旧键。
独立评审未发现当前格式改名中的跨账号幂等或摘要遗漏。
旧格式转换不恢复已移除的旧画布语义。

隔离预览的 4 份草稿均从此前的当前格式改名。
预览原有 0 份 Session 排期；排期保留由临时数据库测试验证。
备份路径：output/tmp/canvas-before-naming-1792135229174.sqlite。
转换前后核对记录：output/tmp/canvas-naming-preview-before.json 和 output/tmp/canvas-naming-preview-after.json。
核对包含节点、连线、Stage、owner、保存版本、验证状态和幂等记录数量。
正式业务数据库未打开或改写。
