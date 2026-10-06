# 账户重规划与永久注销验收（2026-10-06）

当前活动变更完成18/26（69.2%）；本轮7.3–7.5完成。第5组素材五项、第6组全变更集成与出口三项仍未完成，不提前同步正式规格或归档。

## 完成内容
- 参考GitHub个人资料/用户名变更/删除账户与Google个人信息分组，采用账户概览、个人资料、登录与安全、危险操作。出处与决定见account-redesign.md。
- 展示头像、显示名、登录用户名和不可变UUID。修改用户名验证当前密码，小写判重；更名不改变ID/赛事归属。原显示名更新兼容。
- 头像支持PNG/JPEG/WebP原图<=10MiB；浏览器居中裁切256像素后压缩WebP，必要时JPEG回退。提交二进制<=256KiB；服务端sharp再次限制4194304像素、拒绝SVG/损坏/多页并转WebP、去元数据，内嵌数据库。头像可取消或移除，刷新保持。
- 注销不是退出：预览会话/系列/赛事/配置/快照/目录请求数量，密码、当前用户名和不可恢复确认。DELETE /me用范围哈希复核后，一个事务按依赖顺序清理6张业务表中的自身全部关联。其他用户保留，失败回滚；历史跨账号系列/冻结者/配置请求关联返回409，避免误删。
- 异步密码/头像请求在事务内重新核验身份和有效会话；已删账号不会复活。Origin/JSON及认证限流保留。成功后清cookie及私有身份，回登录页提示永久删除。
- 修补既有Express间接依赖body-parser、path-to-regexp、proxy-addr、qs，npm audit为0漏洞；没有盲目更换认证供应商。

## 当前证据
| 检查 | 实际结果 | 文件 |
|---|---|---|
| 新后端测试首次红 | 4/4失败（尚未有资料/注销接口） | 本轮工具输出 |
| 后端全量（最终） | 77/77，退出0 | evidence/account-backend.txt |
| 前端全量 | 58/58，退出0 | evidence/account-frontend.txt |
| 生产构建含TypeScript | 退出0 | evidence/account-build.txt |
| Edge全量 | 29/29，退出0 | evidence/account-browser.txt |
| 独立核验后头像及焦点修复 | 3/3，360/768/1440，退出0 | evidence/account-avatar-boundary.txt |
| OpenSpec严格校验 / git diff --check | 退出0 | 最终检查工具输出 |
| Notion全范围T0/T2及逐页回读 | 28个旧页面/4库无并发变更；新增3任务后26任务18Done | .sdd/notion/runs/20261006-account-redesign/audit.json |

实际LAN http://10.82.238.254:5173/me/profile 已显示新账户页并恢复既有测试会话；不是只用临时同源服务器。截图output/playwright/account-profile-{360,768,1440}.png、account-delete-{360,768,1440}.png。Edge用新临时SQLite测试账号：头像上传、更名、刷新、错误密码/取消/确认删除、数据库逐表检查及重启后不存在；真实用户账号和专用手机验收旧账号未删除。

## 核验与修正
初始两位核验探子被Windows沙箱启动错误阻塞，没有冒充通过。后补独立只读核验完成：确认事务/跨用户/竞态防护，发现PNG极端体积问题。主代理点验后改用压缩WebP/JPEG，随机RGBA原PNG>256KiB，经浏览器转换提交<=256KiB，三宽度保存成功。截图发现复选框全局width撑开，修复专用宽度并加弹窗scrollWidth检查。新增Tab用例发现浏览器焦点可离开弹窗到浏览器界面，改为显式首尾Tab循环后通过。
新增匿名/Origin/限流检查通过；限流用例计数曾漏掉匿名写请求，修正测试统计，服务端规则未放宽。

## SDD与边界
PRD、proposal/design、AC5/AC6规格、tasks、API/README已对齐；Notion已建立7.3/7.4/7.5稳定映射、账户模块及主项目摘要并回读18/26。正式规格与归档仍留至整变更出口，不宣称素材、报名、运行或完整游戏图库完成。
未提交/推送/生产部署；用户自己的手机接受仍待复验。保留共享工作区既有修改。

最终实际LAN只读复核：新 /api/v1/me/deletion-preview 返回200，现有手机验收测试账号仍存在；输出 evidence/account-lan.txt，截图 output/playwright/account-lan-360.png。未在实际库执行注销。
