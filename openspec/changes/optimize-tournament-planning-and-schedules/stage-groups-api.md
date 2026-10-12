# 重复组与阶段变更 API（任务1.2）

2026-10-08。后端切片已交付；参数页面与浏览器确认交互属于1.3。均沿用会话、赛事structure.edit权限、Idempotency-Key和配置expectedVersion。

## 添加阶段

POST /api/v1/tournaments/:tid/configurations/:cid/stages
```json
{"expectedVersion":1,"stage":{"name":"小组赛","ruleVersion":"gsl-classic-v1"}}
```

仅限v2草稿。ruleVersion省略默认single-cut-v2；其他参数按格式目录装入默认值。服务端生成阶段及独立组ID，GSL默认4组×4人/每组2晋级，阶段capacity=16。组按数组顺序对应A–D等展示标签；标签不作为ID。重复原请求返回同一阶段与同一响应。允许字段：id/name/order/format/ruleVersion/groupSize/groupCount/qualifyCount/parameters；省略与显式null区分。

## 只读影响计划

POST /:cid/stages/:sid/plan，不需要请求键。
```json
{"expectedVersion":4,"changes":{"groupCount":2}}
```

changes仅允许format/ruleVersion/groupSize/groupCount/qualifyCount/parameters。更换ruleVersion时重装该格式默认集，显式字段覆写；parameters为替换对象，再补格式缺省字段。增加数量保留已有组及引用，新组ID由配置ID、版本、阶段ID和序号派生；反复读取同一计划得到相同ID，应用后持久化。

报告包括proposedStage、removedGroupIds/addedGroupIds、affectedRouteIds/affectedRegistrationIds/affectedLayoutIds/affectedRuleStageIds/affectedMatchIds、removedLayoutIds/retainedLayoutIds、requiresConfirmation、blockers、operationsVersion、validation和confirmationToken。报名仅报告记录ID，不返回账号、姓名或答案；比赛只报告ID，不回滚历史赛果。

缩组或真实重建须明确确认。纯BO/defaultBO与overrides变更保留仍有效的路由与名单；有旧runtime-settings需要清理时仍提示确认。修改其他结构或规则绑定参数保守按重建报告影响。改变格式可能使旧路由失效；报告列出要删除的直接引用，后续池与来源合法性继续由validation报告，不自动造补充连接。

布局只清理消失的节点；仍存在的节点位置明确报告为保留，保留操作不增加布局版本。已有关联runtime、或受影响名单/旧规则已被名单锁定时，报告阻塞并拒绝应用。取消或仅读取计划均不写入。

## 应用与确认

POST /:cid/stages/:sid/apply，需要请求键。
```json
{
  "expectedVersion":4,
  "changes":{"groupCount":2},
  "confirmed":true,
  "confirmationToken":"来自刚读取的计划"
}
```

事务内重新核验权限、配置版本和完整operations依赖，重算计划及令牌；令牌绑定候选变更和当前依赖。旧报告、替换changes、未明确确认返回409 CONFIG_CHANGE_CONFIRMATION_REQUIRED。非破坏性扩组可省略确认字段；一旦显式提供confirmed/token，也必须为true并匹配最新令牌，传false不执行。

清空受影响报名sourceId还须当前registration.review权限；保留身份、审批状态、种子、发布版本和答案，之后由有权管理员重新分配。移除已说明的失效路由、旧规则与消失节点布局；结构、依赖版本、布局版本和成功键在同一SQLite事务提交。无依赖变更时operations.version不增。任一步存储失败返回503且全部回滚；重试不重复应用，撤权后原成功请求也不得借缓存绕过权限。

普通完整PUT禁止v2缩组、删除/重排原组或重建阶段绕过计划确认；v1原契约保留。扩组/字段修改仍受格式schema、64人上限、引用与赛事归属约束。此切片未开放v2冻结/运行，继续受1.1与3.1的编译门槛约束。
