# Tasks

## 1. 可保存并读取个人赛事结构草稿

- [x] 1.1 在backend/src/tournament-configuration建立structure-v1契约和解析边界，实现个人草稿与稳定对象引用；逐行为红→绿覆盖TS1三个场景（PRD R05/R07），用非法类型/跨赛事/重复ID输入验证拒绝且旧状态不变。
- [x] 1.2 实现application的可信授权端口与单进程内存仓库，覆盖TS2（PRD R04）；验证view/configure区分、跨赛事拒绝、载荷伪造角色无效及读取深拷贝，使用node --test test/tournament-configuration/structure.test.js。
- [x] 1.3 为本切片添加backend/examples/tournament-configuration/README.md与个人多阶段草稿样例，注明未开赛/非HTTP/进程内存限制；核对示例可被解析并覆盖TS1/R05，切片评审后必要重构并运行structure.test.js回归。

## 2. 模板复制与可定位静态校验（依赖1）

- [x] 2.1 实现版本化模板实例化和内部ID引用改写，覆盖TS3（R07）；测试双实例隔离、未知版本失败和同requestKey重试不重复创建，并交付四组分流与池重排两个structure-v1结构模板。
- [x] 2.2 实现DAG/order/容量/quota/位置与引用校验，覆盖CV1和PR2的配置边界（R05/R07）；用E7循环、6人入4槽、重复slot、seed/slot混用、同源重叠与pool前置种子输入断言稳定code/path及无部分状态，运行validation.test.js。
- [x] 2.3 实现CV2/CV3分层报告和六类formatIntent支持声明（R06/R07）；验证无来源时structureValid=true但previewReady/runtimeReady=false，Major模板只给结构结论，真实配对请求明确RUN_NOT_SUPPORTED。
- [x] 2.4 文档化字段白名单、错误码、conditional限制与模板版本；验证模板样例静态通过且FORMAT_RUNTIME_UNAVAILABLE仍可见，非法配置输出具体路径；切片评审后运行templates.test.js和validation.test.js相关回归。

## 3. 模拟来源筛选与固定落位预演（依赖2）

- [x] 3.1 实现来源roster与完成快照校验，覆盖CV4/PR3（R05/R07）；验证负战绩、重复初始种子、未完成/缺来源、缺必需排序值及非法退出状态均阻断，输入不变，运行routing.test.js。
- [x] 3.2 实现rankRange/recordEquals筛选、显式全序和固定名额，覆盖PR1（R05）；独立手写3–0的p/q/r→p/q预期，并测试并列未破错误、数组置换结果一致及跨规则积分拒绝，预期不得调用被测生成器。
- [x] 3.3 实现stage/group的seed/slot映射及多目标聚合，覆盖PR2/PR3（R05）；手写E6四组冠军a/b→B seed1/2、c/d→C slot1/8预期，验证跳阶段、映射数量/越界、同目标阶段两组重复身份及名额不足不返回部分allocations。
- [x] 3.4 保存本切片输入与独立expected JSON，文档化筛选→排序→截取→落位和来源版本；执行routing.test.js验证E6/E7相关正常/异常场景，切片评审后必要重构及该切片回归。

## 4. 池重排与退出状态延续（依赖3）

- [x] 4.1 实现完整上游闭包、池全量合并/去重复检查/排序及连续新种子，覆盖PR2（R05）；独立A/B来源优先级算例断言poolSeed1/2且保留initialSeed/sourceRank，测试上游缺失、池超容和排序不可比，运行pool.test.js。
- [x] 4.2 实现PR4（R10/R05约束）的active/withdrawn/disqualified原样传递与只读预演；验证DQ冠军仍分配、重复预演一致且无赛果/处罚/阶段输入写入，不计算退出比分或解决Q24-C。
- [x] 4.3 添加池与DQ输入/expected样例及状态说明，核对预演输出能追溯来源、原种子和池种子；切片评审后运行pool.test.js、routing.test.js，验证预演失败时输入与存储均未改变（CV4）。

## 5. 结构冻结、幂等与并发（依赖2；预演闭环依赖4）

- [x] 5.1 实现TS4（R05/R07）冻结状态转换与不可变结构快照，冻结内部复验静态错误并保留conditional/info；测试合法冻结、非法冻结失败、冻结后保存/改路由/解冻拒绝、未开赛及runtimeReady=false，运行freeze.test.js。
- [x] 5.2 实现TS5（R07可靠性约束）expectedVersion及全写操作幂等契约；测试编辑vs冻结、双冻结、同键同请求重试、同键不同请求、不同键重复冻结、响应丢失后重试，断言只生成一个快照且无旧版本覆盖。
- [x] 5.3 用仓库故障注入验证TS5原子性：写入快照/状态/幂等任一步失败全部回滚；验证失败重试可成功、权限撤销后重试仍被拒绝、只读报告版本不替代冻结复验。
- [x] 5.4 在文档中保存状态转换表、single-process边界和未来持久化适配要求；运行freeze.test.js确认上述行为，切片评审后必要重构并执行结构/模板/预演相关回归。

## 6. 本地闭环演示与集成验收（依赖1–5）

- [x] 6.1 实现backend/scripts/tournament-configuration.js的validate/preview/demo入口，输出与应用契约一致的JSON及exit code；验证授权样例显式创建、合法结构/非法结构/四组路由/DQ/冻结后改路由场景，脚本不挂载生产HTTP或写真实比赛。
- [x] 6.2 在backend/package.json配置有效业务test脚本与演示用法，在README和examples文档说明命令；按文档实际运行node --test test/tournament-configuration/*.test.js与validate/preview/demo，并确认每个业务切片的测试已随切片完成而非此时才补。
- [x] 6.3 使用手写expected JSON集成核对R05/R07与TS1–TS5、PR1–PR4、CV1–CV4覆盖：草稿→模板→校验→预演→冻结→拒改，全程runtimeReady=false；确认旧业务API未被本模块接管，模拟赛果/配对/轮次推进仍无实现。
- [x] 6.4 执行整切片评审及相关回归，保存实际命令、结果和限制到change内handoff.md；业务接受、独立评审（若发生）、同步规格/归档和提交分别记录。不能将计划勾成完成，不自动推送或部署。
