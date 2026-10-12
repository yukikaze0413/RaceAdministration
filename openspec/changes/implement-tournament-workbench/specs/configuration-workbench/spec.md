# Spec Delta

## MODIFIED Requirements

### Requirement: CW3 可定位分层诊断
系统 SHALL 分别展示structureValid、previewReady与runtimeReady，并将诊断的code、severity、objectId、routeId、path、reason关联到相应表单。六类赛制意图均仅为结构描述，未绑定运行规则时runtimeReady为false。客户端校验不替代服务端判断；条件诊断不会被成功样例隐藏。

运行就绪采用独立 runtime-rules-v1 与名单复验，支持single-elimination-v1/round-robin-v1；未绑定或历史快照仍不表示开赛。卡片编辑提供键盘和表单等价操作。

#### Scenario: 冲突槽位
- **WHEN** 两条路由占用同一目标slot1
- **THEN** 显示冲突原因及字段定位，阻止冻结而不自动修正名额或目标

#### Scenario: 结构有效仍未开赛
- **WHEN** 结构校验通过但真实赛制未实现
- **THEN** 明确显示结构可冻结、赛制运行不可用，不能显示赛事就绪或开始成功
