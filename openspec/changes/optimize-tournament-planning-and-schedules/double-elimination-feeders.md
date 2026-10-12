# 双败独立手算表（任务0.4，独立核验完成，2026-10-09）

这是平台de-standard-v1/de-lower-entry-v1的选择，不声明为所有赛事统一标准。W/L表示真实比赛胜者/败者。相同来源的胜负为互斥身份。每个wave为依赖最大深度，同wave不出现同一条可能的真实身份路径；多个互斥来源的集合交集不能被误判为同时参赛。

## 固定规则
UB采用recursive-v1种子表。LB初始邻接合并UB首轮败者；第r个UB轮的drop列表在长度>1时相邻交叉（index xor 1），长度1保持；drop后若不是最终UB轮，再邻接consolidation。Q3在最后drop之前停止，输出UB冠军、LB上一轮幸存者、UB决赛败者；Q2完成最后drop，输出两个通道冠军；Q1再GF。
额外L=N/2先逐位与UB首轮败者打接入，再邻接合并；L=N先recursive种子预选N→N/2，胜者逐位接入UB首轮败者，再邻接合并。预选与UB首轮同wave。直入LB初始败数1，但实际败数0。

## N=4
UB：A=(U1,U4)，B=(U2,U3)，C=(WA,WB)。
L=0：D=(LA,LB)。Q3输出WC/WD/LC；Q2补E=(WD,LC)；Q1补F=(WC,WE)。
L=half=2：D1=(LA,L1)，D2=(LB,L2)，D=(WD1,WD2)，随后与L=0相同。
L=same=4：P1=(L1,L4)，P2=(L2,L3)；D1=(LA,WP1)，D2=(LB,WP2)，D=(WD1,WD2)，随后相同。
wave：
- 0：[A,B]→[C,D]→[E]→[F]。
- half：[A,B]→[C,D1,D2]→[D]→[E]→[F]。
- same：[A,B,P1,P2]→[C,D1,D2]→[D]→[E]→[F]。
Q3/Q2/Q1无reset实际场数分别0:4/5/6，half:6/7/8，same:8/9/10。

## N=8
UB：A=(U1,U8)，B=(U4,U5)，C=(U2,U7)，D=(U3,U6)，E=(WA,WB)，F=(WC,WD)，G=(WE,WF)。
L=0：H=(LA,LB)，I=(LC,LD)。
之后：J=(WH,LF)，K=(WI,LE)，M=(WJ,WK)。
Q3输出WG/WM/LG；Q2补O=(WM,LG)；Q1补Z=(WG,WO)。
L=half=4：X1=(LA,L1)，X2=(LB,L2)，X3=(LC,L3)，X4=(LD,L4)；H=(WX1,WX2)，I=(WX3,WX4)，之后同上。
L=same=8：P1=(L1,L8)，P2=(L4,L5)，P3=(L2,L7)，P4=(L3,L6)；X1..X4分别=(LA,WP1)..(LD,WP4)，H/I与half相同。
wave：
- 0：[A,B,C,D]→[E,F,H,I]→[G,J,K]→[M]→[O]→[Z]。
- half：[A,B,C,D]→[E,F,X1,X2,X3,X4]→[G,H,I]→[J,K]→[M]→[O]→[Z]。
- same首wave额外P1..P4，其余同half。
Q3/Q2/Q1无reset实际场数分别0:12/13/14，half:16/17/18，same:20/21/22。

## GF重置两条路径
reset=false：GF1任意方胜即结束。
reset=true：GF1上方（UB冠军）胜时无GF2；下方（LB冠军）胜时GF2激活，两人再赛。条件节点不会算作未裁定必需场。
N4标准实际6或7，N8标准14或15。直接输入各模式只在无reset场数基础上可能多1。
GF1胜败源不是GF2的双方来源：GF2双方仍为UB/LB冠军，条件为GF1下方胜；不重复使用动态索引变更身份。

## 人工身份检查
标准N4：UB决赛前，WA/WB与LA/LB互斥；D胜者对C败者，无此前同一时刻比赛。标准N8：H的身份来自A/B败者，而F的败者来自C/D胜者，J初次跨半区；K相反。G与J/K虽来源集合覆盖多个首轮单位，但每条路径由胜/负分支互斥。M和G败者也互斥。固定表允许后期重赛。
直接输入全部来自独立名单且已有一败，预选/接入的败者立刻淘汰；任何输入从没有两路复制。每个Q前沿人数恰等于Q，不给尚未交手的LB两人捏造第2/3名。
独立只读核验manual_de_feeders_review返回complete，N4/N8表、所有Q/入口/波次及reset一致。完整生成器再用独立手算数量、N8具体cross feeder及N2–64结果路径核对；不将程序输出反写成独立期望。drop版本规则为本页明示的相邻交叉表；same首wave完整为[A,B,C,D,P1,P2,P3,P4]（N8）。half按lower种子顺序接入，seed表仍用于实际lower预选，平台选择详见compiled-plan-api.md。