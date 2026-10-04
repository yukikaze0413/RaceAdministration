# configuration-validation Specification

## Purpose

对赛事结构草稿和来源结果样例实施可定位的分层合法性检查，区分静态可证明条件、依赖未来输入的条件和赛制运行支持状态。为冻结结构与后续运行接入提供清晰门槛，不将静态检查或有限样例误称为真实赛事已经验收。

## Requirements

### Requirement: CV1 静态结构校验与定位
系统 SHALL 检查字段、同赛事引用、DAG、正整数容量/名额、排序与映射完整性、目标位置冲突及来源筛选重叠。可证明非法者为error；无法静态判定的动态重叠为待运行复核项。诊断包含稳定错误码、对象/路由ID、字段路径和中文原因，不以通用“配置错误”代替定位。

#### Scenario: 循环依赖
- **WHEN** 阶段A依赖B结果而B又依赖A
- **THEN** 校验返回包含A/B路径的循环依赖错误，不能冻结

#### Scenario: 容量与槽位冲突
- **WHEN** 三组各分配2人至容量4目标，或两规则均占用目标slot1
- **THEN** 系统分别定位超额路由/目标和冲突位置，不自动扩容、覆盖或丢弃参赛者

#### Scenario: 无法证明未来筛选互斥
- **WHEN** 未来记录筛选与名次筛选是否重叠取决于尚未发生的赛果
- **THEN** 系统标明待输入复核，不能声称所有未来分配必成功

### Requirement: CV2 分层就绪与样例边界
系统 SHALL 返回structureValid、previewReady和runtimeReady三个独立结论；静态校验无error可令structureValid为true，只有所需模拟来源完整且预演无错误才令previewReady为true。未知真实名单、同分或未来赛果不因一个成功样例而消失。冻结采用structureValid门槛，并保留条件诊断。

#### Scenario: 尚无来源结果
- **WHEN** 草稿结构合法但没有模拟来源结果
- **THEN** structureValid为true、previewReady为false，并列出缺失输入；可结构冻结但不能真实开赛

#### Scenario: 一个成功样例
- **WHEN** 四组冠军样例预演成功
- **THEN** 系统明确验证仅针对该输入快照，不声明所有人数或未来赛果通过

### Requirement: CV3 赛制意图与支持声明
系统 SHALL 接受单败、双败淘汰、单循环、双循环、固定轮数瑞士、Major-like六个赛制意图标签，仅用于结构描述。本change支持的结构/路由契约版本为structure-v1/routing-v1，赛制运行支持集为空；所有runtimeReady MUST 为false，并列出FORMAT_RUNTIME_UNAVAILABLE。标签、模板或研究链接不得被视作已支持算法或规则版本。

#### Scenario: Major-like模板
- **WHEN** 管理者校验包含Major-like意图的结构模板
- **THEN** 系统可校验其结构但明确未提供具体赛事年份运行版本，不能生成配对或宣称符合某届Major规则

#### Scenario: 请求真实对阵
- **WHEN** 调用者要求使用本change产物生成单败或瑞士真实对阵
- **THEN** 系统明确返回运行能力不可用，不伪造对阵、积分、排名或下一轮

### Requirement: CV4 模拟输入合法性
系统 SHALL 校验来源完成标记、参赛者身份和初始种子唯一性、非负整数战绩、可比规则标识及退出状态；存在不可识别字段、重复名单、非法排序值或缺失必需值时给出诊断，不更正为默认数字。来源名次可以并列，但不得借此形成唯一目标分配。

#### Scenario: 非法战绩与重复种子
- **WHEN** 输入包含负胜数或两个不同参赛者共享初始种子
- **THEN** 系统定位非法记录或种子并拒绝预演，不计算分配

#### Scenario: 原始输入不改变
- **WHEN** 输入结构或结果样例校验失败
- **THEN** 系统仅返回诊断，输入快照、冻结配置、真实赛果和下游状态均不改变
