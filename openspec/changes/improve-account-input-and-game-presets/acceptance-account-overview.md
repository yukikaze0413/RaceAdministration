# 账户总览与当前所有权修订验收（2026-10-07）

用户三项修订均完成工程验收。沿用7.3–7.5修订与复核，活动变更仍18/26（69.2%），未为UI返修重复增加完成点数。素材及整变更出口八项仍未完成。

## 实际完成
1. 账户页复用工作台现有panel、字体、按钮、间距；移除专属侧栏和编号区域。移动端资料行适配，唯一UUID可换行。
2. 初始只读展示当前头像、显示名、登录用户名和唯一ID。点击头像/修改名称/修改用户名/修改密码后打开对应输入弹窗；退出先确认；删除读取范围后验证密码、用户名与不可恢复确认。取消丢弃草稿并回到触发按钮，保存后回总览显示已存资料。显示名与用户名分别partial PATCH，避免无意覆盖其他资料。
3. 注销赛事范围按当前ownerId=user.id，不按历史创建者；创建默认ownerId=currentUser.id。已有后端代码符合规则，补文案与数据库回归：历史创建但已归他人的赛事/聚合原样保留，仍归本人及现归本人的赛事删除。用数据库模拟所有权变化，没有新增转让API。
4. 只读删除预览可在加载期间取消，AbortController和请求代次阻止迟到响应干扰后续编辑；失败可重新读取。真正删除/资料写入执行时保持忙碌保护，原事务、Origin、密码和回滚规则保留。

## 证据
| 验证 | 结果 | 文件 |
|---|---|---|
| 账户组件行为红→绿 | 初始旧页不符合总览；加载预览取消按钮原为disabled，修复后2/2通过 | 本轮工具输出、account-overview-frontend.txt |
| 后端全量 | 78/78，退出0 | evidence/account-overview-backend.txt |
| 前端全量 | 60/60，退出0 | evidence/account-overview-frontend.txt |
| 真实Edge全量 | 30/30，退出0 | evidence/account-overview-browser.txt |
| build/typecheck | 退出0 | 本轮工具输出 |
| OpenSpec严格/git diff --check | 退出0 | 本轮工具输出 |
| 实际LAN360 | 默认无输入/无溢出、名称弹窗打开及取消通过 | evidence/account-overview-lan.txt |
| Notion四库/31页T0/T2 | 无并发差异，7.3–7.5/账号模块/主项目最小写回并回读 | .sdd/notion/runs/20261007-account-overview/audit.json |

截图：output/playwright/account-profile-{360,768,1440}.png、account-delete-{360,768,1440}.png，以及实际LAN account-overview-lan-360.png、account-name-lan-360.png。真实Edge验证保存刷新、密码重新登录、退出确认、注销错误/取消/确认/重启；新增浏览器用例验证预览加载取消→编辑、预览503→重试、退出取消。组件额外模拟忽略Abort的迟到响应，保证不会干扰后续编辑。

## 核验与边界
独立所有权探子核实创建默认user.id、预览和删除均按当前ownerId，主代理点验catalog.js和profile.js关键SQL；独立UI核验确认初始无表单、取消清草稿、partial PATCH和错误重试，并提出异步预览隔离风险。主代理确认原实现加载时禁止取消，随后支持只读取消并补中止/代次隔离，实际红→绿及Edge复测通过。探子未冒充自己执行主线程测试。

PRD、proposal/design、AC5/AC6、README/API及任务说明已更新。正式规格与归档仍待整变更出口；未提交、推送或生产部署。真实用户账号与赛事未删除，数据库注销只在临时测试库执行。用户手机接受仍待复验。当前预览 http://10.82.238.254:5173/me/profile，HEAD e09ed528，共享工作区已有改动保留。
