# 3.3 / 4.1 / 4.2 验收记录

实际HTTP覆盖审批入口命名空间、重复席位、锁名单完整性、撤权后重放、事务故障回滚、版本竞争、成功请求重启回放。缩小混合入口HTTP示例为两组4人各晋级2人，再与4位直邀组成8人单败；目标等待两个来源完成，共11场。

独立32身份领域示例为16位初始参赛者、第二阶段8位直邀、第三阶段8位直邀：16→8、16→8、16→1，共31场，所有身份唯一。这是入口契约工程示例，不冒称科隆官方复现。

单败实际运行验算8→4=4场、8→1=7场、12→3=9场、有季军战8场；每场BO从冻结计划读取。季军战决赛分别BO1/BO7，360/768/1440真实Edge完整录分确认及刷新，截图已由主代理查看。资格集合与实际名次分开显示，父级赛事状态随确认刷新。

评审：single_runtime_slice_review完成，无单败阻断。entry_namespace_auth_review提出缺placement可能进入锁名单异常；主代理复现表明CONFIG_REQUIRED已阻止编译冻结，已补领域回归。审批配置异步切换另由主代理复现按钮错误启用，entry-config-race-red.log记录红测，修复后纳入全Edge回归。

证据目录：entry-single-backend-final.log（177/177），entry-single-frontend-final.log（73/73），entry-single-build.log（tsc与生产构建），entry-single-browser-final.log（最终完整Edge）；此前单败资格集合与三宽度季军战绿测分别见entry-single-browser-green.log、single-third-browser.log。所有HTTP/浏览器使用临时SQLite，无用户数据库、部署、提交或归档操作。
