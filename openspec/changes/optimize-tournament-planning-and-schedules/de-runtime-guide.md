# 双败实际运行

de-standard-v1为标准双败，de-lower-entry-v1可选额外败者直接输入：disabled=0、half=N/2、same=N。upper与lower为两个独立具名入口，同一身份不可两边重复。直接lower选手已有一败，但没有虚构既往比分；战绩表显示本阶段实际比赛，初始败数单独保留。

upper采用冻结递归种子表。half直接与upper首轮败者接入；same先做lower预选N→N/2，再接入。预选及upper首轮同一批次，所有必需比赛收齐后才能确认。具体交叉feeder以double-elimination-feeders.md的平台版本表为准。

Q3停在upper冠军1人与lower幸存2人；Q2停在upper/lower各1人；均不生成总决赛，不给未决胜的资格者制造唯一竞技名次。Q1生成GF1。reset=false时一场GF决定冠军；reset=true且lower冠军赢GF1才激活GF2，双方身份仍是upper/lower冠军。页面显示尚未满足的重置条件或已结束但未激活；GF和GF2使用同一冻结决赛BO。

N4标准无重置6场，条件重置路径7场；N8为14/15场。N4 half为8/9场、same为10/11场；N8 half为18/19场、same为22/23场。总唯一参赛人数含额外lower，必须≤64。

每个确认批次一人最多一场，必须裁定齐备才确认。results.edit只能裁定，rounds.confirm才能确认，已确认赛果锁定；重试复核当前权限，数据库失败整体回滚。报名锁定、开赛配置命名空间及全部来源齐备门槛见entry-runtime-guide.md。
