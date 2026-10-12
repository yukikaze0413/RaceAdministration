"use strict";
// 公开数据整理；不是TI规则实现，不能据此开放运行支持。
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(
  __dirname,
  "../openspec/changes/optimize-tournament-planning-and-schedules/evidence/reference-sources",
);
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const valve = read("ti2026-valve-league.json"),
  cn = read("ti2026-cn-schedule.json"),
  manifest = read("manifest.json");
// 人工核对的双站ID映射；保留原名，不用赛后别名覆盖Valve快照。
const mapping = {
  9247354: 19563,
  10150538: 3505,
  10150413: 22296,
  10136357: 18412,
  8255888: 20782,
  2586976: 3522,
  9572001: 22887,
  5017210: 23887,
  7119388: 3552,
  8261500: 19629,
  2163: 3530,
  726228: 3507,
  9467224: 3903,
  9964962: 23696,
  9823272: 23531,
  10149530: 22084,
};
const teams = valve.node_groups[0].team_standings.map((t) => ({
  id: t.team_id,
  name: t.team_name,
  cnId: mapping[t.team_id],
  cnNames: [
    ...new Set(
      cn.result.matches
        .flatMap((m) => [
          [m.homeId, m.homeName],
          [m.awayId, m.awayName],
        ])
        .filter(([id]) => id === mapping[t.team_id])
        .map(([, name]) => name),
    ),
  ],
}));
const groups = valve.node_groups.flatMap((g) => g.node_groups ?? []);
const conflicts = [],
  matchedIds = new Set();
