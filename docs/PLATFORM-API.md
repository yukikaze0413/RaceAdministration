# 平台 API 与错误目录

实现版本：2026-10-05（账号密码切片）；其他接口沿用2026-10-04。新接口前缀 `/api/v1`。成功结果 `{data,requestId}`；失败 `{error:{code,message,requestId,retryable,...}}`。能力清单状态值为 `implemented/unavailable`，未知能力默认关闭，能力与实际权限分别表达。结构与预演规则版本固定为 structure-v1 / routing-v1；支持保存六类意图，真实运行支持集为空。

## 使用约束

- 注册和登录密码仅要求非空字符串，不设产品最短/最长字符数；不trim、不截断、不规范化，Unicode与空格原样参与scrypt。空值/非字符串注册422（/password字段错误），登录401统一凭据错误。整个JSON请求超过1MiB仍413。旧账号沿用保存的salt、摘要参数和用户ID。
- 账号为本地用户名/密码；会话恢复与退出使用服务端 cookie，不使用 localStorage 凭据。
- 写请求需 application/json 及允许的 Origin；退出可无 body。无 Origin 的写请求403，不自动信任 X-Forwarded-For。
- 注册/登录共享每来源IP 15分钟20次限额；429含 Retry-After。Cookie固定7天，登录轮换、退出撤销。
- 私人接口无会话401；其他账号访问私有赛事404；非所有者管理公开赛事403。任何客户端 actorId/ownerId/role/trustedContext 不授予权限。
- 最大 body 为1MiB。创建/编辑/冻结/模板要求 Idempotency-Key；同键异载荷409。修改/校验/预演/冻结的 expectedVersion 必须匹配当前版本。
- 私人和新 API 响应禁止缓存；未知异常日志仅保存请求号、状态、错误码，不输出密码、token、SQL、堆栈或私人输入。
- SQLite启用外键/WAL。目录结果、结构版本/快照与成功请求记录分别在事务内提交；失败回滚，不降级内存。默认库为空，旧原型记录不迁入。
### D5 接口与错误契约

前缀/api/v1；成功为{data,requestId}，分页data={items,page,pageSize,total}。写入结果以HTTP响应为准。请求键使用Idempotency-Key，预期版本在JSON expectedVersion；服务端不接受trustedContext/actorId/ownerId/role等身份字段。请求最大1MiB，超限413。输入未知字段拒绝，列表查询值非法400。配置payload保持现有structure-v1；sources保持现有roster/sourceSnapshots契约，样例不从业务名单推导。

| Method / Path（前缀省略） | 请求与成功结果 | 权限 |
|---|---|---|
| GET /health | 服务及数据库健康；故障503 | 公开，仅安全摘要 |
| GET /capabilities | key→{status,reasonCode,message}，契约版本1 | 公开；无身份资料 |
| POST /auth/register | username/displayName/password → 当前用户基础资料，201；不自动登录 | 公开，限流 |
| POST /auth/login | username/password → 用户，设置cookie | 公开，限流 |
| GET /auth/session；POST /auth/logout | 用户或null；退出{loggedOut:true} | 会话查询公开；退出可重复 |
| PATCH /me | displayName/username/avatar，用户名改变验证currentPassword → 用户基础资料 | 当前用户，限流 |
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


## 前端恢复对应表

| 分类 | 用户行为 |
|---|---|
| 400 / 413 / 422 | 修改格式、缩减输入或定位字段/诊断；不呈现成功 |
| 401 | 清理私人视图并站内返回登录；旧账号迟到响应不清理新会话 |
| 403 | 保留赛事上下文与权限原因，不解释为能力未实现 |
| 404 | 说明不存在或不可见，提供目录/返回入口 |
| 409 | 保留本地内容，重读独立服务器版本，确认后才替换 |
| 429 | 显示等待秒数；等待结束后人工重试 |
| 500 / 503 | 安全中文说明与请求号；手动重读或原键重试 |
| 501 | 保留模块用途、不可用原因和重查/返回入口，不采集无法保存的私人输入 |
| NETWORK_ERROR / TIMEOUT | 结果未确认；不自动重发写操作，原键人工重试 |
| BAD_RESPONSE | 说明响应格式异常并人工重查，不把 HTML 当空集合 |
| RENDER_ERROR | 页面错误边界，提供重试，路由切换可恢复 |
| HTTP200 + 诊断 | 报告有效性由 structureValid/previewReady 决定，不用 HTTP200 代替业务成功 |

## 未实现端点覆盖证据

缺失表中22个赛事 Method+Path均由真实 HTTP 测试遍历。公开读取不要求登录；其余访客401。私有赛事对他人404；公开赛事管理对他人403；合法调用501。所有调用前后的 users、series、tournaments、structure_aggregates、catalog_requests 完全一致。密码找回和 joined另有API/浏览器验收。子ID仅用于能力门控，当前不声称存在相应报名/比赛/处罚对象；不会创建模拟子资源或成功幂等记录。

健康检查仅返回服务与存储状态。旧 `/api/races`、`/api/test` 保持独立原型契约，旧错误处理与新API分开。
## 日期时间契约（2026-10-05）

赛事startsAt仍为可选带时区ISO8601字符串或null；成功读写统一返回UTC ISO（包括毫秒）。例如2026-10-05T10:30:00+08:00保存为2026-10-05T02:30:00.000Z；2026-10-04T23:45:00-04:00保存为2026-10-05T03:45:00.000Z。PATCH省略startsAt保持原值，显式null清空。格式缺少偏移或不存在的日期返回422，fieldErrors定位/startsAt，不写赛事/成功请求记录。

