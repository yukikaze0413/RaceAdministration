"use strict";
// 独立验收模型：禁止导入 src、编译器、配对器或运行器。
// 仅重建本文件明确列出的无平局、无轮空案例；不是生产赛制实现。
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
const time = (wave) =>
  new Date(Date.UTC(2026, 10, 1, 8) + (wave - 1) * 7200000).toISOString();
function game(rng, id, pair, wave, side) {
  const selected = rng() < 0.5 ? 0 : 1,
    margin = rng() < 0.5 ? 0 : 1;
  const win = side ?? selected,
    scores = win === 0 ? [2, margin] : [margin, 2];
  return {
    id,
    entrants: pair,
    scores,
    winner: pair[win],
    loser: pair[1 - win],
    wave,
    startsAt: time(wave),
    durationMinutes: 60,
    minRestMinutes: 15,
  };
}
function stats(seeds, games, ranks) {
  return seeds
    .map((seed) => {
      const played = games.filter((m) => m.entrants.includes(seed));
      return {
        seed,
        rank: ranks[seed],
        wins: played.filter((m) => m.winner === seed).length,
        actualLosses: played.filter((m) => m.loser === seed).length,
        netGames: played.reduce((sum, m) => {
          const side = m.entrants.indexOf(seed);
          return sum + m.scores[side] - m.scores[1 - side];
        }, 0),
      };
    })
    .sort((a, b) => a.rank - b.rank || a.seed - b.seed);
}
function shadow() {
  const rng = random(2026100801),
    rows = Array.from({ length: 32 }, (_, i) => ({
      seed: i + 1,
      wins: 0,
      losses: 0,
      points: 0,
      netGames: 0,
      opponents: [],
    }));
  const rounds = [];
  for (let round = 1; round <= 5; round++) {
    let pairs;
    if (round === 1)
      pairs = Array.from({ length: 16 }, (_, i) => [i + 1, i + 17]);
    else {
      // 同积分完整匹配：所有费用非负；找到费用零即为全局最优。
      // 按种子字典序枚举合法完整表，回溯而非贪心。此例无需跨带。
      function complete(left) {
        if (!left.length) return [];
        const [a, ...rest] = left,
          row = rows[a - 1];
        for (const b of rest) {
          if (row.points !== rows[b - 1].points || row.opponents.includes(b))
            continue;
          const next = complete(rest.filter((x) => x !== b));
          if (next) return [[a, b], ...next];
        }
        return null;
      }
      pairs = complete(rows.map((r) => r.seed));
      if (!pairs)
        throw Error(
          "独立样例无零费用匹配，必须另外验算跨带，不能静默套用生产求解器",
        );
    }
    const matches = pairs.map((pair, i) =>
      game(rng, `swiss/${round}/${i + 1}`, pair, round),
    );
    for (const m of matches) {
      const [a, b] = m.entrants.map((id) => rows[id - 1]);
      a.opponents.push(b.seed);
      b.opponents.push(a.seed);
      rows[m.winner - 1].wins++;
      rows[m.winner - 1].points += 3;
      rows[m.loser - 1].losses++;
      a.netGames += m.scores[0] - m.scores[1];
      b.netGames += m.scores[1] - m.scores[0];
    }
    const standings = rows
      .map((r) => ({
        ...r,
        opponents: [...r.opponents],
        bhPoints: r.opponents.reduce((n, id) => n + rows[id - 1].points, 0),
      }))
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.bhPoints - a.bhPoints ||
          b.netGames - a.netGames ||
          a.seed - b.seed,
      )
      .map((r, i) => ({ ...r, rank: i + 1 }));
    rounds.push({ number: round, matches, standings });
  }
  const qualified = rounds[4].standings.slice(0, 8).map((r) => r.seed);
  const seeds = [...qualified].sort((a, b) => a - b);
  let live = [1, 8, 4, 5, 2, 7, 3, 6].map((i) => seeds[i - 1]);
  const knockout = [];
  for (let r = 1; r <= 3; r++) {
    const matches = Array.from({ length: live.length / 2 }, (_, i) =>
      game(rng, `single/${r}/${i + 1}`, live.slice(i * 2, i * 2 + 2), 5 + r),
    );
    knockout.push({ number: r, matches });
    live = matches.map((m) => m.winner);
  }
  const ranks = { [live[0]]: 1 };
  for (const round of knockout)
    for (const m of round.matches)
      ranks[m.loser] = { 1: 5, 2: 3, 3: 2 }[round.number];
  return {
    id: "shadow-cup-v1",
    seed: 2026100801,
    entrantCount: 32,
    rounds,
    qualified,
    knockoutSeeds: seeds,
    knockout,
    champion: live[0],
    knockoutStandings: stats(
      seeds,
      knockout.flatMap((r) => r.matches),
      ranks,
    ),
    matchCount: 87,
  };
}
function gsl(reset) {
  const rng = random(2026100802),
    groups = [],
    entrySeeds = [];
  for (let g = 0; g < 4; g++) {
    const p = [1, 2, 3, 4].map((n) => g * 4 + n),
      prefix = `g${g}`;
    const a = game(rng, `${prefix}/opening/1/1`, p.slice(0, 2), 1),
      b = game(rng, `${prefix}/opening/1/2`, p.slice(2, 4), 1);
    const c = game(rng, `${prefix}/winners/2/1`, [a.winner, b.winner], 2),
      d = game(rng, `${prefix}/elimination/2/1`, [a.loser, b.loser], 2);
    const e = game(rng, `${prefix}/decider/3/1`, [c.loser, d.winner], 3);
    const ranking = [c.winner, e.winner, e.loser, d.loser],
      qualified = ranking.slice(0, 2);
    groups.push({ id: prefix, matches: [a, b, c, d, e], ranking, qualified });
    // 每组出线两席，组内按原始seed排序；四组分别填目标seed 1/2、3/4、5/6、7/8。
    entrySeeds.push(...[...qualified].sort((a, b) => a - b));
  }
  const matches = [],
    byId = new Map();
  function add(id, refs, wave, side) {
    const pair = refs.map((ref) =>
      typeof ref === "number"
        ? entrySeeds[ref - 1]
        : byId.get(ref.slice(1))[ref[0] === "W" ? "winner" : "loser"],
    );
    const m = game(rng, `de/${id}`, pair, wave + 3, side);
    matches.push(m);
    byId.set(id, m);
    return m;
  }
  // N8、无直接败者输入的人工feeder表；索引不读取编译结果。
  add("upper/1/1", [1, 8], 1);
  add("upper/1/2", [4, 5], 1);
  add("upper/1/3", [2, 7], 1);
  add("upper/1/4", [3, 6], 1);
  add("upper/2/1", ["Wupper/1/1", "Wupper/1/2"], 2);
  add("upper/2/2", ["Wupper/1/3", "Wupper/1/4"], 2);
  add("lower/1/1", ["Lupper/1/1", "Lupper/1/2"], 2);
  add("lower/1/2", ["Lupper/1/3", "Lupper/1/4"], 2);
  add("upper/3/1", ["Wupper/2/1", "Wupper/2/2"], 3);
  add("lower/2/1", ["Wlower/1/1", "Lupper/2/2"], 3);
  add("lower/2/2", ["Wlower/1/2", "Lupper/2/1"], 3);
  add("lower/3/1", ["Wlower/2/1", "Wlower/2/2"], 4);
  add("lower/4/1", ["Wlower/3/1", "Lupper/3/1"], 5);
  const final = add(
    "final/1/1",
    ["Wupper/3/1", "Wlower/4/1"],
    6,
    reset ? 1 : 0,
  );
  const last = reset
    ? add("final/2/1", ["Wupper/3/1", "Wlower/4/1"], 7)
    : final;
  const losses = Object.fromEntries(entrySeeds.map((id) => [id, 0]));
  for (const m of matches) losses[m.loser]++;
  const ranks = { [last.winner]: 1, [last.loser]: 2 };
  for (const [role, rank] of [
    ["lower/1/", 7],
    ["lower/2/", 5],
    ["lower/3/", 4],
    ["lower/4/", 3],
  ])
    for (const m of matches.filter((m) => m.id.startsWith("de/" + role)))
      ranks[m.loser] = rank;
  return {
    id: reset ? "gsl-reset-v1" : "gsl-no-reset-v1",
    seed: 2026100802,
    entrantCount: 16,
    finalReset: reset,
    forcedFinalSide: reset ? 1 : 0,
    groups,
    entrySeeds,
    matches,
    champion: last.winner,
    runnerUp: last.loser,
    losses,
    standings: stats(entrySeeds, matches, ranks),
    matchCount: reset ? 35 : 34,
  };
}
function build() {
  return {
    version: "reference-oracle-v1",
    timeMeaning: "演示预计时间，不是历史或实际开赛时间",
    scoreRandom:
      "LCG32(1664525,1013904223)，高位浮点取胜侧与败方局数；GF1显式强制两分支但仍消耗两次随机数",
    cases: [shadow(), gsl(false), gsl(true)],
  };
}
if (require.main === module) {
  const text = JSON.stringify(build(), null, 2) + "\n",
    target = path.resolve(
      __dirname,
      "../backend/test/fixtures/reference-cases-v1.json",
    );
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, "utf8");
  process.stdout.write(
    JSON.stringify({
      path: target,
      sha256: crypto.createHash("sha256").update(text).digest("hex"),
      counts: build().cases.map((c) => c.matchCount),
    }) + "\n",
  );
}
module.exports = { build };
