# Design

## Context

动机与范围见proposal.md。已亲读PRD、SDD、交接、首个归档设计及三项正式规格。当前无frontend目录；backend/server.js直接监听5000，Express 5.1挂载旧/api/races和/api/test；旧raceController使用内存数组与示例数据，不能成为新平台数据源。工作区已有前轮未提交修改，全部保留。

backend/src/tournament-configuration/application/service.js提供createDraft、instantiateTemplate、getConfiguration、replaceDraft、validateConfiguration、previewRouting、freezeStructure与固定拒绝的requestRuntime。authorize端口依赖可信actorId和赛事内view/configure；写入要求requestKey，修改/校验/预演/冻结要求expectedVersion。存储端口是read(tournamentId)及transaction(tournamentId, operation)，聚合包含configurations/snapshots/requests三个Map。现有26项测试的通过记录来自前轮，本次规划没有重新运行业务测试。

现场Node v24.11.1，已只读确认node:sqlite.DatabaseSync存在并发出ExperimentalWarning。新接口需要持久身份和赛事归属，不能把CLI的authorize:()=>true暴露为HTTP权限。

## Goals / Non-Goals

**Goals:**
- 一个浏览器入口覆盖PRD R01–R12的页面；为已有结构能力提供真实表单闭环。
- 真实账号、持久赛事数据与统一能力/错误契约；所有未完成业务都能稳定失败且零业务写入。
- 以可验证切片逐步交付，页面、接口与错误覆盖表作为实施范围，不用总进度掩盖未决业务。

**Non-Goals:**
- 不实现配对、积分、报分裁定、报名审批、处罚结算、协作者授权等未冻结的领域规则；其可用性在本版明确为unavailable。
- 不承诺生产部署、邮件恢复、第三方登录、多人并发规模、多实例数据库或完整赛事完赛。
- 不自动提交、推送、发布、同步Notion或迁移旧原型记录。

## Decisions

### D1 技术路线与模块边界

选择React + TypeScript + Vite + React Router构建SPA；后端继续Express/CommonJS；单实例持久存储采用Node内置SQLite，Node基线为24.11.1，实施时锁定实际依赖版本。Vite构建与浏览器测试不依赖Conda。使用局部CSS和少量自主组件，优先原生表单与语义HTML，不先引入完整设计系统。

比较方案：
- 纯静态页面/浏览器localStorage：无法建立可信权限和真实结构服务接入，不符合本次范围。
- 新建全栈SSR与远程数据库：会扩大迁移和部署依赖，本次没有SEO或分布式要求。
- SPA复用Express：领域模块可直接复用，网络及错误边界清晰，采用此方案。

计划目录：
- frontend/src/app：路由、SessionProvider、页面错误边界。
- frontend/src/features/{account,catalog,configuration,operations}：页面与领域表单。
- frontend/src/shared/{api,ui}：单一请求客户端、错误解释、表单、对话框、列表状态。
- backend/src/platform/{auth,catalog,http,storage}：身份、元数据、API、数据库迁移。
- backend/src/tournament-configuration/adapters/sqlite-store.js：适配既有聚合端口。
- backend/src/app.js：可注入数据库/时钟的app工厂；server.js只负责配置、监听与关闭。
- backend/test/platform及frontend/src/**/*.test.tsx；frontend/e2e保存浏览器场景。

前端不引用CommonJS领域模块，不复制静态校验/路由算法；服务端是业务有效性的唯一判定方。单个配置编辑由useReducer集中维护，已保存版本与本地编辑分开；API数据由页面hooks管理，先不新增全局状态库。后端新增/api/v1，旧API仍隔离使用原数组；新前端不调用旧API。新API路径未知返回JSON404，不能落入SPA HTML回退。

参考：Vite官方版本说明确认其Node要求，见https://vite.dev/blog/announcing-vite8；现场Node满足要求，具体包安装仍需实际验证。
SQLite依据固定版本文档https://nodejs.org/download/release/v24.11.1/docs/api/sqlite.html；该版本仍在Active development，仅使用DatabaseSync/prepare/exec等已核实API，不假设24.12以后选项存在。

