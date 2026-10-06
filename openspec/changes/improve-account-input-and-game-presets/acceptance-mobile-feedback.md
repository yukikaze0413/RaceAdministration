# 手机验收反馈修复（2026-10-06）

用户手机实际验收拒绝上一轮表单体验，并报告“未找到资料/未找到这个接口”和无法保存。原13/21是工程切片状态，不代表真实手机业务接受。本轮重新核验3.3/4.3，并补充7.1真实HTTP保存、7.2修改密码/主动退出；素材及完整出口仍待完成。“注销”是否永久删除尚未答复，不能宣称账号完整CRUD。

## 根因与修复

1. 常驻后端PID1156于10月5日启动，代码10月6日更新后仍未重启，实际/games为404。为现有SQLite作一致备份后，仅重启已核实项目后端为node --watch；后端和LAN代理/games均200，数据保留。
2. HTTP LAN不是安全上下文，crypto.randomUUID未定义；useWrite在try外生成键，抛错后busy锁未释放。先复现失败测试，再以getRandomValues生成v4请求键并纳入try/finally。结构编辑ID也复用同一生成器。
3. 日期内部input、table、button被全局44px/620px规则覆盖；新增组件局部隔离。主要显示分钟，确认后归一化显示，内部UTC与旧秒/毫秒保持。时区默认明确北京时间，取消/清空/偏移/409仍有完整回归。
4. 分类先于游戏，游戏仅显示本分类项；分类改变清掉旧游戏。表单按基本信息、比赛项目、时间与地点、归属与公开四组排列。
5. POST /api/v1/me/password验证旧密码、原样非空新密码，事务内再查凭据/session，原ID不变，撤销所有session。登录事务复查最新摘要防止在途旧密码复活会话。确认新密码、成功新登录及主动退出有实际Edge覆盖；修复Protected导航覆盖成功提示的竞争。Origin/JSON保护不变，纳入认证限流。

## 实际手机地址与保存

地址 http://10.82.238.254:5173 。真实可见Edge，360px，isSecureContext=false、crypto.randomUUID=undefined、scrollWidth=345。
通过页面注册专用mobile_check_20261006账号，登录后先选格斗再选街霸六，点击创建进入管理页。专用验收赛事ID：33122ba6-f404-4381-84a3-a7457899138a，名称“手机实际保存验收 2026-10-06”。刷新后仍存在。
通过编辑页面输入2026-10-08 10:30、北京时间UTC+08:00并点击确定/保存，刷新后同值。弹层x=33、width=288、height约466，完整位于360px视口内；主代理查看实际截图。
该专用账号与赛事保留供复核；未改用户账号密码、未删除用户数据。并未声称已在用户自己的手机设备上复验。

截图：output/playwright/mobile-live-create-360.png、mobile-live-calendar-360.png；实际操作脚本mobile-live-{register,login,create,date}.js及.playwright-cli页面记录。后台watch日志在output/local-preview/；备份在backend/.data/backups/，不纳入Git。

## 验证与映射

| 用户反馈/规格 | 任务 | 实际证据 |
|---|---|---|
| 接口404、手机无法保存；TC1手机HTTP保存 | 7.1 | request-key.test.ts红→绿；LAN页面点击创建/刷新/编辑；新Edge三宽度均移除randomUUID后保存 |
| 分类→游戏与输入分组；TC1 | 4.3重核 | game-presets.test.tsx层级断言及360/768/1440浏览器 |
| 日期UI及精度；DT1/DT2 | 3.3重核 | datetime组件、六组宽度/时区、键盘/取消/清空/409，真实LAN弹层截图与保存 |
| 旧密码验证/改密/退出；AC4 | 7.2 | change-password.test.js四项：拒绝/身份和owner/撤销全部session/并发/在途旧登录；账号真实Edge |
| 不改变501与冻结、旧数据 | 原关联任务及回归 | 70后端、58前端、26Edge，原配置/私有/版本/UTC场景保留 |

最终：backend npm test 70/70退出0（evidence/mobile-feedback-backend.txt）；frontend npm test 58/58退出0（mobile-feedback-frontend.txt）；build含tsc通过（mobile-feedback-build.txt）；完整真实Edge26/26退出0（mobile-feedback-browser-final.txt）。严格OpenSpec及git diff --check结果见mobile-feedback-validation.txt。

两项独立只读核验已完成：账号核验实跑密码4/4，表单核验静态检查，均未发现阻断缺陷；主代理亲读修改代码、点验并运行最终回归。旧浏览器失败记录保留：日期确认后未归一显示、测试精确label不能匹配select、密码成功跳转被Protected覆盖，均修复后重跑。首轮卡住的临时浏览器服务器连接清理也已补齐。

一次自动审批把“增加密码限流端点”误判为防护例外而拒绝；主代理出示原分支会递增计数并429、Origin无条件位于前面的证据后重新获准。没有绕过或削弱防护。

参考：[Ant Design日期案例](https://ant.design/components/date-picker-cn/)、[randomUUID安全上下文](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)、[getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)。

## 出口

OpenSpec任务和Notion同步后的最终计数以tasks.md与同步审计为准。本轮不提前完成素材GP2/GP3或第6组完整出口，未同步正式规格、未归档、未提交/推送/生产部署。账号永久删除及已有赛事数据处理待用户澄清；主动退出不等于删除。

补充时钟复核：新增“此刻”跨午夜组件先失败（UTC16:30被当成北京时间16:30）后修正，选择器getNow按所选偏移产生墙上时钟。前端最终58/58；此小补丁由主代理审读与完整回归验证，原两个探子未核验后来新增的工厂代码。Notion主阶段已回读15/23，远端57项组件证据为当时记录，新增第58项目前仅本地保存。

最终服务复查：出现一次未能复现的LAN502；随后确认后端PID30032仍在运行，direct /games与LAN /games、/health均200，不把它归因于已证实的watch退出。全部修复后，再次在真实LAN页面点击保存专用赛事说明“手机保存最终复核”，刷新后说明及2026-10-08 10:30均保留，secureContext=false。真实输出见evidence/mobile-live-final.txt。
