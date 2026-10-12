# routing-v2具名连接（任务3.2，2026-10-09）

source/target引用新增可选port，v1仍拒绝此字段。来源支持rank、qualification、upper、lower；池输出仅seed。默认旧式阶段来源为rank。目标双败默认upper并可显式lower；普通目标seed或slot是同一容量的两种落位解释，不能同组混用。池输入没有port。未知端口、超出各端口容量、重复目标席位、来源范围重复消费在保存前422拒绝，版本/请求成功记录不改变。

rankRange在rank出口表示竞技名次，在qualification/upper/lower表示通道内资格序号，在池seed表示poolSeed范围。同一来源端口范围不重叠；upper/lower有独立资格前沿与席位。Q>1淘汰资格集合没有唯一竞技名次，须使用资格通道，不改写成rank。recordEquals只用于rank。跨出口视图是否重合无法静态判定时明确conditional，预演复核真实身份。

sources.sourceSnapshots.entries新增可选qualification:{channel,index}，channel为qualification/upper/lower、index从1开始且同来源通道唯一。v2竞技rank可缺省；仅有资格者不伪造rank，sourceRank排序缺值会明确阻塞。泛qualification对双败前沿按upper1、lower序号+1展开。sourceSnapshots的completed/version、名单唯一种子及成绩profile继续校验。

POST /:cid/preview 的targetIds表示这次共同启动的活动目标集合。池链保留原始身份/来源/种子，先校验池全量输入，再逐输出消费，最后跨整个目标集合检查身份。任何错误previewReady=false、allocations/excluded=[]，没有部分下游。allocation明确target.port、positionKind/value、initialLosses；lower为1，与实际败数分开。此API只预演，不创建runtime。

显式路由slot可以不同于阶段默认seed：路由落位是绑定规则，默认种子只定义没有显式路由的入口。编译inputs列出placementPorts=seed/slot；它们不是额外两份容量。运行任务3.3将绑定位置转换到编译输入；同端口禁止混用。双败upper/lower有分别的容量，不能用总人数给lower补虚构席位。

冻结plan新增connections，稳定route key绑定unitKey或poolId、端口、selector/quota/sort/placement；内部winner与loser是互斥出口各有有效feeder。编辑即时连接提示与明确替换的完整UI属8.3，实际名单/启动衔接属3.3，不将预演称为已经运行。

## 验证与评审
158/158后端、44/44真实Edge兼容回归通过，证据evidence/routing-v2-backend-final.log、routing-v2-browser-final.log；先前73前端单元与build/typecheck通过。本任务新增8领域测试和3真实HTTP测试，包括重复名额拒绝原子性、4个lower来源、upper/lower独立输出及内部胜败、池链跨目标重身份归零、池序号分段、资格无rank排序阻塞。
全回归首次因错误限定slot必须同默认seed出现15失败，原日志routing-v2-backend-red.log保留；定位既有slot路由后修正，不改原测试期望。合法JSON孤立Unicode码元的planKey编码亦红→绿修复；编码先JSON转义内容再URI编码，避免异常与身份碰撞。

独立消费核验第一次读到错误change的旧PR3，结果仅作为代码线索，不算本PR5规格核验。新探子pr5_exact_spec_check亲读正确PR5返回complete，未发现领域/API阻断。保存兼容核验返回partial；其参数不完整可apply疑问依据1.1既定草稿规则不采纳，冻结仍复验拒绝，不是路由绕过。没有提交、部署或归档。
## 2026-10-09 单败实际运行更新
3.3/4.1/4.2已验收，single-cut-v2已开放实际运行；新目录及冻结报告runtimeReady=true。旧冻结字段不重写，启动按冻结计划和规则复核。入口与操作见entry-runtime-guide.md，完整证据见acceptance-entry-single.md。