### D2 视觉与页面组织

中文名称使用“赛事工作台”；以办赛时的阶段顺序和来源到目标映射为视觉重点，避免全屏数字统计卡。
颜色变量：底色#F5F7FA、表面#FFFFFF、正文#172B4D、主操作#2458B8、警示#8A4B08、错误#B42318；状态同时有文字与图标。字体优先Microsoft YaHei UI/PingFang SC/Noto Sans CJK SC及系统sans-serif，字号14/16/20/28/36，数字表格采用tabular-nums，不远程加载字体。
公开页以赛事列表和筛选为主体；管理页为桌面224px侧栏、顶部赛事上下文、中心编辑区及可收起的诊断区。窄屏侧栏转顶部换行导航，字段转单列，诊断就地展开，表格独立滚动。基本信息和状态左对齐；阶段以顺序分区，小组嵌入阶段，池独立成区，避免将池画成比赛轮次。
不展示无数据依据的参赛总数、增长率或冠军；无可用统计显示原因而不是0。错误提示以业务中文开头，技术码/请求号置于可展开详情。无外部图像依赖，后续可替换品牌而不改业务组件。

| 页面路径 | 内容与主要操作 | 数据/权限 |
|---|---|---|
| /tournaments（/重定向） | 关键词、分类、分页、真实赛事列表、创建入口 | 公开目录；成功空态 |
| /series/:sid | 系列标题、说明、可见赛事 | 公开投影；私有仅所有者 |
| /tournaments/:tid | 概览、阶段、对阵、结果、报名入口 | 基础数据真实；运行模块501 |
| /login、/register、/forgot-password | 注册/登录；恢复服务状态 | 登录真实，找回501 |
| /me/profile | 用户名、显示名、退出 | 当前账号真实 |
| /me/tournaments?tab=created/managed/joined | 三个独立入口；系列管理入口 | 前两者真实，joined为501 |
| /me/series、/me/series/new、/me/series/:sid/edit | 我的系列、创建/修改 | 所有者真实 |
| /tournaments/new | 基本资料、可选自有系列 | 登录用户；真实创建 |
| /manage/:tid/overview | 赛事资料、配置列表、能力状态 | 所有者 |
| /manage/:tid/settings | 编辑信息、公开/隐藏基础信息 | 所有者真实；与开赛无关 |
| /manage/:tid/configurations/:cid/stages | 阶段/小组增删改 | 所有者；草稿可写 |
| 同配置下pools、routes | 池与排序、来源筛选、目标映射 | 所有者；草稿可写 |
| /manage/:tid/templates | 模板目录、说明、创建独立配置 | 所有者真实 |
| 同配置下validation、preview | 诊断定位、样例输入、分配报告、冻结确认 | 所有者真实 |
| /manage/:tid/registration | 报名、审批、候补/签到、个人/组队入口 | 501状态与操作说明 |
| /manage/:tid/matches、results、rounds | 对阵、赛果/逐局信息、整轮确认 | 501状态；无假比分表单 |
| /manage/:tid/sanctions、collaborators | 判罚/撤销、邀请/权限入口 | 501状态；不采集无用个人信息 |

公开详情tab用子路由stages/matches/standings；管理页面没有cid时首先进入配置选择页。模板实例为新配置，不自动覆盖已有草稿。全平台前端的交付定义是上述页面、导航、适用状态与操作反馈均完成；未实现领域的成功表单待契约开放后再启用，当前不是模拟业务系统。

### D3 必要后端的最小领域模型

SQLite数据库默认backend/.data/platform.sqlite，路径可配置，不在启动时清空；用schema_migrations记录顺序迁移版本。
- users：id、usernameKey唯一、displayName、passwordHash与salt/参数、createdAt。
- sessions：tokenHash、userId、expiresAt、createdAt；不存明文token。
- series：id、ownerId、name、description、version、createdAt/updatedAt。
- tournaments：id、ownerId、seriesId可空、name、game、description、location、startsAt可空、visibility、version、createdAt/updatedAt。runtimeStatus输出not-started，不允许客户端写。
- structure_aggregates：tournamentId主键、JSON聚合（显式序列化三个Map）；包含配置、快照、结构幂等记录。
- catalog_requests：actorId+requestKey唯一、操作/载荷指纹、结果；目录写入与请求结果同事务提交。

