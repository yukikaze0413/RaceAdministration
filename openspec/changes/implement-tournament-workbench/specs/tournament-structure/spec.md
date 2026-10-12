# Spec Delta

## MODIFIED Requirements

### Requirement: TS2 赛事内授权
系统 SHALL 在读取、保存、模板实例化、校验、冻结与预演的应用边界检查可信调用上下文的赛事权限。查看与管理分别授权；调用载荷中的角色声明 MUST NOT 授予权限。新增HTTP适配通过服务端会话与赛事所有权构造可信上下文，本版配置工作区按structure.edit能力授权。本地CLI的显式测试授权不作为HTTP认证，公开阶段摘要不开放私人配置读取接口。

本次配置管理扩展为创建者或获structure.edit能力的协作者；可信会话和赛事授权在写事务内重新核验，查看配置要求相应结构管理能力。

#### Scenario: 查看者无编辑权限
- **WHEN** 只有本赛事查看权限的调用者尝试保存或冻结
- **THEN** 系统返回权限不足，草稿、版本和快照均不改变

#### Scenario: 权限不跨赛事
- **WHEN** 调用者只获赛事A的管理权限而请求赛事B的结构或预演
- **THEN** 系统拒绝访问，不泄露B的配置或样例

#### Scenario: HTTP身份伪造
- **WHEN** 请求载荷含trustedContext、actorId、ownerId或role并试图管理他人赛事
- **THEN** 系统不采用这些字段授予权限；由服务端会话决定权限，伪造字段不进入应用服务
