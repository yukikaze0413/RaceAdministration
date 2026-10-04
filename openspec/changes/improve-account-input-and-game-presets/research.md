# 成熟能力与游戏资源调研

记录日期2026-10-05；只读研究，未安装依赖、接入提供方或下载图片。引用对话01a10857-8f97-78e2-87df-deb2afe3be9c已读，只有“成熟方案有哪些”的咨询，未批准某一供应商或账号迁移。

## 已观察的项目

- frontend/src/features/account.tsx:124–133：注册minLength=12，登录/注册maxLength=128，提示12–128位。
- backend/src/platform/auth/accounts.js:37：注册12–128 Unicode码点；sessions.js:50：登录还有1024个UTF-16单元上限。取消限制须覆盖两端，不只删除注册文案。
- frontend/src/features/catalog.tsx:397–400：当前日期字段是普通文本input，要求手写时区ISO；列表/详情按浏览器时区显示。
- 后端catalog.js校验startsAt含偏移并转UTC；game为card/fighting，尚无gameId或游戏素材目录。SQLite通过JSON保存资料，需兼容缺少新增字段的旧数据与历史幂等返回。
- 当前React19.3/Vite8.3/Express+Node SQLite、自有scrypt账号和HttpOnly会话。两个探子因Windows工具初始化失败未获得证据，不计作独立核验；上述由主代理亲读。

## 通用能力来源

| 能力 | 官方来源 | 已核实结论 | 本轮处理 |
|---|---|---|---|
| 认证服务 | [Supabase密码登录](https://supabase.com/docs/guides/auth/passwords)、[Auth配置](https://supabase.github.io/auth/) | 默认密码体系以email/phone关联身份；自托管最短长度默认6，不能假定现有username体系与取消长度策略直接兼容 | 候选；需评估身份映射、密码策略、现有摘要与会话迁移，不直接切换 |
| 认证库 | [Auth.js Express](https://authjs.dev/reference/express) | 有官方Express集成，但目前标记experimental；不是无需实现自有密码校验的托管服务 | 候选；需检查CommonJS/ESM、当前Express版本、会话与失败契约，不自动启用 |
| 日历时间输入 | [Ant Design DatePicker](https://ant.design/components/date-picker-cn/) | 支持日期/时间、中文locale、清空、禁用规则和面板API；默认英文，需配置antd与dayjs的中文locale | 计划优先小范围接入并验证React19兼容、键盘/360宽度与体积；不是外部日历网络API |

认证选型不是本次实施出口的供应商集成要求；先产出具体评估结论，实际迁移需要独立账号迁移规格。不因接入供应商偷偷恢复密码最短策略。密码取消长度是用户明确决定，仍保留非空、scrypt原样哈希、限流及现有1MiB请求体限制。

## 游戏素材来源台账

| 游戏/实体 | 来源 | 已核实范围 | 当前缺口 |
|---|---|---|---|
| 街霸六 | [官方角色入口](https://www.streetfighter.com/6/character)、[Ryu候选入口](https://www.streetfighter.com/6/character/ryu) | 本次web访问403；仅作为待核实入口，不宣称已读到人物内容或图片地址 | Ryu及第二名角色头像/立绘具体文件、用途、尺寸、分发依据待取得；不得用街霸五资料替代 |
| 原版影之诗目录 | [官方卡片目录](https://shadowverse.com/cards/)、[繁体中文Portal](https://shadowverse-portal.com/cards?lang=zh-tw)、[官方游戏说明](https://shadowverse.com/gameguide/) | 有原版卡包、八职业及中立筛选，Portal有繁体中文资料入口；不是已证明的可依赖公共REST API | 职业图标实际文件和中文展示映射待核实；中立不计作第九职业 |
| 原版卡片101111010 | [精靈女孩‧小梅](https://shadowverse-portal.com/card/101111010?lang=zh-tw) | 页面可读取，职业精灵、经典卡，提供进化前后卡图；来源语言zh-tw | 卡图的具体可发布引用、头像缩略用途与独立无背景立绘未核实；第二张卡另核实 |

影之诗版本问题已向用户提出，暂用原版作规划假设，不代表用户已确认；Worlds Beyond必须单独预设，不能沿用原版职业表。素材状态：metadata-verified只表示实体资料，asset-ready需要核实具体文件；pending/missing不能伪装已集成。

实施前的针对性资源工作：定位街霸六至少两名角色（优先Ryu、另一名由可核实素材选择）的头像与立绘；原版影之诗至少两张带稳定卡ID的卡图与头像、八职业图标，单独记录无法取得的无背景立绘。每个文件需来源页面、用途/裁切方式、版本、获取日期、尺寸、内容指纹、分发说明。此处不建立“完整角色/全卡库”的承诺，也不自动抓取或假定图片链接永久有效。