系列与赛事校验见TC1；系列名称使用同样1–100限制，说明至多2000。日期必须含时区，服务端校验真实日期后存UTC；前端使用用户本地时区显示并标明。game为card/fighting，具体游戏名暂不另增必填字段。可见性public只公开基础资料，不开启报名。公开系列页面可显示系列说明，这是公开旗下赛事时需在确认中说明的影响；公开赛事归属系列需同一所有者，禁止跨账号引用。

同一赛事可有多个配置，公共阶段摘要取最近冻结配置（按冻结时间再snapshotId排序），显式标注该配置名/ID与冻结时间；没有冻结则显示未公布。名称若结构契约没有该字段，使用配置短ID和模板来源作为标签，不把显示名写入领域payload。此摘要不公开任何预演输入、请求记录或完整冻结快照。多配置不是多个并行运行计划，不承诺已激活赛制。

空草稿使用{entrantKind:individual,structureVersion:structure-v1,routingVersion:routing-v1,stages:[],pools:[],routes:[]}；parseStructure允许空数组暂存。阶段/组无名称字段，界面以阶段order、小组序号和短ID标识，不擅自把name加入白名单。引用对象删除在parseStructure就被拒绝，前端先解释影响，由用户显式修改关联路由后再保存，不自动级联删除。
预设样例使用原始来源ID，templates.instantiate只返回重建ID后的结构，没有映射表。前端预演输入区提供“样例来源→当前阶段/小组”的显式选择，模板来源显示为四组A/B/C/D或阶段A/B等样例标签；不靠重建ID、数组位置或formatIntent猜映射。用户完成一对一映射后只重写sourceSnapshots中的sourceId，roster与战绩保持样例值；目标仍由当前配置决定。自定义JSON直接使用当前结构ID。映射不完整/重复时阻止请求；预演成功只证明用户所选映射与这份输入。开发测试的预期ID通过独立fixture映射替换，不调用被测算法产生分配预期。模板目录通过新增只读导出获取既有模板定义副本，不在前端维护第二份领域模板。

### D4 身份与授权

拟采用用户名/密码注册，参数约束见AC1；不新增邮箱验证或社会化登录依赖。此为本change设计选择，不追溯声称既有PRD已确认认证渠道。
密码使用异步scrypt、随机16字节salt，初始N=32768/r=8/p=1，maxmem明确设置为64MiB；参数随摘要保存，恒时比较；不存在账号执行等价派生以避免明显时序区分。登录发32字节随机token，数据库存SHA-256摘要。Cookie为HttpOnly、SameSite=Lax、Path=/、7天Max-Age；TLS时Secure，本地loopback HTTP例外。前端不使用localStorage保存凭据。
GET /auth/session返回{user:null}表示访客；其他私人接口无有效会话401。登录轮换当前token，退出删除记录并清cookie；不加入全设备撤销流程。显示名更新天然幂等，只能改当前账号。
所有写请求要求application/json（无body的退出例外）并验证Origin精确命中配置的应用来源；浏览器同源Fetch经Vite代理，开发环境明确允许5173来源。无Origin的写请求默认拒绝，CLI演示继续直接调用领域服务。GET不允许写状态。
登录/注册按来源IP共享15分钟20次请求上限，超过返回429与Retry-After；这是单进程最低防护，不宣称分布式防攻击。信任代理默认关闭，不直接信任X-Forwarded-For。
管理授权仅owner；注册账号不赋全局管理员。公开可读不表示可以读取配置。顺序：合法请求格式/大小→会话→资源可见性→操作权限→能力门控→领域校验/执行。私人资源对他人404、公开资源越权管理403；未实现操作在有权后返回501。未知资源/路由不被501吞掉。

### D5 接口与错误契约

