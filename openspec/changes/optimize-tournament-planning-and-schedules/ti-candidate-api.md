# TI候选比赛协议（2026-10-12）

本协议已接入现有比赛HTTP与页面，但`ti2026-observed-candidate-v1`仍不在运行支持集。正常`POST /tournaments/:tid/start`返回501；计划可以保存、冻结和预约。测试在独立内存/临时SQLite中显式注入候选运行，不能作为完整报名导入、官方精确复现或正常启动已开放的证明。

## 比分和逐局记录

沿用`POST /tournaments/:tid/matches/:mid/results`提交和`PATCH`裁定。请求键与`expectedVersion`绑定赛事操作聚合版本；PATCH需要当前`results.edit`及非空reason。POST仅当前参赛者或具备当前报分权限的管理者可用，原成功请求缓存也在事务内重检资格；提交不等于裁定。

瑞士轮result为`{kind:"score",scores:[2,0],seriesId:"...",games:[{matchId:"...",winnerId:"...",durationSeconds:123},...]}`。系列与小局ID唯一，局胜者必须来自该比赛，时长为正安全整数；局数和胜者计数必须与BO3决胜比分一致，且不能复用此前确认的系列或小局。附加淘汰赛result仅为`{kind:"score",scores:[2,0]}`，其比分不会写入Swiss统计。

页面只要求比分、每局胜者、时长及裁定原因，不要求用户填写内部系列/局ID。新比赛采用稳定的比赛ID及局序号；恢复已有记录和明确采用服务器赛果时保留对应系列/局ID。支持查看各份提交的逐局记录并采用其中一份；管理员仍须填写自己的裁定原因。

版本冲突保留完整本地比分和逐局草稿，不将其与新服务器系列ID拼接。用户重读后可比较当前服务器赛果、明确采用服务器记录或重新裁定。提交前校验BO3、完整时长和逐局胜数；服务端仍是最终裁决。

## 确认和对手选择

候选`POST /tournaments/:tid/rounds/:rid/confirm`请求包含赛事`expectedVersion`、候选单元`inputVersion`/`inputHash`、reason。需要当前`rounds.confirm`、当前轮全部裁定与完整元数据。确认通过专用状态机推进，不能使用通用瑞士advance/finalize；确认后所有结果锁定。

前五轮完成后进入choosing-elimination。`POST /tournaments/:tid/units/:uid/ti-opponent`接受`expectedVersion,inputVersion,inputHash,chooserId,opponentId,reason`；操作者来自真实会话，不接受客户端actorId。按Swiss排名的下一名3–2队伍顺序选择剩余2–3对手，允许此前交手的对手。第5次选择后才生成附加赛5场BO3。

最终3直通加5胜者产生8个资格，按原Swiss排名排资格index，而不是截取Swiss前八。资格经实际编译连接进入下一阶段；本例使用明确观察槽位`[3,5,7,2,1,8,4,6]`衔接双败，不冒称通用官方TI种子表。

## 事务、时间和公开投影

逐场写入和actual-start均更新候选版本和全状态摘要。实际开始沿用现有接口，拒绝未来时间或覆盖不同已有时间；测试操作时间不充当历史实际开赛时间。

确认与选对手通过writePrepared在事务前计算，事务内再次复验聚合摘要、当前权限和版本；比分、下轮、资格、路由、时间复验及成功请求记录原子提交。旧输入、未齐结果、权限撤销和SQLite失败均不留下部分推进。相同成功键由仍获授权者回放，不重复生成轮次；不同内容同键409。

公众runtime和schedule投影删除账号userId及提交/裁定/轮次确认/对手选择/完赛确认的actorId。逐局记录从当前runtime的提交、裁定和confirmedSeries读取；不宣称通用`matches/:mid/games`接口已交付。

## 尚未开放

正常启动、完整reference-unit导入、官方公式/优化算法/种子映射及选择和coin动作证据、TI人工coin和多解配对操作仍未完成。因此0.3、7.2、10.2、四案例终验保持pending，不修改runtimeReady声明。
