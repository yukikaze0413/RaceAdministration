# 本轮只读核验与主代理验证

2026-10-05；仅覆盖任务1.1、1.2、2.1–2.3，不是整变更6.3完成。

研究/日历探子 /root/research_gate_review 返回complete：认证矩阵覆盖username、密码策略、scrypt、ownerId、会话、CommonJS、服务依赖与迁移，官方Supabase迁移/Auth.js Express来源与当前代码相符；未声称已迁移提供方。Ant Design/dayjs准确锁定、中文locale、Edge三个宽度键盘确认/取消/清空及构建体积证据可复核，未把探针算成生产日期功能。

核验指出calendar-gate-typecheck.txt仅含初次类型错误。主代理保留为calendar-gate-typecheck-initial.txt，并重新执行独立tsc，成功退出0记录到calendar-gate-typecheck.txt；calendar:build也成功。依赖安装原输出保持，准确版本补充npm ls结果calendar-dependency-versions.txt，可由package.json及lock交叉核对。

密码探子 /root/password_review 因命令环境helper启动错误返回blocked，没有独立密码评审结论。主代理完整审读accounts.js、sessions.js、account.tsx及三个密码测试文件，核验原始字符串进入scrypt、旧盐/参数/身份使用、公开用户投影、空值错误、请求体/限流及日志脱敏。新增真实HTTP11项、组件2项与Edge2项覆盖规定输入和边界，所有新用户仅在临时数据库；未修改开发库。密码独立核验未完成这一限制保留，不将其算成成功独立评审。

主代理最终实测：后端53/53、前端27/27、Edge13/13（含历史8、密码2、隔离日历3），主应用build/typecheck及独立日历tsc退出0。OpenSpec严格校验valid=true、issues=[]；git diff --check退出0。真实输出在本目录，红绿观察及初次探针失败记录保留。当前源码指纹见password-slice-source-hashes.json。

Notion全量范围为主项目1、迭代0、工作项21、模块4，共26页；写前没有外部内容或集合变动。本轮五条任务Done、主项目实施5/21、账号增量4/4、日期增量1/5，写后回读无差异再勾本地任务；其他16任务保持Backlog。审计在.sdd/notion/runs/20261005-password-slice/，并发三方合并未实测；不是自动同步服务。

未提交、推送、部署、同步正式规格或归档；生产日期、游戏/素材与完整change验收尚未完成，真实用户业务接受未确认。