前缀/api/v1；成功为{data,requestId}，分页data={items,page,pageSize,total}。写入结果以HTTP响应为准。请求键使用Idempotency-Key，预期版本在JSON expectedVersion；服务端不接受trustedContext/actorId/ownerId/role等身份字段。请求最大1MiB，超限413。输入未知字段拒绝，列表查询值非法400。配置payload保持现有structure-v1；sources保持现有roster/sourceSnapshots契约，样例不从业务名单推导。

| Method / Path（前缀省略） | 请求与成功结果 | 权限 |
|---|---|---|
| GET /health | 服务及数据库健康；故障503 | 公开，仅安全摘要 |
| GET /capabilities | key→{status,reasonCode,message}，契约版本1 | 公开；无身份资料 |
| POST /auth/register | username/displayName/password → 当前用户基础资料，201；不自动登录 | 公开，限流 |
| POST /auth/login | username/password → 用户，设置cookie | 公开，限流 |
| GET /auth/session；POST /auth/logout | 用户或null；退出{loggedOut:true} | 会话查询公开；退出可重复 |
| PATCH /me | displayName → 用户基础资料 | 当前用户 |
| GET /me/tournaments?relation=created或managed | 分页真实所有者赛事；关系joined见缺失表 | 当前用户 |
| GET /me/series；POST /series；PATCH /series/:sid | 列表；创建(name/description)；修改含expectedVersion | 所有者；写入请求键 |
| GET /series/:sid | 标题说明与可见赛事分页 | 可见性投影 |
| GET /tournaments；GET /tournaments/:tid | 分页公开目录；公开或本人详情 | 按可见性 |
| POST /tournaments；PATCH /tournaments/:tid | TC1字段；修改含expectedVersion | 登录创建，所有者改；请求键 |
| GET /tournaments/:tid/capabilities | 实现状态与该用户effectivePermissions分开 | 按赛事可见性 |
| GET /tournaments/:tid/stages | {availability,configurationId?,version?,items}，无冻结时no-frozen-configuration及空items | 按赛事可见性 |
| GET /templates | 两个模板的ID/version/说明及结构描述，不含样例身份 | 登录 |
| GET /tournaments/:tid/configurations | 配置摘要列表（版本、状态、来源、冻结时间） | 所有者 |
| POST /tournaments/:tid/configurations | {payload} → createDraft结果201 | 所有者；请求键 |
| POST /tournaments/:tid/configurations/from-template | {templateId,templateVersion} → 新配置201 | 所有者；请求键 |
| GET /tournaments/:tid/configurations/:cid | 完整配置及可选snapshot | 所有者 |
| PUT 同一配置路径 | {expectedVersion,payload} → replaceDraft结果 | 所有者；请求键 |
| POST 同一配置路径/validate | {expectedVersion,sources?,targetIds?} → 分层报告 | 所有者；只读计算 |
| POST 同一配置路径/preview | {expectedVersion,sources,targetIds?} → 分配/诊断报告 | 所有者；只读计算 |
| POST 同一配置路径/freeze | {expectedVersion} → snapshot | 所有者；请求键 |

返回校验报告的接口，语义不合法可作为成功计算的200报告并含structureValid=false/previewReady=false；请求格式错误与存储/权限异常仍为非2xx。保存解析失败或冻结静态失败为422。界面必须同时识别HTTP失败和200内的诊断，不能显示“HTTP200所以配置成功”。

缺失接口清单（显式逐项注册，不设置吞掉未知路由的通配501）：

