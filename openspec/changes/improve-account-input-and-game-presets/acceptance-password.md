# 历史密码切片验收说明

下文保留密码阶段5/21及53/27/13的当时证据。当前累计9/21，最新日期与全量回归56/51/21见acceptance-datetime.md。

# 本轮切片验收（2026-10-05）

范围：任务1.1、1.2、2.1–2.3。活动变更共21项，日期生产输入、游戏身份、素材及整变更集成出口尚未完成；本文不代表完整change验收或业务接受。

## 已实施与验证

密码：前端注册/登录无minLength/maxLength；注册只校验非空字符串，登录去除1024上限且拒绝空值。密码原样进入原scrypt，不trim/截断/normalize，用户ID及旧参数保持。HTTP1字符行为先失败422后通过；1025字符先失败401后通过；前端旧min/max断言先失败后通过。

新增11个真实HTTP测试，涵盖1/12/129/1025字符、Unicode组合序列、前后/纯空格以及变更密码不能登录；空值和非字符串、旧scrypt参数与身份重启、1MiB 413、统一401、限流429及日志脱敏。新增两个组件测试各覆盖7种原样密码，required仍存在；新增两个真实Edge注册登录流程。所有账号在内存或临时SQLite，不使用开发库。

认证兼容材料见auth-decision.md，本次保留本地身份。日期组件前置验证见calendar-decision.md，准确依赖及隔离探针可供第3组接续；当前赛事时间仍为旧ISO输入，不能称已完成日期改善。

## PRD → 规格 → 任务 → 证据

| PRD | 规格/边界 | 任务 | 真实证据 |
|---|---|---|---|
| R14 | 认证迁移只评估 | 1.1 | auth-decision.md、官方出处、当前身份代码、npm包查询 |
| R15 | 日期组件兼容前置 | 1.2 | calendar-decision.md、calendar-gate-build.txt、calendar-gate-browser-tests.txt、三宽度截图 |
| R13 | AC1短密码与长密码 | 2.1 | password-redShort/greenShort/redLong/greenLong、password.test.js、account.test.tsx、password.spec.ts |
| R13 | AC1空值与资源上限/注册与重启读取 | 2.2 | password-backend-tests.txt，旧参数重启、413/401/429及日志安全投影 |
| R13 | 账号原样输入和文档一致 | 2.3 | frontend/README.md、docs/PLATFORM-API.md、同说明短/长密码真实HTTP和Edge流程 |

密码红绿证据中的redUI初次输出只记录启动行；完整旧属性失败由后续主代理实际读取确认，不能把该文件当完整失败报告。最终日志及源码的断言可复核。

## 回归与限制

最终全套实测后端53/53、前端27/27、Edge13/13（历史8+密码2+日历探针3）；build/typecheck及独立日历tsc退出0。最终输出见evidence/password-backend-tests.txt、password-frontend-tests.txt、password-browser-tests.txt、password-build.txt、password-typecheck.txt和calendar-gate-typecheck.txt。研究/日历探子已完成独立核验；初次类型失败保存在calendar-gate-typecheck-initial.txt。密码独立探子因执行环境失败未完成，不宣称独立密码评审通过；主代理亲自审读代码/测试与最终执行回归。

Node SQLite实验性提示、浏览器颜色环境提示及隔离探针大chunk提示保留。未提交、推送或部署，未同步正式规格/归档。旧归档证据保持历史。完整变更的6.1–6.3不因本轮部分回归而提前勾选。

Notion阶段更新已回读，本地任务1.1、1.2、2.1–2.3完成，共5/21；稳定页ID见.sdd/notion/mapping.json，完整审计在.sdd/notion/runs/20261005-password-slice/。主代理确认候选期间本地OpenSpec/.sdd哈希未变；全量26页和四库记录集合一致，未发现外部并发修改，三方冲突合并未实测。
