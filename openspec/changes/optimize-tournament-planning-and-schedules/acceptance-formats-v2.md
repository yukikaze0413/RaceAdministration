# 任务1.1切片验收（2026-10-08）

完成内容：八规则版本服务端目录、参数schema/defaults、显式structure-v2/routing-v2解析、派生容量、字段/赛事边界与业务参数诊断。新增 GET /api/v1/formats 会话保护；v1结构保持独立分支。具体字段和当前未开放能力见 formats-api.md。

## 实际验证

- backend npm test：最终109 tests / 109 pass / 0 fail / 0 skipped，退出0。包括旧95项及新增11领域/3真实HTTP。完整日志 evidence/formats-v2-backend-final-109.txt。
- openspec validate optimize-tournament-planning-and-schedules --strict：退出0。
- git -c core.autocrlf=false diff --check：退出0；新增五文件 Prettier --check：退出0。
- 本轮未改前端，未运行浏览器/前端构建；上述结果不是参数页面或完整赛事运行验收。

## 红→绿证据

预期取自parameters.md/规格及独立字面量；测试运行时的失败与后续通过已在本会话实际观察，不把环境错误计作红。

| 行为 | 真实红 | 真实绿 |
|---|---|---|
| 默认v2单败8×1/1与BO3 | INVALID_INPUT 未知结构版本 | 保存解析成功，派生阶段/组capacity=8，原输入不变 |
| 八种规则默认集 | 未知规则版本（GSL） | 独立人数/组数/晋级/容量预期通过 |
| lower half人数与超额上限 | 8不等于12 | 输入12、超64拒绝 |
| 合法v2 / 非法单败8→3 | 缺少参数诊断；合法v2被旧formatIntent检查误报 | 合法可校验且不可运行；非法草稿保留并定位qualifyCount |
| 登录目录HTTP | 404不等于401 | 未登录401，登录200，八规则schema/defaults |
| v2冻结/原地升级 | 200不等于501 / 200不等于409 | 明确错误，草稿/旧版本保持 |
| 独立根入口超过64 | Missing expected exception | /stages INVALID_INPUT |
| 非法odd half草稿 | 旧整数capacity检查过早拒绝 | null派生容量，业务校验拒绝groupSize |
| 按轮BO覆写 | /overrides/rounds 未知字段 | rounds/角色BO保留，偶数BO拒绝 |
| schema引用污染 | 修改目录后合法BO1被拒绝 | 返回独立副本，后续BO1接受 |

HTTP还实际验证了请求重放同一配置、未知/嵌套字段、跨赛事、类型、null、超额人数、版本组合以及失败后配置version仍为1。

## 独立只读核验与处置

两个独立探子分别核验参数域和HTTP/兼容边界：
- HTTP/兼容核验无阻断；开赛要求旧冻结snapshot及支持格式，正常入口不能误启未实现v2。
- 参数核验确认 odd half 草稿缺陷；主代理先复现为失败测试，再使用未定派生容量修正并验证。
- “routes缺失抛TypeError”报告未采纳：主代理点验调用顺序与真实复现，实际先返回带/routes路径的INVALID_INPUT；追加边界测试通过。
- 后补round BO与schema深复制由主代理实际红→绿及最终回归验证；未声称它们另有独立评审。

## 状态边界

任务1.1完成；全变更2/36（0.1和1.1）。自动组实体生成/缩组影响确认1.2、参数页面1.3、显式复制1.4和运行/图/时间等任务仍未完成。v2冻结暂不可用；这是后续编译依赖，非完整v2业务交付。

没有修改用户SQLite、安装依赖、提交、推送、部署、正式规格同步或归档。Notion本轮未建立完整实时四库T0，因此未写入远端，不引用历史快照当本轮基线；同步保持待核验。