| Path / Method | capability | 权限先决 |
|---|---|---|
| POST /auth/password-reset | passwordRecovery | 公开；只回501不发送邮件 |
| GET /me/tournaments?relation=joined | participation | 登录 |
| POST /tournaments/:tid/registrations | registration | 登录且赛事可见 |
| GET /tournaments/:tid/registrations | registration | 所有者 |
| POST /tournaments/:tid/registrations/:rid/approve、/check-in | registration | 所有者 |
| DELETE /tournaments/:tid/registrations/:rid | registration | 所有者；退出报名也未实现 |
| POST /tournaments/:tid/teams | teamRegistration | 登录且赛事可见 |
| GET /tournaments/:tid/matches、/standings | pairing、standings | 赛事可见 |
| POST /tournaments/:tid/start | formatRuntime | 所有者；RUN_NOT_SUPPORTED |
| POST /tournaments/:tid/matches/:mid/results | scoring | 登录且赛事可见；不生成结果，实际参赛权限待后续 |
| GET /tournaments/:tid/results | scoring | 赛事可见 |
| PATCH /tournaments/:tid/matches/:mid/results | scoring | 所有者 |
| GET /tournaments/:tid/matches/:mid/games | gameDetails | 赛事可见 |
| GET /tournaments/:tid/rounds；POST /tournaments/:tid/rounds/:rid/confirm | advancement | 所有者 |
| GET或POST /tournaments/:tid/sanctions；DELETE /tournaments/:tid/sanctions/:sid | sanctions | 所有者 |
| GET或POST /tournaments/:tid/collaborators；PATCH或DELETE /tournaments/:tid/collaborators/:uid | collaboration | 所有者 |

缺失表只验证父赛事和当前已知权限，不声称子对象或参赛关系存在；任何子ID仍返回能力不可用而不产生操作。未来实现必须新增子资源存在性、参赛关系与领域校验规格。报名候补、组队列表和退出报名若没有独立端点，入口共用对应能力错误页，不用不存在接口冒充实际功能。

统一失败示例：
```json
{"error":{"code":"FEATURE_NOT_IMPLEMENTED","message":"当前尚未提供赛事报名服务。","capability":"registration","requestId":"server-generated-id","retryable":false}}
```
映射：400 BAD_REQUEST；401 AUTH_REQUIRED/INVALID_CREDENTIALS；403 FORBIDDEN/ORIGIN_FORBIDDEN；404 NOT_FOUND；409 VERSION_CONFLICT/IDEMPOTENCY_CONFLICT/STRUCTURE_FROZEN/USERNAME_TAKEN；413 PAYLOAD_TOO_LARGE；422 INVALID_INPUT/CONFIG_INVALID；429 RATE_LIMITED；500 INTERNAL_ERROR；501 FEATURE_NOT_IMPLEMENTED/RUN_NOT_SUPPORTED；503 STORE_UNAVAILABLE（busy/暂不可写）或STORE_FAILURE（写事务失败）。fieldErrors为{path,message}数组，diagnostics保留领域原字段。错误响应带Cache-Control:no-store；所有私人响应no-store。服务端生成requestId，不信任用户请求号作为日志身份。未知异常脱敏记录，响应不包含SQL、stack或输入对象。

### D6 存储、并发与可恢复客户端

SQLite启用外键及WAL，使用prepared statements；迁移失败停止服务而不清库。一个进程一个数据库连接；事务callback内只执行同步读写，不跨await持有SQLite事务。新结构适配先BEGIN IMMEDIATE，再读取并克隆当前聚合、执行应用层operation、检查结果可序列化、写回三个Map与版本、COMMIT；全部处于同一同步事务，失败ROLLBACK。保留原Map中幂等键和指纹规则，不重新生成ID。写入完成但响应丢失时可按原键在重启后重放。禁止异常后偷偷换内存store。

元数据事务检查owner、expectedVersion及幂等记录；结构事务只修改本赛事聚合，不能连带更改运行状态或发布状态。SQLite全局写锁保证此交付边界，跨进程/服务伸缩不计入已验证能力。响应结果必须在commit前完成可序列化检查，避免提交后因JSON编码失败被误认为未写。HTTP传输断开属于结果未确认，靠幂等恢复，不回滚已经commit的数据。
页面请求客户端统一10秒超时与AbortController；路由/参数变化取消旧请求，并通过请求序号防止迟到响应。GET只提供人工重试，不无限轮询。写入发出后保存payload+requestKey+expectedVersion于当前页面内存；超时后显示“结果尚未确认”，人工重试同一请求；编辑载荷变化生成新键。刷新丢失在途信息时先重新读取服务器，不自动重发。
保存成功才重置dirty；409保留本地草稿，重新读取到独立serverSnapshot供比较，用户确认后替换。冻结后清空编辑权限，校验/预演仍可读。安全退出清理全部私人查询缓存和表单，密码永不持久化。离开或刷新提醒是丢失输入保护，不将其宣称为离线持久草稿。

