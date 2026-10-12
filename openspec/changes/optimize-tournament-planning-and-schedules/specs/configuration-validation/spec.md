## ADDED Requirements

### Requirement: CV5 v2参数与生成图合法性
系统 SHALL 为structure-v2/routing-v2检查parameters.md的赛制完整参数、重复数量/容量一致性、输入种子唯一、N/Q约束、BO、feeder有向无环、每席位唯一、输出消费唯一及潜在身份重复。新规则运行支持由实际版本注册表决定；旧v1冻结报告runtimeReady=false保留，不以新引擎反写历史结论。

#### Scenario: 非法截断
- **WHEN** 输入N=8 Q=3或GSL人数6
- **THEN** 返回准确字段路径和允许范围，不能冻结v2

#### Scenario: 支持集区分
- **WHEN** 旧v1冻结与已实现v2规则并存
- **THEN** 旧快照/digest原样；新配置分别显示结构合法、预演就绪与实际运行支持

#### Scenario: 未知来源
- **WHEN** 来源筛选交集无法静态判定
- **THEN** 标记待运行复核，实际分配重复时整体拒绝

## MODIFIED Requirements

### Requirement: CV3 赛制意图与支持声明
系统 SHALL 对structure-v1/routing-v1继续接受既有六类意图并保持原快照语义；structure-v2/routing-v2以显式规则版本表达新增GSL、单败截断、双败、循环和两类瑞士。未绑定实际支持规则时runtimeReady MUST 为false并列出FORMAT_RUNTIME_UNAVAILABLE。标签、模板或研究链接不得被视为已支持算法或特定赛事版本。v1真实运行仍仅single-elimination-v1/round-robin-v1；v2只在对应版本实现并验证后开放。开赛另复验锁定名单、规则与结构，历史报告/digest不改写。

#### Scenario: Major-like模板
- **WHEN** 管理者校验Major-like意图或尚未完成的科隆/TI精确模板
- **THEN** 可校验结构但明确该具体版本尚不可运行，不能宣称符合真实赛事

#### Scenario: 请求真实对阵
- **WHEN** 调用者未绑定名单/运行规则或请求未支持版本
- **THEN** 返回运行能力不可用，不伪造对阵或下一轮

#### Scenario: 支持变体的真实开赛
- **WHEN** 名单审批锁定、结构冻结且所有规则版本实际可运行
- **THEN** 开赛复验通过后才生成真实对阵；历史冻结报告不变
