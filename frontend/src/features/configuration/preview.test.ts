import { expect, it } from "vitest";
import { mapSampleSources } from "./preview";
it("requires complete distinct mapping and only rewrites snapshot source identifiers", () => {
  const sample = {
    roster: [{ entrantId: "a", exitState: "disqualified" }],
    sourceSnapshots: [
      { sourceId: "A", entries: [{ entrantId: "a" }] },
      { sourceId: "B", entries: [] },
    ],
  };
  expect(() => mapSampleSources(sample, { A: "x" })).toThrow();
  expect(() => mapSampleSources(sample, { A: "x", B: "x" })).toThrow();
  const mapped = mapSampleSources(sample, { A: "x", B: "y" });
  expect(mapped.roster).toEqual(sample.roster);
  expect(mapped.sourceSnapshots[0].entries).toEqual(
    sample.sourceSnapshots[0].entries,
  );
  expect(mapped.sourceSnapshots.map((s: any) => s.sourceId)).toEqual([
    "x",
    "y",
  ]);
  expect(sample.sourceSnapshots[0].sourceId).toBe("A");
});
