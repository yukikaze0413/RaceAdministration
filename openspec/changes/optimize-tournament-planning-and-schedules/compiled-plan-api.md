# v2编译计划契约（任务3.1，2026-10-09）

POST /configurations/:cid/validate 对合法v2结构增加 plan；POST /:cid/freeze 内部复验后保存 snapshot.plan 和 planDigest。非法参数不产出局部计划或冻结记录。结构digest仍只针对结构，planDigest单独覆盖完整计划。v1快照没有这些新增字段，既有digest保持。

plan.version=compiled-plan-v2，绑定 configurationId；units按结构中阶段/组的稳定顺序生成。unitKey及所有planKey为 plan-v2/配置ID/组ID/角色/轮号/序号，各段URI编码，不由名称、布局或账号生成。组ID由结构保证全局唯一。改变参数可增删节点，已有相同角色/轮号/序号仍是同一计划位置；冻结后结构不可变。

每个unit包含stageId/groupId/ruleVersion/parameters、inputs、outputs、matches、windows、waves、confirmationProfile。inputs明确seed/slot（普通规则）或upper/lower（双败）、容量、落位类型和初始败数。qualification输出带unitKey/channel及通道内从1开始的index；rank仅对有真实名次的规则给出，不给资格集合虚构排名。

来源表达式：
- entrant(unitKey,channel,position,initialLosses)：尚待绑定真实名单的稳定输入。
- winner/loser(matchKey)：具体前置比赛的胜/败。
- qualification(unitKey,channel,index,source)：资格出口，source表达算法确定的身份。
- standing(unitKey,rank)：积分赛结束后排名。
- conditional(condition,whenTrue,whenFalse)：GF重置资格出口。
- pendingSwissRound(unitKey,round)：未来配对窗口，没有matchId或伪造选手。

静态matches有planKey/role/round/index、恰好两个sources、dependencyKeys、wave、bestOf、condition。依赖总在先前wave；wave按依赖最大深度生成，循环按真实组内轮。waves是显式确认批次：matches完整列举，previousWaveKey建立确认顺序，requiresAllDecisions=true，conditionalPolicy=active-matches-only。未激活GF2不要求比分；GF1下方获胜才激活GF2，双方仍为原UB/LB冠军。瑞士只生成windows和前轮窗口依赖，实际配对由后续运行任务产生。

BO采用角色覆写优先于轮次覆写，再默认BO；lower预选使用lower覆写。该优先序是本平台明确规则。完整单败使用全N递归种子表后截断；分段模式按连续种子范围分Q个相同递归树。双败half的直接输入按lower初始种子顺序对应首轮UB败者列表；它是跨入口feeder映射，不是另打一轮lower签表。same实际lower预选采用递归表。具体手算及平台理由见double-elimination-feeders.md。

编译和预演/运行分别报告：来源预演缺输入时仍可展示合法结构的plan，不因此变成previewReady或runtimeReady。目前运行支持false；冻结成功只是完整结构计划形成。跨阶段具名路由合法性和entryRef混合入口分别由3.2/3.3接入，不将编译输入占位当作真实名单。

## 核验
单败8→4/8→1/12→3、季军、GSL五场、N4/8三lower模式的Q1/2/3和reset、单双循环配对/奇数休赛、瑞士只窗口均有独立期望。N2–64多结果路径逐wave检查身份唯一、两败不晋级和初始/实际败数。冻结内存三阶段失败、SQLite失败/竞争/重启/撤权均验证。
v1六人结构固定hash为457c3a5107afeba01f636941eb20c077395fc61fc4f132b252dd31d64bb33e44；期望来自手写规范化JSON的独立SHA256，不调用生产canonical函数生成测试期望。

两路只读评审完成。lower half递归表疑问依据已冻结手算feeder选择不采纳并补明其映射；seedSlots非二次幂导出行为不在编译可达输入，参数复验阻断。确认批次字段通过waves明确定义；更新旧501帮助。跨阶段连接与真实入口不在本任务假装实现。

日志：evidence/compile-backend-final.log、compile-frontend-final.log、compile-build.log、compile-browser.log。浏览器parameters25/25验证实际先保存再冻结、输入BO5和5场GSL计划持久化。当前工程验证不替代用户业务接受，也不意味着新增运行器可开赛。
3.2已追加connections跨unit/pool具名连接，inputs声明placementPorts（seed/slot同容量）；详见routing-v2-api.md。planKey编码保留JSON字符串全部码元后URI编码，包含孤立Unicode代理码元也不异常/碰撞。新增日志与当前158后端/44浏览器回归见路由契约。
## 2026-10-09 单败实际运行更新
3.3/4.1/4.2已验收，single-cut-v2已开放实际运行；新目录及冻结报告runtimeReady=true。旧冻结字段不重写，启动按冻结计划和规则复核。入口与操作见entry-runtime-guide.md，完整证据见acceptance-entry-single.md。
