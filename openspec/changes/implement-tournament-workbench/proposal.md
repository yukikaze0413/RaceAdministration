# Proposal

## Why
现有赛事工作台仅能编辑结构和模拟路由，报名、授权、真实对阵与确认推进仍返回501。用户已在查看页面计划后明确要求实施，需要把可视化编排接入完整个人赛事闭环。

## What Changes
- 实施受约束卡片连线、独立持久布局与可编辑赛制预设。
- 实施赛事内细粒度管理员授权、版本化报名收集表、提交/审批与名单锁定。
- 实施平台 single-elimination-v1 与 round-robin-v1，以及循环小组接单败、选手池路由。
- 整轮收齐并裁定后确认、锁定并一次推进；同分阻塞支持显式排名裁定。
- 采用简报推荐个人范围、3/1/0积分及同分交手积分→净胜局→人工留因排序。任一当场选手可提交，管理员裁定。
- 双败/瑞士/组队、时间排程、逐局角色资料、处罚和已推进回滚后置，准确保留能力错误。

## Capabilities
### New Capabilities
- tournament-operations: 权限、报名、运行、报分、整轮晋级、赛制预设与可视化操作的业务闭环。
### Modified Capabilities
- configuration-workbench: 增加卡片连线；运行支持状态采用独立运行规则判定。
- configuration-validation: 新增单败及循环运行支持集，历史意图及快照不自动启用。
- tournament-structure: 协作者按权限管理配置，不改变历史冻结结构。
- progression-routing: 真实来源完成后原子执行晋级路由。
## Impact
React/Express/SQLite及现有配置领域；新增运行聚合与报名/授权数据，精确替换已实现501端点。维护会话、Origin、版本、幂等和注销兼容，不新增外部服务或游戏资源依赖。
