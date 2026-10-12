"use strict";
// Check factual transcriptions, not a production pairing or historical replay.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const file = path.resolve(
    __dirname,
    "../backend/test/fixtures/cologne2026-historical-observations-v1.json",
  ),
  bytes = fs.readFileSync(file),
  data = JSON.parse(bytes),
  reports = [];
for (const stage of data.stages.slice(0, 3)) {
  assert.equal(stage.matches.length, 33);
  assert.equal(stage.standings.length, 16);
  const totals = new Map(stage.standings.map((s) => [s.name, [0, 0]])),
    seen = new Set();
  for (const match of stage.matches) {
    assert.equal(match.actualStartedAt, null);
    assert.equal(match.scheduledAt, null);
    const key = [...match.entrantNames].sort().join(":");
    assert.ok(!seen.has(key));
    seen.add(key);
    assert.notEqual(match.scores[0], match.scores[1]);
    assert.equal(Math.max(...match.scores), (match.bestOf + 1) / 2);
    if (match.bestOf === 1) {
      assert.equal(match.displayScoreMeaning, "map-rounds");
      assert.deepEqual(
        match.scores,
        match.displayScores.map((s, i, a) => Number(s > a[1 - i])),
      );
    }
    match.entrantNames.forEach((name, i) => {
      assert.ok(totals.has(name));
      totals.get(name)[match.scores[i] > match.scores[1 - i] ? 0 : 1]++;
    });
  }
  for (const standing of stage.standings)
    assert.deepEqual(totals.get(standing.name), [
      standing.wins,
      standing.losses,
    ]);
  const qualifiers = stage.standings
    .filter((s) => s.wins === 3)
    .map((s) => s.name);
  assert.equal(qualifiers.length, 8);
  reports.push({
    stageId: stage.id,
    seriesCount: 33,
    entrants: [...totals.keys()],
    qualifiers,
  });
}
const invited = reports.map((r, i) =>
  i === 0
    ? r.entrants
    : r.entrants.filter((name) => !reports[i - 1].qualifiers.includes(name)),
);
assert.deepEqual(
  invited.map((s) => s.length),
  [16, 8, 8],
);
assert.equal(new Set(invited.flat()).size, 32);
const playoff = data.stages[3],
  appearances = new Map(),
  losses = new Map();
assert.equal(playoff.matches.length, 7);
assert.equal(playoff.matches.filter((m) => m.bestOf === 5).length, 1);
for (const match of playoff.matches) {
  assert.equal(Math.max(...match.scores), (match.bestOf + 1) / 2);
  match.entrantNames.forEach((name, i) => {
    assert.ok(reports[2].qualifiers.includes(name));
    appearances.set(name, (appearances.get(name) ?? 0) + 1);
    losses.set(
      name,
      (losses.get(name) ?? 0) + Number(match.scores[i] < match.scores[1 - i]),
    );
  });
}
assert.equal(appearances.size, 8);
assert.equal(losses.get("Falcons"), 0);
for (const [name, n] of losses) assert.equal(n, name === "Falcons" ? 0 : 1);
const result = {
  status: "observations-internally-consistent",
  fixtureSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  stageSeriesCounts: [33, 33, 33, 7],
  seriesCount: 106,
  uniqueEntrants: 32,
  reports,
  invitedBySetDifference: invited,
  inviteMeaning:
    "Stage2/3 set differences from observed qualifier and entrant lists, not an official invitation seed table.",
  playoff: {
    champion: "Falcons",
    runnerUp: "FURIA",
    singleLossEliminationAgrees: true,
  },
  sourceDateConflicts: data.sourceDateConflicts,
  limitation:
    "Internal consistency does not verify official pairing, seeding, adjustments, scheduled or actual instants, nor establish runtime support.",
};
const vrs = fs
  .readFileSync(
    path.resolve(
      __dirname,
      "../openspec/changes/optimize-tournament-planning-and-schedules/evidence/reference-sources/valve-cologne-may4-live.md",
    ),
    "utf8",
  )
  .split(/\r?\n/)
  .filter((l) => /^\|\s*\d+\s*\|/.test(l))
  .map((l) => {
    const c = l.split("|").map((s) => s.trim());
    return {
      rank: Number(c[1]),
      points: Number(c[2]),
      name: c[3],
      roster: c[4],
    };
  });