### D7 验证与切片顺序

任务以tasks.md为唯一执行清单，依赖：基础契约/错误客户端 → 身份 → 赛事基础闭环 → 结构工作台 → 缺失模块覆盖 → 集成验收。各切片的关键行为先写一个失败测试、确认是行为失败、最小实现并通过，再下一个；必要重构在切片评审后进行。
- 后端：保留原26项领域测试，新增node:test HTTP测试（真实临时SQLite、随机loopback端口、注入时钟/故障），检查授权、Origin、重启、原子失败、幂等、每个501端点零副作用和404/501分流。
- 前端：Vitest+Testing Library测试表单、200诊断、错误分类、迟到响应、dirty/冲突/重试键与未实现模块。测试夹具仅在测试依赖中使用。
- 浏览器：Playwright测试真实服务与临时数据库：注册A/B→创建系列/赛事→公开可见性→模板→表单编辑→校验→四组预演→冻结→刷新→B越权拒绝→重启仍存在；逐页核对缺失模块501。
- 独立预期使用既有four-groups.expected.json、pool.expected.json，不调用被测路由生成器计算预期。手写错误矩阵验证全部错误类型；网络/500/坏响应与渲染异常只通过测试拦截/注入，不发布公开故障开关。
- 360/768/1440截图和键盘操作检查；直接路由刷新、浏览器前进后退、focus/dialog、窄屏表格、慢请求切换、401退出、404未知页；浏览器无未处理异常。
- 生产构建产物由同源Express静态服务验收一次；只将已知前端路径回退index，/api不回退。开发5173通过代理请求5000。启动默认loopback；没有自行部署。
- 完成证据记录：命令/退出码、用例结果、截图路径、独立评审结论和未完成范围。模拟样例通过不等于真实赛事验收或所有未实现后端已交付。

deterministic pairing本版仍无实现，不能新增任意配对算法；仅已有路由预演确定性受验。整轮锁定、判罚与两退出者淘汰冲突继续作为不可用边界，未来另设change冻结规则。

## Risks / Trade-offs

- [范围涉及多页面但业务引擎不足] → 每页映射真实能力或明确501，有单独验收任务；不可用页不计作其后端业务完成。
- [身份渠道和可见性是新增设计选择] → 文档明确用户名密码、私有默认与信息公开边界，等待规划出口审阅，不声称来自既有决定。
- [SQLite API在当前Node仍属实验性] → 锁定Node基线与少量已核实API，测试重启和失败事务；不自动升级机器运行时。
- [进程同步数据库及大量JSON结构阻塞] → 限制请求体1MiB、分页上限50，目标为单实例本地；规模/吞吐预算待实际需求。
- [501被空态或泛化错误掩盖] → 共用状态组件，逐端点和逐页面覆盖矩阵；允许用户展开原因/请求号并重新检查。
- [公开系列说明可能暴露草稿关联信息] → 只公开基础系列说明和公开赛事，展示发布影响；配置与报名从不由目录投影暴露。
- [把技术报错直接给用户] → 中文操作原因优先，码与requestId放详情，提供返回/登录/重读/等待等有意义动作。

## Migration Plan

本次仅规划，以下步骤均未执行：新增数据库迁移、前端及新API，不改变既有内存演示的存储含义。开发DB与测试临时DB分开，首次启动创建空库，不导入旧示例赛事或默认管理员。数据库与WAL/SHM加入忽略规则；部署/备份方案留实际发布前确认。
回退应用时保留数据库，不执行drop或删除用户数据；迁移记录不应由旧版降级覆盖。原型接口仍可独立运行，但不代表新平台回退可用。正式规格只在实现与验收后同步；本次不归档活动变更。

## Open Questions

没有用未决领域规则阻塞本版页面与错误契约：Q14/Q15/Q21/Q22-A/Q24-C/Q25/Q26/Q27和报名/组队/协作者细则全部通过相应unavailable能力显式隔离，未来启用前必须另行规划。实际生产域名、TLS终止、备份周期、并发规模和第三方身份提供商不影响本次本地验收，均未配置或承诺。