const phases = groups.map((g) => ({
  id: g.node_group_id,
  name: g.name,
  metadata: Object.fromEntries(
    Object.entries(g).filter(
      ([k]) => !["node_groups", "nodes", "team_standings"].includes(k),
    ),
  ),
  standings: g.team_standings.map((t) =>
    Object.fromEntries(Object.entries(t).filter(([k]) => !k.includes("logo"))),
  ),
  ignoredPlaceholderIds: g.nodes
    .filter((n) => !n.team_id_1 || !n.team_id_2 || !n.is_completed)
    .map((n) => n.node_id),
  matches: g.nodes
    .filter((n) => n.team_id_1 && n.team_id_2 && n.is_completed)
    .map((n) => {
      const candidates = cn.result.matches.filter((m) => {
        const pair = [m.homeId, m.awayId];
        return (
          pair.includes(mapping[n.team_id_1]) &&
          pair.includes(mapping[n.team_id_2])
        );
      });
      // 两站比赛记录一对一；重赛按最近时间消歧。中国matchTime含义未明确，不称actual。
      const match = candidates.sort(
        (a, b) =>
          Math.abs(a.matchTime - n.actual_time * 1000) -
          Math.abs(b.matchTime - n.actual_time * 1000),
      )[0];
      let comparison = "missing";
      if (match) {
        const reversed = match.homeId !== mapping[n.team_id_1],
          scores = reversed
            ? [match.awayScore, match.homeScore]
            : [match.homeScore, match.awayScore];
        comparison =
          JSON.stringify(scores) ===
          JSON.stringify([n.team_1_wins, n.team_2_wins])
            ? "scores-agree"
            : "score-conflict";
        if (matchedIds.has(match.matchId))
          conflicts.push({
            code: "CN_RECORD_REUSED",
            nodeId: n.node_id,
            cnMatchId: match.matchId,
          });
        matchedIds.add(match.matchId);
      }
      if (comparison !== "scores-agree")
        conflicts.push({ code: comparison, nodeId: n.node_id });
      return {
        nodeId: n.node_id,
        label: n.name,
        seriesId: n.series_id,
        entrantIds: [n.team_id_1, n.team_id_2],
        scores: [n.team_1_wins, n.team_2_wins],
        nodeType: n.node_type,
        scheduledAt: new Date(n.scheduled_time * 1000).toISOString(),
        actualStartedAt: n.actual_time
          ? new Date(n.actual_time * 1000).toISOString()
          : null,
        incomingNodeIds: [n.incoming_node_id_1, n.incoming_node_id_2],
        winningNodeId: n.winning_node_id,
        losingNodeId: n.losing_node_id,
        games: n.matches.map((m) => ({
          matchId: m.match_id,
          winnerId: m.winning_team_id,
          durationSeconds: m.duration,
        })),
        cnComparison: {
          status: comparison,
          matchId: match?.matchId,
          time: match ? new Date(match.matchTime).toISOString() : null,
          timeMeaning: "来源matchTime未明确实际/预计；不写actualStartedAt",
        },
      };
    }),
}));
const result = {
  version: "ti2026-official-observations-v1",
  status: "pending",
  entrantKind: "reference-unit",
  leagueId: 19719,
  missing: [
    "初始分组独立名单及种子/组织者裁定记录（官方节点标签与首轮实际对阵已保存）",
    "配对距离优化的确定性算法及官方人工调整记录",
    "对手局胜率加权/取整公式的官方定义（现仅16队数据重算一致）",
    "主赛种子到首轮槽位映射与抛硬币裁定记录",
  ],
  verifiedRuleText: {
    url: "https://www.dota2.com/esports/ti15/tirules?l=english",
    readDate: "2026-10-10",
    title: "The International 2026",
    transcript: "evidence/reference-sources/ti2026-rules-rendered.txt",
    publicationDate: null,
    rankingOrder: [
      "series-wins",
      "series-losses",
      "opponents-series-wins",
      "game-win-percentage",
      "opponents-game-win-percentage",
      "average-game-duration",
      "coin-toss",
    ],
    grouping:
      "R1 organizer pairing in two groups; R2/R3 same initial group; R4 opposite group",
    roundFive: "maximize ranking distance in elimination matches",
    elimination: "3-2 teams choose remaining 2-3 opponents in Swiss rank order",
    playoffSeeding: "eight qualifiers ordered by final Swiss ranking",
    limitation:
      "Published prose does not specify a deterministic optimization algorithm or weighted percentage rounding formula.",
  },
  sources: manifest.sources
    .filter((s) =>
      [
        "ti2026-valve-league",
        "ti2026-cn-schedule",
        "ti2026-official-steam",
        "ti2026-official-rules-page",
      ].includes(s.id),
    )
    .map(({ id, url, readAt, sha256 }) => ({ id, url, readAt, sha256 })),
  teams,
  observedInitialPairing: {
    sourceId: "ti2026-valve-league",
    sourcePath:
      "node_groups[0].node_groups[0].nodes[*].name/team_id_1/team_id_2",
    status: "official-labelled-pairing-table",
    matches: phases
      .find((g) => g.name === "Swiss")
      .matches.filter((m) => /^Match [1-4]\.[AB]$/.test(m.label))
      .map((m) => ({
        nodeId: m.nodeId,
        label: m.label,
        groupLabel: m.label.at(-1),
        entrantIds: m.entrantIds,
      })),
    limitation:
      "A/B is interpreted from literal official node names, corroborated by later same/cross-group matches. No separate initial numeric seed table or organizer decision audit is present.",
  },
  phases,
  crossCheck: {
    valveSeriesCount: phases.reduce((n, g) => n + g.matches.length, 0),
    cnSeriesCount: cn.result.matches.length,
    matchedCnIds: matchedIds.size,
    conflicts,
  },
  nameBoundary:
    "保留双方原名与ID。公告BoomBoys等名称与数据BETBOOM TEAM/BB存在名称差异，未据此宣称官方历史名称一致。",
};
const target = path.resolve(
  __dirname,
  "../backend/test/fixtures/ti2026-official-observations-v1.json",
);
fs.writeFileSync(target, JSON.stringify(result, null, 2) + "\n", "utf8");
process.stdout.write(
  JSON.stringify({
    status: result.status,
    teams: teams.length,
    phases: phases.map((g) => ({
      name: g.name,
      count: g.matches.length,
      ignored: g.ignoredPlaceholderIds.length,
    })),
    crossCheck: result.crossCheck,
  }) + "\n",
);