const candidate = new Map(
  invited.flat().map((name) => {
    const rows = vrs.filter((r) => r.name.toLowerCase() === name.toLowerCase()),
      row =
        rows.length === 1
          ? rows[0]
          : rows.find((r) =>
              name === "NRG"
                ? r.roster.includes("nitr0") && r.roster.includes("oSee")
                : name === "9z" &&
                  r.roster.includes("dgt") &&
                  r.roster.includes("meyern"),
            );
    assert.ok(row, "Explicit roster disambiguation required for " + name);
    return [name, row];
  }),
);
let previousFinal = [];
const seedChecks = [];
for (let i = 0; i < 3; i++) {
  const stage = data.stages[i],
    direct = invited[i].toSorted(
      (a, b) => candidate.get(a).rank - candidate.get(b).rank,
    ),
    order = i === 0 ? direct : [...direct, ...previousFinal],
    seeds = new Map(order.map((name, index) => [name, index + 1])),
    firstPairs = Array.from({ length: 8 }, (_, index) => [
      order[index],
      order[index + 8],
    ]),
    firstMatches = firstPairs.map(([a, b]) =>
      stage.matches.find(
        (m) => m.entrantNames.includes(a) && m.entrantNames.includes(b),
      ),
    );
  assert.ok(
    firstMatches.every(Boolean),
    "Candidate first round mismatch: " + stage.id,
  );
  const opponents = new Map(order.map((name) => [name, []]));
  for (const m of stage.matches)
    m.entrantNames.forEach((name, side) =>
      opponents.get(name).push(m.entrantNames[1 - side]),
    );
  const records = new Map(stage.standings.map((r) => [r.name, r])),
    difficulty = new Map(
      order.map((name) => [
        name,
        opponents
          .get(name)
          .reduce(
            (sum, other) =>
              sum + records.get(other).wins - records.get(other).losses,
            0,
          ),
      ]),
    );
  previousFinal = stage.standings
    .filter((r) => r.wins === 3)
    .toSorted(
      (a, b) =>
        b.wins - a.wins ||
        a.losses - b.losses ||
        difficulty.get(b.name) - difficulty.get(a.name) ||
        seeds.get(a.name) - seeds.get(b.name),
    )
    .map((r) => r.name);
  seedChecks.push({
    stageId: stage.id,
    initialSeedCandidate: order,
    firstPairs,
    allFirstPairsAgree: true,
    qualifiedFinalSeedCandidate: previousFinal,
    difficulty: Object.fromEntries(difficulty),
  });
  const firstIds = new Set(firstMatches.map((m) => m.observationId)),
    dates =
      i === 0
        ? ["02", "02", "03", "04", "05"]
        : i === 1
          ? ["06", "06", "07", "08", "09"]
          : ["11", "12", "13", "14", "15"],
    rounds = dates.map((day, r) =>
      r === 0
        ? firstMatches
        : stage.matches.filter(
            (m) =>
              m.sourceDate === "2026-06-" + day &&
              !firstIds.has(m.observationId),
          ),
    ),
    live = new Map(
      order.map((name) => [name, { name, wins: 0, losses: 0, opponents: [] }]),
    ),
    pairingChecks = [];
  assert.deepEqual(
    rounds.map((r) => r.length),
    [8, 8, 8, 6, 3],
  );
  const priority = [
    [
      [1, 6],
      [2, 5],
      [3, 4],
    ],
    [
      [1, 6],
      [2, 4],
      [3, 5],
    ],
    [
      [1, 5],
      [2, 6],
      [3, 4],
    ],
    [
      [1, 5],
      [2, 4],
      [3, 6],
    ],
    [
      [1, 4],
      [2, 6],
      [3, 5],
    ],
    [
      [1, 4],
      [2, 5],
      [3, 6],
    ],
    [
      [1, 6],
      [2, 3],
      [4, 5],
    ],
    [
      [1, 5],
      [2, 3],
      [4, 6],
    ],
    [
      [1, 3],
      [2, 6],
      [4, 5],
    ],
    [
      [1, 3],
      [2, 5],
      [4, 6],
    ],
    [
      [1, 4],
      [2, 3],
      [5, 6],
    ],
    [
      [1, 3],
      [2, 4],
      [5, 6],
    ],
    [
      [1, 2],
      [3, 6],
      [4, 5],
    ],
    [
      [1, 2],
      [3, 5],
      [4, 6],
    ],
    [
      [1, 2],
      [3, 4],
      [5, 6],
    ],
  ];
  const pairSet = (pairs) => pairs.map((p) => [...p].sort().join(":")).sort(),
    rematch = ([a, b]) => live.get(a).opponents.includes(b),
    currentDS = (row) =>
      row.opponents.reduce(
        (sum, name) => sum + live.get(name).wins - live.get(name).losses,
        0,
      );
  for (let r = 0; r < 5; r++) {
    const observed = rounds[r].map((m) => m.entrantNames),
      expected = [],
      groups = new Map();
    const active = [...live.values()]
      .filter((row) => row.wins < 3 && row.losses < 3)
      .sort(
        (a, b) =>
          b.wins - a.wins ||
          a.losses - b.losses ||
          currentDS(b) - currentDS(a) ||
          seeds.get(a.name) - seeds.get(b.name),
      );
    assert.equal(new Set(observed.flat()).size, active.length);
    for (const row of active) {
      const key = row.wins + ":" + row.losses;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row.name);
    }
    if (r === 0) expected.push(...firstPairs);
    else
      for (const names of groups.values()) {
        if (r < 3) {
          const remaining = [...names];
          while (remaining.length) {
            const a = remaining.shift();
            let j = remaining.length - 1;
            while (j >= 0 && rematch([a, remaining[j]])) j--;
            if (j < 0) break;
            expected.push([a, remaining.splice(j, 1)[0]]);
          }
        } else {
          assert.equal(names.length, 6);
          const chosen = priority
            .map((row) => row.map(([a, b]) => [names[a - 1], names[b - 1]]))
            .find((pairs) => !pairs.some(rematch));
          if (chosen) expected.push(...chosen);
        }
      }
    const agrees =
      JSON.stringify(pairSet(expected)) === JSON.stringify(pairSet(observed));
    pairingChecks.push({
      round: r + 1,
      agrees,
      expected,
      observed,
      standingsBefore: active.map((row) => ({
        name: row.name,
        wins: row.wins,
        losses: row.losses,
        difficulty: currentDS(row),
        initialSeed: seeds.get(row.name),
      })),
    });
    for (const match of rounds[r])
      match.entrantNames.forEach((name, side) => {
        const row = live.get(name);
        assert.ok(row.wins < 3 && row.losses < 3);
        row[match.scores[side] > match.scores[1 - side] ? "wins" : "losses"]++;
        row.opponents.push(match.entrantNames[1 - side]);
      });
  }
  seedChecks.at(-1).pairingChecks = pairingChecks;
  seedChecks.at(-1).allRoundPairingsAgree = pairingChecks.every(
    (r) => r.agrees,
  );
}
result.preEventSnapshotCandidate = {
  date: "2026-05-04",
  sourceGitBlob: "32a9a4a31b2119916881cbfb5ebbb17fa50a6570",
  teams: Object.fromEntries(candidate),
  stages: seedChecks,
  limitation:
    "All 24 first-round pairs agree with May4 global standing and published final record/DS/initial-seed inheritance. ESL's explicit snapshot-adoption date and official adjustment records remain unverified; do not treat the agreement as that missing announcement.",
};
fs.writeFileSync(
  path.resolve(
    __dirname,
    "../openspec/changes/optimize-tournament-planning-and-schedules/evidence/cologne2026-observations-check.json",
  ),
  JSON.stringify(result, null, 2) + "\n",
  "utf8",
);
process.stdout.write(
  "Cologne observations: 106 series, 32 unique entrants, Swiss records and single-loss playoffs agree; source/rule/time gates remain pending.\n",
);
