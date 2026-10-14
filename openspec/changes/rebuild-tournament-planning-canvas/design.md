# Design

2026-10-14 边界统计修正：此前只统计跨边界连线与末端W，导致默认未隐藏时子图悬空输入仍不存在。自定义子图现在按内部连接统计所有开放输入/输出：内部未连接的端口和既有跨边界端口均成为边界；内部已连接端口不暴露，集合派生种子不重复创建。嵌套从内到外同步，现有边界ID保留，旧auto出口字段不再限制完整统计。显隐过滤独立于接口存在性，两项默认false。预设固定资格接口保持原契约，转自定义后使用完整开放边界。

2026-10-14 用户修订覆盖此前 Match 必需 A/B 的约束及界面自动出口开关：Match 单方为空时直接转发真实身份到 W、L为空，双方空时W/L均为空，空值沿链路传递，Pool忽略空席位，不创造虚假引用。上游未形成席位或其他组件缺输入仍诊断。预览携带 bye 标记并显示轮空。界面以 display.hideDanglingInputs / hideDanglingOutputs 替代自动出口选项，默认不隐藏；仅无连接端口可隐藏，子图转发和派生种子连接解析到实际端口，原接口与边不变。旧 autoWinnerOutputs 字段保持数据兼容且不再提供界面开关；末端自动出口仍保持，用显隐控制展示。

## Context
依据已批准 docs/PRD-canvas-rebuild.md C1～C7。旧 parseStructure 为严格 stage/group schema，旧编译器需要正式配置且旧图为展示投影；新节点图独立建模。用户要求持续实现，因此本次正式产物形成并校验后直接进入 apply，不再重复逐阶段询问。

## Goals / Non-Goals
**Goals:** 一个领域模块驱动静态类型、编辑命令、来源计算、诊断和预览；测试界面和将来工作台复用同一 API；明确保存/规划就绪/未来解析。
**Non-Goals:** 当前不集成正式工作台，不产生实际赛果或启动比赛；不更改旧冻结 snapshot 或既有 change 状态。

## Decisions
1. backend/src/planning-canvas 采用无数据库依赖的纯图模块，nodes/edges 使用稳定 ID，parentId 表达嵌套子图，边界具有内部 endpoint 映射。图编辑命令在副本上运行，合法才返回；前端保存命令前后快照支持撤销/重做。浏览器通过 stateless analyze/edit API 调用同一域逻辑，避免前后端两套校验漂移。
2. 类型 seat/collection/seed-map/seed-template；Pool 输入显式 seat-or-collection。source 配置未来参赛引用；Swiss 输出排名表达式，Match 输出胜败表达式；表达式保留候选身份和互斥决定，以便条件/重复诊断。所有集合的 seed-map 派生当前序列，带 provenance，不复制竞技排名。
3. 随机算法固定 mulberry32-v1、Fisher-Yates，不放回；整数 seed 保存为 uint32。生成器显式 N 输出 seed-template，Pool 长度严格匹配。并列排序保留原位置次序。排序规则用于竞技切线必须显式配置。
4. 复用 versioned format registry 和 compile() 为预设产生 Match 关系，不使用运行器生成真实配对。Swiss 按已定义轮数或阈值上界提供 windows，未知人数/配对保留占位。稳定 canvas-plan-v1/canvasId/matchId 与 parent/name/layout 无关。
5. 独立 planning_canvases 表带 owner 外键级联清理，canvas_requests 记录幂等；事务内重检当前用户和 expectedVersion。不会写 tournaments/structure/operations/schedule。接口 /planning-canvases 列表、create、GET/PUT/:id、validate、preview；/planning-canvas/analyze、edit、samples 是独立只读/候选能力。验证记录关联 version+digest，preview 在新版本缺验证时拒绝。
6. 前端 /canvas-lab 独立路由，复用认证和 API 包装。用户后续指定参考 Comfy，采用整窗深色网格节点编辑器，紧凑工具栏、左侧分类组件库和右侧滚动停靠工具，连接表单与诊断不占画布下方。色板：工作面 #202630、工具面 #2b3340、正文 #e2e8ef、集合 #64a9d5、席位 #6bba9e、子图 #d8bd7a；系统中文字体，13px工具正文、19px标题，按节点端口类型编码颜色。参赛来源默认仅两个主要输出，旧逐席位端口连线保持可见。端口按钮真实测量坐标，SVG edge 与节点共用世界变换。ResizeObserver 测量尺寸/锚点，视图适应/定位不改结构，移动/折叠可保存布局。路由专用样式不影响正式工作台。
7. 缩容、节点删除和边界删除先返回 impact，显式确认带原图摘要复验再应用。subgraph flatten 后等价，按用户后续要求暴露末端未连接 W，嵌套输出解析到同一 Match W；不批量暴露中间 W 或所有 L。预设使用固定 qualification ID 覆盖自动末端出口，避免重复。旧子图提供显式补齐按钮。清空保留草稿身份和撤销快照；项目切换明确保存/舍弃/取消，重置撤销与连接选择，保持幂等、版本冲突和不确定保存锁定。

## Risks / Trade-offs
[未来身份无法静态证明] → 显式条件诊断；已确定重复报错，解析夹具复验，不宣布运行成功。
[保存与图候选异步竞争] → 前端 busy 禁编辑并保留原请求键用于响应丢失重试，版本冲突必须显式重读。
[模块多但入口隔离] → 切片独立领域/HTTP/真实浏览器证据；完整链路后再做最终全回归。
[旧规则约束较强] → 适配预设而不放宽旧 schema，无迁移冻结数据。

## Migration Plan
新增独立表，测试使用临时数据库；删除路由入口即可回退，保留数据供恢复。用户实际库不通过测试打开。生产发布不在授权范围。

## 后续选中、边界与预览设计
用户要求 Ctrl 点击替代复选框，默认自动添加末端胜者，允许保留悬空接口，并参考 HLTV results 设计独立赛程页面。普通点击选中并查看参数；Ctrl/⌘ 点击与键盘 Ctrl/⌘+空格增减多选，触屏提供多选模式，以描边和数量替代重复选中列表。

自动胜者策略默认开启，subgraph.params.autoWinnerOutputs=false 可退出。stateless syncBoundaries 在加载旧草稿时逐层补齐，保持已有端口ID；只改变本地候选图，显式保存才持久化。后续编辑同步末端W；预设资格出口保持固定。边界移除移到高级设置，与断开连线语义区分，悬空端口保留，必需输入仍诊断。

顶部导航通往 /canvas-lab/preview。页面使用 HLTV 的日期分组和紧凑行结构，浅灰底 #eef1f5、白色比赛行、深蓝正文 #283d54、蓝灰分隔 #7394b0。日期标题在列表上方，左侧筛选项目/阶段/日期/来源搜索；手机筛选位于列表上方。预计时间按画布输入原值分组，未排期按阶段放入“时间待定”。展示未来来源、BO和项目，不伪造结果；Swiss动态窗口另列。所有请求使用既有 owner/version/digest 验证，未验证项目明确排除，网络错误不伪装空赛程；切换与卸载中止旧请求。
