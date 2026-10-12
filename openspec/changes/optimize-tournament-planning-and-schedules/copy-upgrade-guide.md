# v1草稿复制升级（任务1.4）

旧配置编辑页先保存结构和布局，再点击「复制升级为新版配置」并明确确认。系统复制服务器已保存版本，创建独立v2配置；原配置、原报名sourceId及运行规则不改。取消不创建；冻结/运行中的旧配置不能升级。

API：POST /api/v1/tournaments/:tid/configurations/:cid/copy-upgrade，JSON {expectedVersion}，需要当前structure.edit、登录cookie、Origin与Idempotency-Key。成功201返回新configuration。相同actor/key/版本请求返回同一副本；503不部分写入，响应丢失直接重试原请求键。源版本冲突409需重读/保存后再复制。

upgradeOrigin记录configurationId/version、mapping.stages/groups/pools/routes及syntheticGroups（无组旧阶段生成的单组）与warnings。重建route source/target、group.stageId及sourcePriority排序引用，保持落位数值。元数据只由服务端生成，不作为结构payload或冻结摘要字段，后续编辑保留来源。

人数和旧引用保留；新版其他参数采用明确规则默认集，不声称复制保留了旧runtime语义。旧六人单败副本保留6人并提示规则不完整，不能在v2自动假造冠军图；原v1六人单败轮空仍可用。异构组、未知major-like标签或容量不完整无法明确映射时422并定位，原数据不写。原名单不迁移；新配置入口分配按后续审批任务明确处理。

## 验收（2026-10-08）
- 后端最终130/130，含新6项真实HTTP/SQLite复制测试，日志evidence/upgrade-backend-final.log；旧六人5场冠军回归保留。
- 前端69/69，日志evidence/upgrade-frontend-final.log；build/typecheck通过。
- 真实Edge旧平台/旧工作台/参数含升级29/29，日志evidence/upgrade-browser-final.log。三宽度真实取消/确认/刷新、旧草稿不变、未保存输入禁复制；360真实提交后丢响应、相同键重试只创建一个副本。
- 事务SQL trigger故障后原聚合字节与请求记录不变，同键恢复成功；关闭/重开SQLite后映射及原成功重试持久。旧冻结digest/结构与复制拒绝前完全一致。
- 初始HTTP404、UI缺复制入口分别实际红后实现；独立评审发现合法__proto__ ID失败与dirty复制导航风险，主代理分别观察422和按钮错误enabled，再修为无原型映射与未保存禁复制。修复对应测试通过。
- 两路只读评审：后端complete，前端partial明确覆盖边界；已补真实响应丢失重试和dirty保护。异常provenance形状属于不合法服务端响应，不宣称本切片已实现全DTO schema校验。复核及最终测试由主代理完成。

全部测试隔离临时SQLite，没有开发库演示、安装、提交/推送/部署、主规格同步或归档。Notion缺完整T0/查询能力，本轮无远端写入，待同步。