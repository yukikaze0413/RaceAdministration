import { expect, it } from "vitest";
import {
  portOptions,
  portRefKey,
  sourceConsumers,
  targetConflicts,
} from "./plan-ports";
const structure = {
  stages: [
    {
      id: "s",
      name: "截断",
      format: "single-elimination",
      groupSize: 8,
      qualifyCount: 4,
      groups: [{ id: "g" }],
    },
    {
      id: "d",
      name: "双败",
      format: "double-elimination",
      groupSize: 8,
      capacity: 12,
      groupCount: 1,
      qualifyCount: 2,
      groups: [{ id: "h" }],
    },
  ],
  pools: [{ id: "p", capacity: 4 }],
  routes: [],
};
it("exposes only available named channels and keeps pool input without a port", () => {
  const sources = portOptions(structure, "source"),
    targets = portOptions(structure, "target");
  expect(
    sources.filter((p) => p.ref.groupId === "g").map((p) => p.ref.port),
  ).toEqual(["qualification"]);
  expect(
    targets.find((p) => p.ref.groupId === "h" && p.ref.port === "lower")
      ?.capacity,
  ).toBe(4);
  expect(targets.find((p) => p.ref.poolId)?.ref).toEqual({ poolId: "p" });
  expect(
    portRefKey({ stageId: "s", groupId: "g", port: "qualification" }),
  ).not.toBe(portRefKey({ stageId: "s", groupId: "g", port: "rank" }));
});
it("tracks used source ranges separately from conflicting target seats", () => {
  const source = { stageId: "s", groupId: "g", port: "qualification" },
    target = { stageId: "d", groupId: "h", port: "upper" };
  const route = {
    id: "r",
    source,
    target,
    selector: { kind: "rankRange", from: 1, to: 2 },
    quota: 2,
    placement: { kind: "seed", positions: [1, 2] },
  };
  expect(sourceConsumers([route], source, 2, 3).map((r) => r.id)).toEqual([
    "r",
  ]);
  expect(sourceConsumers([route], source, 3, 4)).toEqual([]);
  expect(targetConflicts([route], target, [2]).map((r) => r.id)).toEqual(["r"]);
  expect(targetConflicts([route], { ...target, port: "lower" }, [2])).toEqual(
    [],
  );
});
