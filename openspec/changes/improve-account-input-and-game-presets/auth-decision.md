# 认证兼容性决策（任务1.1）

核验日期：2026-10-05。依据本变更research.md、引用对话中的候选建议及当前代码。范围为决策材料；未接入外部提供方、未迁移身份。用户已确认密码非空且无产品长度/复杂度策略，本次保留本地认证。

## 兼容矩阵

| 边界 | 当前本地认证 | Supabase Auth | Auth.js / Express |
|---|---|---|---|
| username | ASCII用户名小写判重，不要求联系方式 | 官方密码入口使用email或phone，username不能直接替代；需确定映射且不得擅自收集邮箱 | Credentials可接收username/password，但authorize由应用实现 |
| 密码策略 | 非空原样，无长度或组合要求；1MiB请求边界和限流 | 有可配置最短/复杂度策略；具体托管/自托管配置是否接受1字符未实测，不能认定兼容 | 可在authorize中复用本地校验；库不代替注册、密码派生或恢复流程 |
| scrypt摘要 | 每账号保存salt、64字节摘要及N/r/p/maxmem参数 | 官方迁移文档列bcrypt/Argon2导入，未列当前scrypt结构；不可直接上传现有JSON宣称无损迁移 | 可调用现有hash并读取旧参数；Credentials身份不由库自动写入数据库 |
| ownerId | UUID作为赛事/系列/配置所有权依据 | 必须建立外部subject到原本地UUID的一对一服务端映射；不以用户可编辑元数据授予权限 | authorize返回身份仍需映射到原UUID；不以provider新ID批量替换ownerId |
| 会话/退出 | 服务端SQLite令牌摘要，HttpOnly/SameSite cookie；7天到期、轮换/撤销 | access/refresh令牌需另设计适配；旧cookie不自动转换，断网与退出撤销另验 | JWT或数据库会话策略须确认；旧令牌撤销、退出契约及401处理仍需适配 |
| CommonJS | Express5 + Node24，backend type=commonjs | HTTP服务客户端可隔离，但本次未安装SDK或验证准确版本 | @auth/express 0.12.3的包type=module且官方说明ESM-only；不是CommonJS直接替换 |
| 服务依赖 | 本地进程与SQLite；本地认证不依赖外部网络 | 托管需远程项目/配置；自托管需额外Auth服务与数据库运维。邮件恢复需SMTP | 库运行于自有服务；Credentials可保持本地，OAuth则依赖外部渠道及配置 |
| 迁移与恢复 | 本次不改ID、算法或旧参数；临时旧账号重启已验证 | 不可从摘要还原明文；候选为用户再次认证后的受控迁移或独立恢复流程，必须先冻结规格 | 可渐进适配，但Express集成仍标experimental；需完整兼容/失败测试后再批准 |

表中“需”“候选”为项目推断与未来门槛，不是提供方已接入结论。短密码更容易被猜中是已接受取舍，保留既有请求资源上限、限流与会话保护，不以供应商默认策略恢复已取消的限制。

## 官方出处与实际核验

- [Supabase密码登录](https://supabase.com/docs/guides/auth/passwords)：email/phone入口与SMTP恢复依赖。
- [Supabase密码策略](https://supabase.com/docs/guides/auth/password-security)：可配置最短字符数、复杂度和泄漏检测；不推断本项目目标配置已可用。
- [Supabase迁移文档](https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0)：导入摘要支持bcrypt/Argon2；据此判断当前scrypt导入没有已核实路径。
- [Auth.js Credentials](https://authjs.dev/getting-started/providers/credentials)：任意凭据与外部/已有用户体系的authorize接口；身份不自动持久化。
- [Auth.js Express](https://authjs.dev/reference/express)：experimental及ESM-only，不能套用官方示例改变本项目代理信任设置。
- [Auth.js会话策略](https://authjs.dev/concepts/session-strategies)：JWT与数据库会话的差异。
- 本地实际命令：npm view @auth/express version type exports --json，返回0.12.3/type=module；backend/package.json为commonjs。仅查询，未安装。
- 当前实现与证据：backend/src/platform/auth/accounts.js、sessions.js；evidence/password-backend-tests.txt中旧参数/身份重启与会话回归；password-browser-tests.txt中真实注册登录。第三方兼容不是运行验收。

## 决策与未来迁移门槛

本次沿用本地账号/会话；Supabase/Auth.js留作候选，不选择或开通供应商，不宣称第三方登录/恢复可用。迁移必须另建change并取得明确授权，冻结登录标识、密码政策兼容、旧账号关联/重复冲突、原ownerId映射、会话失效/退出、断网失败和恢复入口。

实施前用隔离账号与赛事演练：旧用户登录、短/长/Unicode密码、A/B所有权、旧会话撤销、供应商不可用、迁移中断重试与回退；核对所有权/幂等/冻结快照不变。未知的Supabase目标配置和CommonJS桥接须实际验证，不把这份矩阵当迁移通过证据。