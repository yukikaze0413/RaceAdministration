# 工程验收：deliver-platform-frontend

日期：2026-10-04（Asia/Shanghai）。用户范围：全平台前端、必要持久后端、尚未实现业务的完整报错覆盖。工程实现与本地验收通过；真实用户业务接受未确认，不宣称完整赛事运行或完赛。

## 实际交付

- 中文响应式平台入口覆盖赛事发现、系列、赛事详情、账号与资料、个人赛事及所有管理模块。
- 真实用户名密码、服务端会话、创建者授权、SQLite账号/元数据/结构聚合与幂等记录。
- 结构工作台：阶段/小组、独立池、完整排序、来源/目标/筛选/名额/seed或slot表单，版本保存、诊断定位、显式来源映射、模拟预演、二次确认冻结与只读恢复。
- 报名/组队、参赛关系、对阵、排名、报分/修正、逐局、推进、处罚/撤销、协作者与恢复邮件均明确 unavailable。22个赛事 Method+Path分别验证权限及501零业务写入；密码恢复和joined单独核验。未知API为404，不吞为501。
- 全部实际写入按服务端响应为准，不造名单、比分、冠军、默认管理员或业务统计。runtimeReady=false、started=false，冻结仅锁结构。

## 命令与证据

| 命令 | 结果 | 保存记录 |
|---|---|---|
| npm --prefix frontend run build | exit0，TypeScript检查与Vite生产构建成功 | evidence/build.txt |
| npm --prefix frontend run typecheck | exit0 | evidence/typecheck.txt |
| npm --prefix backend test | exit0，42/42（原领域26 + 平台HTTP/启动16） | evidence/backend-tests.txt |
| npm --prefix frontend test | exit0，25/25，7个文件 | evidence/frontend-tests.txt |
| npm --prefix frontend run e2e | exit0，8/8，真实Edge浏览器与临时SQLite | evidence/browser-tests.txt |
| git diff --check | exit0；仅Windows自动换行提示 | evidence/diff-check.txt |

测试不使用开发库。浏览器每用例独立临时库、随机回环端口和同源生产构建；服务启动测试实际运行backend/server.js并检查初始目录为空。失败数据库文件保留原内容的迁移测试、真实SQL触发器提交失败与竞争冻结证明事务拒绝且无部分写入。源文件指纹见evidence/source-hashes.json；工作区尚未提交，因此不能把HEAD视为本次实现快照。

## 需求→验证追踪

| 规格 / PRD范围 | 主要验证 |
|---|---|
| AC1–AC4 / R01、R04 | 注册重名/边界/无凭据响应，重启登录，轮换、过期、撤销、同源与限流；浏览器资料更新/退出、找回501 |
| TC1–TC4 / R01、R02、R04、R12 | 两届独立、非法归属/日期/字段，目录/分页/隐藏，private404/public403，幂等/版本与元数据提交回滚 |
| TS2、TS6 / R04、R05、R07 | 服务端身份映射、伪造字段、跨赛事配置404，持久快照与原键重启重放、竞争与结构提交回滚 |
| CW1、CW2 / R05–R07 | 稳定ID、未完整草稿、selector字段切换、手写四组目标/排序/seed-slot载荷、真实模板编辑保存与未保存提醒 |
| CW3 / R05–R07 | HTTP200诊断不冒充有效；三层就绪、360px冲突槽位跨栏目定位与焦点；六意图不宣称运行支持 |
| CW4 / R05、R07、R10、R11 | 显式完整一对一映射；只改snapshot sourceId；four-groups/pool与独立expected的领域核验；浏览器四人分配、池DQ、来源清空移除旧结果 |
| CW5、TC5 / R05、R07、R12 | 冻结取消零请求/焦点恢复、版本冲突比较与确认替换、只读刷新、同浏览器重启恢复；公开摘要确定选取且无私有输入 |
| CE1–CE5 / R03、R04、R06、R08–R12 | implemented/unavailable与权限分开、未知能力关闭、清单503恢复、22端点权限矩阵/零写入、缺失模块逐页错误 |
| UI1–UI4 / 全范围 | 深链接/生产构建/未知页404、上下文与纯文本、旧API隔离；迟到GET/旧401隔离；360/768/1440、导航/表单/模态/诊断焦点与表格内部滚动 |

delta共25个需求、47个场景；并非47项独立测试与测试总数一一对应，表驱动端点和集成流程含多项断言。正式追踪任务只有tasks.md，不另建重复待办系统。

## 独立核验与修复

前端只读探子完成跨模块核验，发现：未知能力仍启用写表单、未保存切栏目无提醒、validate/preview409缺重读恢复。主代理点验具体代码并修复，添加能力门控与真实浏览器草稿/版本恢复回归。后续键盘核查将未保存提醒改为原生模态并自动聚焦“继续编辑”；实际小屏预演发现表格撑宽页面，改为网格可收缩且仅表格区域滚动。缺失映射与失效引用文案、implemented状态名称及未知查询400亦经失败测试修正。

后端独立核验仅覆盖accounts、sessions、errors、catalog、sqlite-store五个文件；报告无已证实bug，点验公开用户投影、private404/public403、会话轮换事务、幂等先于版本、结构同步事务。首次后端探子因Windows工具初始化失败未取得证据，不计作独立审核。实际测试与最终复核由主代理执行，探子没有修改代码。核验压缩记录见evidence/review.md。

## 视觉与操作证据

截图位于项目output/playwright/：overview-360/768/1440.png、unavailable-360/768/1440.png、diagnostic-360.png、preview-360.png。主代理查看360预演与1440概览；浏览器断言三宽度无页面横向溢出、表格区域可滚动、诊断字段聚焦、冻结取消恢复焦点及未保存模态聚焦。不是全站WCAG认证，也没有承诺所有浏览器引擎矩阵。

## 边界与后续

单实例本地交付；Node24.11.1内置SQLite仍为实验性API。未做生产域名/TLS、备份、多实例、吞吐、安全渗透或真人完整比赛验收。Q14/Q15/Q21/Q22-A/Q24-C/Q25/Q26/Q27及双退出淘汰冲突保持未决，启用当前unavailable能力须另行冻结领域规则。

43/43任务完成。六项delta已同步（五项新能力、TS2修改与TS6新增），逐需求比较一致，变更与八份正式规格严格校验通过。已归档到openspec/changes/archive/2026-10-04-deliver-platform-frontend；CLI使用skip-specs是因为主代理已单独完成同步和校验，不表示未同步。归档时唯一未勾选项为7.5归档自身，归档成功后已更新完成标记，过程记录见evidence/archive.txt。未提交、推送、部署或自动同步Notion。