前端偏移选择是固定UTC偏移，默认+08:00，范围-12:00至+14:00、15分钟增量，不是带夏令时的地区时区；切换偏移不改变UTC时刻。日期未编辑时发送原startsAt，不丢失历史毫秒；保存409时保留本地日期及偏移，只有显式确认重读才替换。它不增加自动排程、外部日历或开赛能力。

## 游戏预设与旧数据兼容（2026-10-06）

GET /api/v1/games 公开只读，返回 {schemaVersion:1,catalogVersion,items}。首批游戏为 street-fighter-6（街霸六/fighting）和 shadowverse（影之诗/card）。影之诗统一入口包含九个独立职业ID与独立neutral类别；死灵shadowcraft、吸血鬼bloodcraft、梦魇nightmare并列。status=preset-ready仅表示预设清单可用；resourceCatalogVersion=pending表示素材未完成，runtimeFormats=[]。

POST/PATCH /tournaments 增加可选gameId。选择预设时分类由服务端派生，创建可省略game；同时提供不一致game返回422并定位/game，未知gameId返回422并定位/gameId。PATCH省略gameId保持原游戏，null清空并保留原分类；若仍有已知游戏，单独提交矛盾分类也拒绝。历史未知游戏ID仍可读，编辑其他字段时省略gameId保留；不能把未知ID当新预设写入。

GET /tournaments 支持gameId=street-fighter-6、shadowverse或unspecified（只用于查询，不能保存）。与game分类、关键词按交集筛选，再排序分页，只含公开赛事。未知筛选ID返回400；gameId为空字符串也不是合法查询值，全部游戏应省略参数。

旧JSON缺gameId读取投影补null，不批量猜测、不重写旧JSON/历史成功请求记录或原请求指纹。成功请求仍按原始载荷生成指纹；旧键/旧载荷可回放，改变载荷需新键。gameId属于赛事基础资料，不修改structure-v1/routing-v1、配置版本或冻结快照。

迁移与回退：本次没有数据库表迁移，先备份实际非临时库，部署支持gameId的服务端再提供新界面。回退前保留带gameId的库与请求历史备份；旧客户端仅认识分类，旧服务端会拒绝新客户端gameId/游戏筛选。两端需配套回退，账号表单继续保留已取消的密码长度策略。本轮回退核验覆盖临时旧记录的兼容读取/编辑，没有执行生产数据库恢复。资源详情/API及头像、插画、图标仍属第5组，不代表已交付。

## 手机验收修订与账号安全（2026-10-06）

创建/编辑流程按基本信息、比赛项目、时间与地点、归属与公开分组；分类先筛选游戏，最终gameId仍由服务端派生分类。日期主要显示分钟、时区默认北京时间；UTC及旧秒/毫秒保存精度不变，今天/此刻使用所选偏移的墙上时钟。

POST /api/v1/me/password：已登录，JSON {currentPassword,newPassword}，两者非空原样字符串。正确旧密码后事务更换salt/摘要，保留用户ID和所有权，撤销全部session，响应 {passwordChanged:true,requiresLogin:true} 并清cookie。错误当前密码422 /currentPassword，空新密码422 /newPassword；凭据竞争409，匿名401，Origin拒绝403，纳入20次/15分钟429限流。密码/摘要不出响应和日志；在途旧密码登录也不能创建session。主动退出沿用POST /auth/logout。邮件找回和永久账号删除尚未实现，不把退出称为删除。

普通HTTP局域网客户端使用getRandomValues生成v4幂等键，不依赖仅安全上下文可用的randomUUID；生成失败解除busy并提示。实际手机预览同时核对/games200和保存/刷新，不只运行临时localhost测试。修改后端源码需要更新常驻服务，当前本地预览使用node --watch；保持精确同源Origin白名单，不删除或重建SQLite。

## 账户资料与永久注销（2026-10-06）
公开 User 为 {id,username,displayName,avatarUrl}，旧用户 avatarUrl 为 null；id 是不可变 UUID，用户名变化不改变 ownerId。
PATCH /me 支持可选 displayName、username、currentPassword、avatar，至少一个资料字段。displayName 沿用1–40 Unicode码点且非空白；username 沿用3–32 ASCII字母数字下划线并转小写判重，实际改变时必需正确 currentPassword。avatar 为 null（移除）或 PNG/JPEG/WebP Base64 data URL，二进制<=256KiB、解码<=4194304像素，拒绝损坏、多页及SVG；服务器转256×256 WebP去元数据。前端允许<=10MiB原图，先裁切压缩再上传；不放宽整个JSON1MiB限制。失败不写入，用户名重名409 USERNAME_TAKEN，凭据/会话并发改变409 CREDENTIAL_CHANGED。
GET /me/deletion-preview 返回 {counts:{sessions,series,tournaments,configurations,snapshots,catalogRequests},token}。DELETE /me 接受 {currentPassword,confirmation,expectedToken}，confirmation为当前用户名。错误密码/确认422，范围变化409 DELETION_CHANGED，历史跨账号系列/冻结者/配置请求引用409 RELATED_DATA_CONFLICT；错误时不能部分删除。事务删除当前账号所有会话、目录请求、自有赛事聚合（配置/冻结快照/配置请求）、赛事、系列和用户资料（含头像/凭据）；保留其他用户，清cookie，返回{deleted:true}。改资料和注销均要求有效当前会话、精确Origin/JSON，并纳入20次/15分钟每IP认证限流。重试删除若已经成功可能返回401，不以错误响应声称删除完成。退出登录独立保留，不删账号。

账户删除范围补充（2026-10-07）：预览及事务赛事删除均按当前tournaments.ownerId=user.id，创建默认ownerId=currentUser.id；历史创建者字段不扩大删除范围。已归其他账号的赛事及其聚合保持原样。此轮只澄清并验证现有所有权语义，不增加转让API。账户UI先只读总览，再按动作打开输入/确认弹窗。
