"use strict";
const { runtimeSupported } = require("./support");
const integer = (min, max) => ({ type: "integer", minimum: min, maximum: max });
const choice = (...values) => ({ type: "string", enum: values });
const bo = { type: "integer", enum: [1, 3, 5, 7] },
  boolean = { type: "boolean" };
const object = (properties) => ({
  type: "object",
  additionalProperties: false,
  properties,
});
const seeding = object({
  kind: choice("seed", "slot"),
  seedTableVersion: choice("recursive-v1"),
});
const points = object({
  win: integer(0, Number.MAX_SAFE_INTEGER),
  draw: integer(0, Number.MAX_SAFE_INTEGER),
  loss: integer(0, Number.MAX_SAFE_INTEGER),
  doubleLoss: integer(0, Number.MAX_SAFE_INTEGER),
});
const definitions = [
  [
    "single-cut-v2",
    "single-elimination",
    "单败淘汰",
    8,
    1,
    1,
    { bracketMode: "complete", thirdPlace: false },
    { bracketMode: choice("complete", "segmented"), thirdPlace: boolean },
    ["final", "thirdPlace"],
  ],
  [
    "gsl-classic-v1",
    "gsl",
    "经典GSL",
    4,
    4,
    2,
    {},
    {},
    ["opening", "winners", "elimination", "decider"],
  ],
  [
    "de-standard-v1",
    "double-elimination",
    "标准双败",
    8,
    1,
    1,
    { lowerEntryMode: "disabled", finalReset: false },
    { lowerEntryMode: choice("disabled"), finalReset: boolean },
    ["upper", "lower", "final"],
  ],
  [
    "de-lower-entry-v1",
    "double-elimination",
    "双败及败者直接输入",
    8,
    1,
    1,
    { lowerEntryMode: "disabled", finalReset: false },
    { lowerEntryMode: choice("disabled", "same", "half"), finalReset: boolean },
    ["upper", "lower", "final"],
  ],
  [
    "swiss-fixed-v1",
    "fixed-swiss",
    "固定轮数瑞士",
    16,
    1,
    8,
    {
      roundCount: 4,
      allowDraw: false,
      allowPlayerDoubleLoss: false,
      points: { win: 3, draw: 1, loss: 0, doubleLoss: 0 },
      tiebreakers: ["points", "BH-points-v1", "netGames", "initialSeed"],
      firstPairing: "top-bottom",
    },
    {
      roundCount: integer(1, 64),
      allowDraw: boolean,
      allowPlayerDoubleLoss: boolean,
      points,
      tiebreakers: {
        type: "array",
        items: choice(
          "points",
          "BH-points-v1",
          "netGames",
          "initialSeed",
          "manual-with-reason",
        ),
        minItems: 1,
        uniqueItems: true,
      },
      firstPairing: choice("top-bottom"),
    },
    [],
  ],
  [
    "swiss-threshold-v1",
    "threshold-swiss",
    "胜负阈值瑞士",
    16,
    1,
    8,
    {
      winsToQualify: 3,
      lossesToEliminate: 3,
      allowDraw: false,
      allowPlayerDoubleLoss: false,
      tiebreakers: ["record", "DS-wl-v1", "initialSeed"],
      firstPairing: "top-bottom",
    },
    {
      winsToQualify: integer(1, 5),
      lossesToEliminate: integer(1, 5),
      allowDraw: { type: "boolean", enum: [false] },
      allowPlayerDoubleLoss: boolean,
      tiebreakers: {
        type: "array",
        items: choice(
          "record",
          "DS-wl-v1",
          "initialSeed",
          "manual-with-reason",
        ),
        minItems: 1,
        uniqueItems: true,
      },
      firstPairing: choice("top-bottom"),
    },
    ["advancement", "elimination"],
  ],
  [
    "major-cologne-2026-v1",
    "threshold-swiss",
    "科隆Major 2026专用瑞士",
    16,
    1,
    8,
    {
      winsToQualify: 3,
      lossesToEliminate: 3,
      allowDraw: false,
      allowPlayerDoubleLoss: false,
      tiebreakers: ["record", "DS-wl-v1", "initialSeed"],
      firstPairing: "top-bottom",
      overrides: { advancement: 3, elimination: 3 },
    },
    {
      defaultBO: { type: "integer", enum: [1, 3] },
      seeding: object({
        kind: choice("seed"),
        seedTableVersion: choice("recursive-v1"),
      }),
      winsToQualify: { type: "integer", enum: [3] },
      lossesToEliminate: { type: "integer", enum: [3] },
      allowDraw: { type: "boolean", enum: [false] },
      allowPlayerDoubleLoss: { type: "boolean", enum: [false] },
      tiebreakers: {
        type: "array",
        items: choice("record", "DS-wl-v1", "initialSeed"),
        minItems: 3,
        uniqueItems: true,
      },
      firstPairing: choice("top-bottom"),
      overrides: object({
        advancement: { type: "integer", enum: [3] },
        elimination: { type: "integer", enum: [3] },
        rounds: object({}),
      }),
    },
    ["advancement", "elimination"],
  ],
  [
    "ti2026-observed-candidate-v1",
    "threshold-swiss",
    "TI2026候选计划（待验证）",
    16,
    1,
    8,
    {
      seeding: { kind: "slot", seedTableVersion: "ti-organizer-slot-v1" },
      roundCount: 5,
      winsToQualify: 4,
      lossesToEliminate: 4,
      allowDraw: false,
      allowPlayerDoubleLoss: false,
      tiebreakers: [
        "record",
        "TI-opponent-wins-v1",
        "TI-game-pct-observed-v1",
        "TI-opponent-game-pct-observed-v1",
        "TI-duration-observed-v1",
        "coin-toss-with-reason",
      ],
      firstPairing: "organizer-slot-pairs-v1",
    },
    {
      defaultBO: { type: "integer", enum: [3] },
      seeding: object({
        kind: choice("slot"),
        seedTableVersion: choice("ti-organizer-slot-v1"),
      }),
      roundCount: { type: "integer", enum: [5] },
      winsToQualify: { type: "integer", enum: [4] },
      lossesToEliminate: { type: "integer", enum: [4] },
      allowDraw: { type: "boolean", enum: [false] },
      allowPlayerDoubleLoss: { type: "boolean", enum: [false] },
      tiebreakers: {
        type: "array",
        items: choice(
          "record",
          "TI-opponent-wins-v1",
          "TI-game-pct-observed-v1",
          "TI-opponent-game-pct-observed-v1",
          "TI-duration-observed-v1",
          "coin-toss-with-reason",
        ),
        minItems: 6,
        uniqueItems: true,
      },
      firstPairing: choice("organizer-slot-pairs-v1"),
      overrides: object({}),
    },
    [],
  ],
  ...[
    ["round-robin-v2", "round-robin", 1],
    ["double-round-robin-v2", "double-round-robin", 2],
  ].map(([id, format, cycles]) => [
    id,
    format,
    cycles === 1 ? "单循环" : "双循环",
    4,
    1,
    2,
    {
      cycleCount: cycles,
      allowDraw: false,
      allowPlayerDoubleLoss: false,
      points: { win: 3, draw: 1, loss: 0, doubleLoss: 0 },
      tiebreakers: [
        "points",
        "head-to-head-v1",
        "netGames",
        "manual-with-reason",
      ],
    },
    {
      cycleCount: { type: "integer", enum: [cycles] },
      allowDraw: boolean,
      allowPlayerDoubleLoss: boolean,
      points,
      tiebreakers: {
        type: "array",
        items: choice(
          "points",
          "head-to-head-v1",
          "netGames",
          "manual-with-reason",
        ),
        minItems: 1,
        uniqueItems: true,
      },
    },
    [],
  ]),
];
function formatCatalog() {
  return structuredClone({
    version: "format-catalog-v1",
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    formats: definitions.map(
      ([
        ruleVersion,
        format,
        label,
        n,
        count,
        q,
        defaults,
        properties,
        roles,
      ]) => ({
        ruleVersion,
        format,
        label,
        runtimeReady: runtimeSupported(ruleVersion),
        ...(!runtimeSupported(ruleVersion)
          ? { unavailableReason: "FORMAT_RUNTIME_UNAVAILABLE" }
          : {}),
        defaults: {
          groupSize: n,
          groupCount: count,
          qualifyCount: q,
          parameters: {
            defaultBO: 3,
            seeding: { kind: "seed", seedTableVersion: "recursive-v1" },
            overrides: {},
            ...structuredClone(defaults),
          },
        },
        parameterSchema: object({
          defaultBO: bo,
          seeding,
          overrides: object({
            ...Object.fromEntries(roles.map((role) => [role, bo])),
            rounds: object(
              Object.fromEntries(
                Array.from({ length: 64 }, (_, i) => [String(i + 1), bo]),
              ),
            ),
          }),
          ...properties,
        }),
        confirmationProfile:
          format === "gsl" || format === "double-elimination"
            ? "dependency-wave-v1"
            : "group-round-v1",
      }),
    ),
  });
}
function definition(ruleVersion) {
  return formatCatalog().formats.find((f) => f.ruleVersion === ruleVersion);
}
module.exports = { formatCatalog, definition };
