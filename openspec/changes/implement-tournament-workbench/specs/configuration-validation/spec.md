# Spec Delta

## MODIFIED Requirements

### Requirement: CV3 赛制意图与支持声明
系统 SHALL 接受单败、双败淘汰、单循环、双循环、固定轮数瑞士、Major-like六个赛制意图标签，仅用于结构描述。结构/路由保持structure-v1/routing-v1；未绑定支持的运行规则时runtimeReady MUST 为false，并列出FORMAT_RUNTIME_UNAVAILABLE。标签、模板或研究链接不得被视作已支持算法或规则版本。

本次运行支持single-elimination-v1/round-robin-v1（2–64个人），其余意图仍不可运行；历史structure-v1校验不自动启用运行，真实开赛额外复验规则与名单。

#### Scenario: Major-like模板
- **WHEN** 管理者校验包含Major-like意图的结构模板
- **THEN** 系统可校验其结构但明确未提供具体赛事年份运行版本，不能生成配对或宣称符合某届Major规则

#### Scenario: 请求真实对阵
- **WHEN** 调用者未绑定真实名单与运行规则，或请求未支持的瑞士真实对阵
- **THEN** 系统明确返回运行能力不可用，不伪造对阵、积分、排名或下一轮

#### Scenario: 支持变体的真实开赛
- **WHEN** 个人名单已审批锁定，结构已冻结，所有阶段绑定平台单败或单循环v1规则
- **THEN** 系统在开赛复验通过后生成真实对阵；原冻结快照和纯结构校验仍不被改写为已开赛
