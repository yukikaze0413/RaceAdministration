# Design

## Context

实施依据为 docs/plans/2026-10-14-wave-batch-optimization-plan.md。
用户已授权按该计划实施。

## Goals / Non-Goals

**Goals:** stage 框选、验证自动 wave、session 排期和瑞士轮整体映射。
**Non-Goals:** 真实比分、动态配对引擎和自动日历排程。

## Decisions

1. stages 保存 Match/Swiss 成员，不改变 parentId。
2. 纯规划器解析真实端点和候选人员，生成稳定 wave ID、图内编号及依赖。
3. validate 保存完整产物，preview 读取该产物。
4. session 使用独立版本及幂等保存，保留绑定产物快照。
5. stage 顺序覆盖画布；共享人员产生跨图先后需求。
6. v1 迁移只返回候选，保存才持久化。

## Risks / Trade-offs

未来来源保守分组可能增加 wave。
重新分组会使 session 引用失效，必须展示差异并重新绑定。
测试仅使用隔离 SQLite。
