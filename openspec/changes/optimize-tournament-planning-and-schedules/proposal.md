# Proposal

## Why
2026-10-08用户验收反馈：现有赛事工作台虽能运行，但空默认字段、频繁离页提醒、缺少赛制专属参数和只画阶段卡片使操作困难。需将赛事编辑改为选择赛制、填写少量参数、生成完整赛程、调整晋级和时间，并扩展真实GSL、瑞士、双败运行。

## What Changes
- 阶段增加每组人数、重复数量、每组晋级人数与赛制专属参数；总人数自动计算，合法默认值与前后端约束一致。
- 同一配置内切页不弹未保存提醒；真正离开且有修改才提醒，失败与409保留本地内容。
- 单败支持N→Q截断与季军战；GSL4人2晋级；双败支持额外败者组输入0/N/N÷2（用户明确确认直接输入者已有一败）、晋级1/2/3与条件重置；固定轮数/胜负阈值瑞士及版本化同分规则。
- 总览与赛制子图、唯一输出名额/目标席位约束、确定性自动布局和辅助对齐；展现完整已知赛程及未来来源。
- Liquipedia风格签表、排名与按时间段并排赛程；手动批量编排、资源和依赖冲突检查。自动排时间仍后置。
- 四个可重复验收案例：2026科隆Major、TI15、暗影杯、GSL；真实数据来源冻结与随机种子固定。
- **BREAKING（仅显式新版本）** 新增structure-v2/routing-v2和运行规则版本；旧草稿显式复制升级，旧冻结快照/旧运行不重写。

## Capabilities
### New Capabilities
- `stage-format-parameters`：默认值、重复组、每赛制完整参数与生成约束。
- `extended-format-runtime`：截断单败、GSL、双败和两类瑞士的配对/排名/确认。
- `tournament-schedule`：完整赛程展示、未来占位与手动时间编排。
- `tournament-reference-cases`：四案例数据出处、独立预期及浏览器验收。
### Modified Capabilities
- `configuration-workbench`：新增参数/子图/布局及合理草稿提醒。
- `configuration-validation`：版本化参数与生成图验证，真实运行声明分层。
- `progression-routing`：输出名额唯一消费与败者入口落位。
- `tournament-structure`：新增v2契约及兼容复制升级。

## Impact
后端tournament-configuration/domain、operations/runtime/progression/presets/http/state及SQLite；前端configuration/forms/pages、tournament/graph/competition和路由；HTTP、类型、领域/集成/Edge测试。复用现有精确权限、版本、幂等、整轮确认永久锁定。
此前implement-tournament-workbench为12/12工程完成未归档，作为依赖，不重写其验收；旧账户素材变更保持18/26。
本轮仅规划，尚无新增测试执行。真实案例数据核验和双败feeder表人工复核为相应切片前置门槛；平台规则与官方赛事规则分别记录。组队报名、处罚/退出运行、回滚、生产部署与素材仍不在本变更内；真实战队以隔离样例参赛单位导入，不冒称已实现团队成员管理。
