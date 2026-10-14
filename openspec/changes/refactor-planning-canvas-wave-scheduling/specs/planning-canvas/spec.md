## ADDED Requirements

### Requirement: 阶段框选分组
系统 SHALL 支持 canvas-v2 的 stages，框选独立于 subgraph，成员唯一且保留比赛身份。后一 stage SHALL 等待前一 stage 全部结束。
#### Scenario: 框选与封装
- **WHEN** 用户框选比赛创建阶段，并封装或展开节点
- **THEN** stage 保留实际比赛成员，graph 归属按直接容器重新计算
#### Scenario: 逆序依赖
- **WHEN** 较早 stage 依赖较晚 stage 的结果
- **THEN** 验证报告阶段顺序冲突

### Requirement: 验证自动生成 Wave
系统 SHALL 在验证时自动分组。wave MUST 不跨直接 graph 或 stage，内部无人员冲突和结果依赖。编号 SHALL 在 graph 内统一生成。每个 wave SHALL 列出全部前置需求。round SHALL 仅用于瑞士轮，并完整归入一个 wave。
#### Scenario: 跨图编号
- **WHEN** 两个子图各生成 wave 1
- **THEN** 两个 wave 使用不同身份，引用不按编号匹配
#### Scenario: 共享人员
- **WHEN** 两个独立图共享候选选手
- **THEN** 保守分组并生成确定的占用顺序
#### Scenario: 瑞士轮占位
- **WHEN** 瑞士轮尚未生成真实配对
- **THEN** 整轮占位属于一个 wave，下一轮依赖上一轮，预览保留条件状态

### Requirement: 独立 Session 排期
系统 SHALL 在赛程页面组合 wave、调整顺序及配置时段。排期 SHALL 使用 owner 权限、独立版本、幂等请求键及产物摘要。
#### Scenario: 顺序和时间
- **WHEN** session 内前置倒置或跨 session 时间违反依赖
- **THEN** 返回定位诊断，不能保存为有效排期
#### Scenario: 产物变化
- **WHEN** 图修改后重新验证
- **THEN** 保留旧排期和绑定快照，显示成员及依赖变化，禁止按相同编号静默替换
#### Scenario: 幂等与越权
- **WHEN** 保存重试、版本过期或其他账号请求
- **THEN** 重试返回同一结果，冲突返回 409，越权拒绝历史缓存

### Requirement: 显式画布迁移
系统 SHALL 读取 canvas-v1 并提供迁移预览。应用迁移 SHALL 仅修改本地候选，保存才写入 canvas-v2。新图 SHALL 停用旧 batch 约束。
#### Scenario: 取消迁移
- **WHEN** 用户取消迁移
- **THEN** 原图和保存版本保持不变

## MODIFIED Requirements

### Requirement: 类型化规划组件
系统 SHALL 提供来源、Match、Swiss、Pool、展开器、选择器、无输入种子生成器与子图。
集合出口 SHALL 派生当前顺序的种子映射。
新规划图使用 canvas-v2，并读取旧 canvas-v1。
随机算法保持 mulberry32-v1。
预设采用 single-cut-v2、gsl-classic-v1、de-standard-v1。
Swiss 使用 swiss-fixed-v1、swiss-threshold-v1、major-cologne-2026-v1。
ti2026-observed-candidate-v1 保持规划候选状态。
本能力不存储真实比分、实际执行时间或统计。
本能力不提供实际运行或开赛接口。
#### Scenario: Match 未来来源
- **WHEN** 用户连接 A/B 并隐藏败者端口
- **THEN** W/L 仍为未来来源，隐藏不删已连接 L，展示连接提示，布局为 Y 或 X
#### Scenario: 合法不完整图
- **WHEN** 存在未连接入口或待配置规则
- **THEN** 类型合法图仍能保存，验证定位缺口，不宣称就绪

### Requirement: 原子关系编辑
系统 SHALL 保持单席位源端唯一、目标输入唯一，集合及种子允许多读。
合法结构候选 SHALL 原子替换并支持撤销重做。
重复连接 SHALL 保持原图，不产生副作用。
新图业务排期问题 SHALL 留为诊断。
旧 batch 同名不能拒绝新图的结构合法连线。
#### Scenario: 替换与失败
- **WHEN** 新连接占用两端旧关系或造成类型错误/循环
- **THEN** 合法候选一次替换两端冲突，非法候选不改变旧关系
#### Scenario: 重复参与
- **WHEN** 重叠选择进入多个 Match
- **THEN** 验证自动分 wave 并记录人员占用先后，同场 A/B 确定重复仍报告错误

## RENAMED Requirements

- FROM: `### Requirement: 保存版本链路`
- TO: `### Requirement: 保存版本流程`
