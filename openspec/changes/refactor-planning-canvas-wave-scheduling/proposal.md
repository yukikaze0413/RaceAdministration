# Proposal

## Why

旧 batch 混合轮次、图深度和执行批次。新机制需要明确阶段顺序、图内自动 wave 和独立 session 排期。

## What Changes

- 增加 canvas-v2 和 stage 框选分组。
- 验证生成按 graph、stage 划分的 wave 及前置需求。
- round 仅表示瑞士轮轮次。
- 增加独立 session 排期及失效引用修复。
- 保留 v1 读取，提供显式迁移。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `planning-canvas`：更新图模型、自动验证产物、阶段编辑及赛程安排。

## Impact

影响 planning-canvas、画布页面、独立预览及隔离 SQLite 表。
正式赛事运行和冻结配置保持现有行为。
