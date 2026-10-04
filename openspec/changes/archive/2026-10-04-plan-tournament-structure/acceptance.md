# 验收记录

变更：plan-tournament-structure；schema：spec-driven；日期：2026-10-04。
基线：3dd8abe4201b58873ce42ea502628bc45225f831，分支 chore/openspec-restart；验证对象为本次未提交工作区，文件摘要见 evidence/backend-manifest.json。
环境：Windows PowerShell、Node.js v24.11.1、CommonJS、原生 node:test；未新增依赖。设计基线 Node 22+，本次没有在22另跑。
本切片工程验收通过；真实用户业务接受未确认。网页办赛和完整模拟赛事不在本变更内。

## 规格场景核对

| PRD / 规格场景 | 预期 | 实际验证入口 | 状态 |
|---|---|---|---|
| R05/R07 TS1 多阶段、非法对象、未完整草稿 | 独立对象、拒绝非法/跨赛事/重复ID，允许合法未完整字段 | structure.test.js 的 TS1 / TS2，样例解析命令 | 通过 |
| R04 TS2 查看者、跨赛事、伪造角色 | 可信授权，拒绝后无写入，读取副本 | structure.test.js 的 TS2；service权限路径核验 | 通过 |
| R07 TS3 双实例、未知版本、响应丢失 | 内部引用改写、模板/实例隔离、同键原实例 | templates.test.js 的 TS3 | 通过 |
| R05/R07 TS4 冻结后拒改、非法冻结、保留限制 | 静态复验、不可变快照、未开赛/运行不可用 | freeze.test.js 的 TS4；CLI demo | 通过 |
| R07 TS5 并发、丢失响应、失败保存 | 一次状态转换、所有写操作幂等、失败全回滚 | freeze.test.js 的 TS5（含复制响应失败）、模板重试 | 通过 |
| R05 PR1 3–0、未破同分、不可比成绩 | p/q取额、r未入选；缺值/并列/跨规则拒绝 | routing.test.js 的 PR1；pool.test.js 的成绩规则；record.expected.json | 通过 |
| R05 PR2 池重排、固定slot、重复池/阶段 | 全量合并、连续新种子、种子/槽位区分、重复整体失败 | pool.test.js、routing.test.js；pool/four-groups.expected.json | 通过 |
| R05 PR3 四组分流、来源未齐 | a/b→B seed1/2，c/d→C slot1/8；无部分分配 | routing.test.js E6/CV4，pool.test.js 的闭包/池链 | 通过 |
| R10约束 PR4 DQ/重复预演 | DQ仍分配并延续状态；重复计算不写状态 | pool.test.js PR4；应用配置前后比较 | 通过 |
| R07 CV1 循环、6入4槽、未知交集 | 稳定定位，静态error/conditional区分，样例复核交集 | validation.test.js CV1/E7；routing.test.js 条件性交集 | 通过 |
| R07 CV2 无来源、成功样例 | 三个独立就绪结论，成功样例仍保留未来限制 | validation.test.js CV2；pool.test.js CV2 | 通过 |
| R06 CV3 Major意图/运行请求 | 六意图仅结构描述，FORMAT_RUNTIME_UNAVAILABLE/RUN_NOT_SUPPORTED | validation.test.js CV3 | 通过 |
| R07 CV4 非法战绩/重复种子、输入不改变 | 不补默认值，不修改输入或存储 | routing.test.js CV4、pool.test.js只读应用 | 通过 |
| R05/R07 模板闭环 | 模板→校验→预演→冻结→拒改符合手写E6 | integration.test.js；CLI validate/preview/demo | 通过 |

33个规格场景按上述13个需求成组核对；26个测试顶层用例中还包含参数化错误算例，不将用例数量等同场景数量。已有行为的E6、精确6入4槽和模板闭环为集成补充验证；核心行为在各切片逐次观察红→绿后实现，没有把最后才补测称为测试先行。

## 实际命令与证据

工作目录 backend：

| 命令 | 退出码 | 结果 / 证据 |
|---|---|---|
| npm test | 0 | 26通过，0失败；evidence/npm-test.txt |
| node --test test/tournament-configuration/*.test.js | 0 | 26通过；evidence/node-test.txt |
| node scripts/tournament-configuration.js validate examples/tournament-configuration/four-groups.json | 0 | 合法结构；evidence/validate-four-groups.json |
| node scripts/tournament-configuration.js preview examples/tournament-configuration/four-groups.json | 0 | 与手写E6分配一致；evidence/preview-four-groups.json |
| node scripts/tournament-configuration.js preview examples/tournament-configuration/pool.json | 0 | 与含DQ手写池预期一致；evidence/preview-pool.json |
| node scripts/tournament-configuration.js validate examples/tournament-configuration/invalid.json | 1（预期） | 位置冲突被拒绝；evidence/validate-invalid.json |
| node scripts/tournament-configuration.js demo | 0 | 创建/修改/预演/冻结/拒改；evidence/demo.json |
| git diff --check | 0 | 无空白错误，只有既有LF/CRLF提示 |
| git diff --name-only 3dd8abe -- backend/server.js backend/src/controllers backend/src/routes backend/src/middlewares | 0，输出空 | 旧HTTP/API未接管 |

结构校验、正式规格同步与归档结果见 handoff.md。项目没有 openspec-verify-change 技能，采用主代理逐份规格/设计/任务/实现核对与独立代码核验，未声称调用缺失技能。

## 评审与限制

两个单轮只读独立探子分别核验结构/路由与应用/权限/事务/CLI，均最终返回complete，未报告已确认缺陷；主代理按关键出处点验。详见 evidence/review.md。评审覆盖当前未提交实现，不把摘要代替最终回归。

单进程内存仅提供本地事务保证，不保证重启持久化、多实例并发或生产授权。运行支持集为空，runtimeReady始终false；没有配对、积分排名、赛果确认、真实路由提交、处罚写入或开赛。Q14/Q21/Q22-A/Q24-C/Q25/Q26/赛制Q27/Major具体版本留后续。真实用户接受、生产接入与完整赛事验收未执行。没有提交、推送、部署；Notion本轮未另同步。
